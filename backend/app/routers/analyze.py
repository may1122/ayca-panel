from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.supabase_client import supabase
from app.services.excel_reader import read_excel_dataframe_from_storage
from app.services.analysis_engine import calculate_inventory_metrics
from app.services.finance_engine import calculate_finance_metrics
from app.services.order_engine import calculate_order_suggestions
from app.services.risk_engine import calculate_risk_metrics
from app.services.morning_briefing_engine import create_morning_briefing
from app.services.dashboard_service import upsert_dashboard_metrics


router = APIRouter(
    prefix="/analyze",
    tags=["Analyze"],
)


class AnalyzeRequest(BaseModel):
    company_id: str = Field(min_length=1)
    inventory_path: str = Field(min_length=1)
    sales_path: str = Field(min_length=1)
    product_path: str = Field(min_length=1)


def validate_company(company_id: str):
    result = (
        supabase
        .table("companies")
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

    return result.data[0]


def validate_storage_path(company_id: str, storage_path: str, label: str):
    expected_prefix = f"{company_id}/"

    if not storage_path.startswith(expected_prefix):
        raise HTTPException(
            status_code=400,
            detail=f"{label} dosyası bu şirkete ait görünmüyor.",
        )


def load_dataframe(storage_path: str, label: str):
    try:
        return read_excel_dataframe_from_storage(storage_path)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{label} dosyası okunamadı: {exc}",
        ) from exc


def run_analysis(payload: AnalyzeRequest):
    company = validate_company(payload.company_id)

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
    )

    risk_metrics = calculate_risk_metrics(
        inventory_df=inventory_df,
        product_df=product_df,
    )

    morning_briefing = create_morning_briefing(
        inventory_metrics=inventory_metrics,
        finance_metrics=finance_metrics,
        order_suggestions=order_suggestions,
        risk_metrics=risk_metrics,
    )

    dashboard_metrics = upsert_dashboard_metrics(
        company_id=payload.company_id,
        inventory_metrics=inventory_metrics,
        finance_metrics=finance_metrics,
        order_suggestions=order_suggestions,
        risk_metrics=risk_metrics,
    )

    return {
        "success": True,
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
        "morning_briefing": morning_briefing,
        "dashboard_metrics": dashboard_metrics,
    }


@router.post("/")
def analyze_post(payload: AnalyzeRequest):
    return run_analysis(payload)


@router.post("")
def analyze_post_no_slash(payload: AnalyzeRequest):
    return run_analysis(payload)


@router.get("/")
def analyze_get():
    return {
        "success": True,
        "message": "Analiz için POST isteği ve üç dosya yolu gönderilmelidir.",
    }


@router.get("")
def analyze_get_no_slash():
    return {
        "success": True,
        "message": "Analiz için POST isteği ve üç dosya yolu gönderilmelidir.",
    }