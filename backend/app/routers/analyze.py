from io import BytesIO
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.analysis_engine import calculate_inventory_metrics
from app.services.dashboard_service import upsert_dashboard_metrics
from app.services.decision_engine import create_decision_summary
from app.services.excel_reader import read_excel_dataframe_from_storage
from app.services.finance_engine import calculate_finance_metrics
from app.services.inventory_intelligence_engine import calculate_expiry_metrics
from app.services.morning_briefing_engine import create_morning_briefing
from app.services.order_engine import calculate_order_suggestions
from app.services.patient_engine import calculate_patient_metrics
from app.services.product_intelligence_engine import (
    calculate_product_intelligence,
)
from app.services.report_engine import create_analysis_report
from app.services.risk_engine import calculate_risk_metrics
from app.services.supabase_client import supabase


router = APIRouter(prefix="/analyze", tags=["Analyze"])


class AnalyzeRequest(BaseModel):
    company_id: str = Field(min_length=1)
    inventory_path: str = Field(min_length=1)
    sales_path: str = Field(min_length=1)
    product_path: str = Field(min_length=1)


def validate_user_company(
    company_id: str,
    authorization: str | None,
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Oturum doğrulanamadı.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        auth_result = supabase.auth.get_user(token)
        user = auth_result.user
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail="Geçersiz veya süresi dolmuş oturum.",
        ) from exc

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Kullanıcı doğrulanamadı.",
        )

    profile_result = (
        supabase.table("profiles")
        .select("company_id,role")
        .eq("id", user.id)
        .limit(1)
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            status_code=403,
            detail="Kullanıcı profili bulunamadı.",
        )

    profile = profile_result.data[0]

    if profile.get("role") == "admin":
        return user

    if str(profile.get("company_id")) != str(company_id):
        raise HTTPException(
            status_code=403,
            detail="Bu şirketin verilerine erişim yetkiniz bulunmuyor.",
        )

    return user


def validate_company(company_id: str):
    result = (
        supabase.table("companies")
        .select("id,name,status")
        .eq("id", company_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="Şirket bulunamadı.",
        )

    company = result.data[0]

    status = str(company.get("status") or "").strip().lower()

    if status and status not in {
        "active",
        "aktif",
        "trial",
        "demo",
    }:
        raise HTTPException(
            status_code=403,
            detail="Şirket hesabı aktif değil. Analiz başlatılamaz.",
        )

    return company


def validate_storage_path(
    company_id: str,
    storage_path: str,
    label: str,
):
    if not storage_path.startswith(f"{company_id}/"):
        raise HTTPException(
            status_code=400,
            detail=f"{label} dosyası bu şirkete ait görünmüyor.",
        )


def load_dataframe(
    storage_path: str,
    label: str,
):
    try:
        return read_excel_dataframe_from_storage(
            storage_path
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{label} dosyası okunamadı: {exc}",
        ) from exc


def _engine_status(
    *,
    inventory_metrics: dict,
    finance_metrics: dict,
    order_suggestions: dict,
    risk_metrics: dict,
    expiry_metrics: dict,
    patient_metrics: dict,
) -> dict:
    engines = {
        "inventory": inventory_metrics,
        "finance": finance_metrics,
        "order": order_suggestions,
        "risk": risk_metrics,
        "expiry": expiry_metrics,
        "patient": patient_metrics,
    }

    checks = {
        name: bool(result.get("success"))
        for name, result in engines.items()
    }

    critical_engines = [
        "inventory",
        "finance",
        "order",
        "risk",
    ]

    critical_success_count = sum(
        1
        for name in critical_engines
        if checks.get(name)
    )

    success_count = sum(
        1 for value in checks.values() if value
    )

    failed_engines = [
        name
        for name, success in checks.items()
        if not success
    ]

    warnings: list[str] = []

    for name, result in engines.items():
        if not result.get("success"):
            error = result.get("error")

            if error:
                warnings.append(
                    f"{name}: {error}"
                )

        for warning in result.get("warnings", []):
            warning_text = f"{name}: {warning}"

            if warning_text not in warnings:
                warnings.append(warning_text)

    if critical_success_count == len(critical_engines):
        status = (
            "complete"
            if success_count == len(engines)
            else "partial"
        )
        overall_success = True

    elif critical_success_count >= 2:
        status = "partial"
        overall_success = True

    else:
        status = "failed"
        overall_success = False

    confidence_score = round(
        (
            success_count
            / max(len(engines), 1)
        )
        * 100
    )

    return {
        "success": overall_success,
        "status": status,
        "confidence_score": confidence_score,
        "checks": checks,
        "failed_engines": failed_engines,
        "warnings": warnings[:20],
    }


def build_analysis(
    payload: AnalyzeRequest,
    persist_metrics: bool = True,
):
    company = validate_company(
        payload.company_id
    )

    validate_storage_path(
        payload.company_id,
        payload.inventory_path,
        "Envanter",
    )

    validate_storage_path(
        payload.company_id,
        payload.sales_path,
        "Satış",
    )

    validate_storage_path(
        payload.company_id,
        payload.product_path,
        "Ürün satış",
    )

    inventory_df = load_dataframe(
        payload.inventory_path,
        "Envanter",
    )

    sales_df = load_dataframe(
        payload.sales_path,
        "Satış",
    )

    product_df = load_dataframe(
        payload.product_path,
        "Ürün satış",
    )

    inventory_metrics = calculate_inventory_metrics(
        inventory_df
    )

    finance_metrics = calculate_finance_metrics(
        sales_df=sales_df,
        product_df=product_df,
    )

    order_suggestions = calculate_order_suggestions(
        inventory_df=inventory_df,
        product_df=product_df,
        sales_df=sales_df,
    )

    risk_metrics = calculate_risk_metrics(
        inventory_df=inventory_df,
        product_df=product_df,
        sales_df=sales_df,
    )

    expiry_metrics = calculate_expiry_metrics(
        inventory_df=inventory_df,
        product_df=product_df,
        sales_df=sales_df,
    )

    patient_metrics = calculate_patient_metrics(
        sales_df=sales_df,
        product_df=product_df,
    )

    # ---------------------------------------------------------
    # AYÇA PRODUCT INTELLIGENCE V1
    # Envanter + Ürün Bazında Toplamlar verisini birleştirir.
    # ---------------------------------------------------------

    product_intelligence = calculate_product_intelligence(
        inventory_df=inventory_df,
        product_df=product_df,
    )

    # Product Intelligence'ı şimdilik engine_status içine
    # dahil etmiyoruz.
    #
    # Önce gerçek eczane verileriyle doğrulayacağız.
    # Böylece yeni motorun olası bir problemi mevcut çalışan
    # analiz sisteminin complete/partial durumunu etkilemez.

    engine_status = _engine_status(
        inventory_metrics=inventory_metrics,
        finance_metrics=finance_metrics,
        order_suggestions=order_suggestions,
        risk_metrics=risk_metrics,
        expiry_metrics=expiry_metrics,
        patient_metrics=patient_metrics,
    )

    decision_summary = create_decision_summary(
        inventory_metrics=inventory_metrics,
        finance_metrics=finance_metrics,
        order_suggestions=order_suggestions,
        risk_metrics=risk_metrics,
        expiry_metrics=expiry_metrics,
        analysis_confidence_score=engine_status[
            "confidence_score"
        ],
    )

    morning_briefing = create_morning_briefing(
        inventory_metrics=inventory_metrics,
        finance_metrics=finance_metrics,
        order_suggestions=order_suggestions,
        risk_metrics=risk_metrics,
        expiry_metrics=expiry_metrics,
    )

    dashboard_metrics = None

    if persist_metrics and engine_status["success"]:
        dashboard_metrics = upsert_dashboard_metrics(
            company_id=payload.company_id,
            inventory_metrics=inventory_metrics,
            finance_metrics=finance_metrics,
            order_suggestions=order_suggestions,
            risk_metrics=risk_metrics,
        )

    return {
        "success": engine_status["success"],
        "analysis_status": engine_status["status"],
        "analysis_confidence_score": engine_status[
            "confidence_score"
        ],
        "analysis_checks": engine_status["checks"],
        "analysis_failed_engines": engine_status[
            "failed_engines"
        ],
        "analysis_warnings": engine_status["warnings"],

        "company": company,

        "files": {
            "inventory": {
                "storage_path": payload.inventory_path,
            },
            "sales": {
                "storage_path": payload.sales_path,
            },
            "product_sales": {
                "storage_path": payload.product_path,
            },
        },

        "inventory_metrics": inventory_metrics,
        "finance_metrics": finance_metrics,
        "order_suggestions": order_suggestions,
        "risk_metrics": risk_metrics,
        "expiry_metrics": expiry_metrics,
        "patient_metrics": patient_metrics,

        # AYÇA Product Intelligence V1
        "product_intelligence": product_intelligence,

        "morning_briefing": morning_briefing,
        "decision_summary": decision_summary,
        "dashboard_metrics": dashboard_metrics,
    }


def run_analysis(payload: AnalyzeRequest):
    return build_analysis(
        payload,
        persist_metrics=True,
    )


@router.post("/")
def analyze_post(
    payload: AnalyzeRequest,
    authorization: str | None = Header(default=None),
):
    validate_user_company(
        payload.company_id,
        authorization,
    )

    return run_analysis(payload)


@router.post("")
def analyze_post_no_slash(
    payload: AnalyzeRequest,
    authorization: str | None = Header(default=None),
):
    validate_user_company(
        payload.company_id,
        authorization,
    )

    return run_analysis(payload)


@router.post("/report")
def analyze_report(
    payload: AnalyzeRequest,
    authorization: str | None = Header(default=None),
):
    validate_user_company(
        payload.company_id,
        authorization,
    )

    result = build_analysis(
        payload,
        persist_metrics=False,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=422,
            detail={
                "message": (
                    "Rapor üretmek için gerekli temel "
                    "analizler tamamlanamadı."
                ),
                "failed_engines": result[
                    "analysis_failed_engines"
                ],
                "warnings": result[
                    "analysis_warnings"
                ],
            },
        )

    report_bytes = create_analysis_report(
        inventory_metrics=result[
            "inventory_metrics"
        ],
        finance_metrics=result[
            "finance_metrics"
        ],
        order_suggestions=result[
            "order_suggestions"
        ],
        risk_metrics=result[
            "risk_metrics"
        ],
        expiry_metrics=result[
            "expiry_metrics"
        ],
        morning_briefing=result[
            "morning_briefing"
        ],
    )

    filename = (
        "AYCA_Insight_Rapor_"
        f"{datetime.now().strftime('%Y%m%d_%H%M')}"
        ".xlsx"
    )

    return StreamingResponse(
        BytesIO(report_bytes),
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )


@router.get("/")
def analyze_get():
    return {
        "success": True,
        "message": (
            "Analiz için POST isteği ve üç dosya yolu "
            "gönderilmelidir."
        ),
    }


@router.get("")
def analyze_get_no_slash():
    return {
        "success": True,
        "message": (
            "Analiz için POST isteği ve üç dosya yolu "
            "gönderilmelidir."
        ),
    }