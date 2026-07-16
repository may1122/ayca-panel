from fastapi import APIRouter

from app.services.supabase_client import supabase
from app.services.excel_reader import (
    get_latest_file_upload,
    read_excel_dataframe_from_storage,
)
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


def load_latest_dataframe(company_id: str, file_type: str):
    uploaded_file = get_latest_file_upload(
        company_id=company_id,
        file_type=file_type,
    )

    if not uploaded_file:
        return {
            "file": None,
            "df": None,
        }

    df = read_excel_dataframe_from_storage(
        uploaded_file["storage_path"]
    )

    return {
        "file": uploaded_file,
        "df": df,
    }


def run_analysis():
    companies = (
        supabase
        .table("companies")
        .select("id,name,status")
        .limit(1)
        .execute()
    )

    if not companies.data:
        return {
            "success": False,
            "message": "Company bulunamadı.",
        }

    company = companies.data[0]
    company_id = company["id"]

    inventory = load_latest_dataframe(
        company_id,
        "inventory",
    )

    sales = load_latest_dataframe(
        company_id,
        "sales",
    )

    product_sales = load_latest_dataframe(
        company_id,
        "product_sales",
    )

    if product_sales["df"] is None:
        product_sales = load_latest_dataframe(
            company_id,
            "product",
        )

    inventory_df = inventory["df"]
    sales_df = sales["df"]
    product_df = product_sales["df"]

    inventory_metrics = None
    finance_metrics = None
    order_suggestions = None
    risk_metrics = None
    morning_briefing = None

    if inventory_df is not None:
        inventory_metrics = calculate_inventory_metrics(
            inventory_df
        )

    if sales_df is not None:
        finance_metrics = calculate_finance_metrics(
            sales_df
        )

    if inventory_df is not None:
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
        company_id=company_id,
        inventory_metrics=inventory_metrics,
        finance_metrics=finance_metrics,
        order_suggestions=order_suggestions,
        risk_metrics=risk_metrics,
    )

    return {
        "success": True,
        "company": company,
        "files": {
            "inventory": inventory["file"],
            "sales": sales["file"],
            "product_sales": product_sales["file"],
        },
        "inventory_metrics": inventory_metrics,
        "finance_metrics": finance_metrics,
        "order_suggestions": order_suggestions,
        "risk_metrics": risk_metrics,
        "morning_briefing": morning_briefing,
        "dashboard_metrics": dashboard_metrics,
    }


@router.get("/")
def analyze_get():
    return run_analysis()


@router.post("/")
def analyze_post():
    return run_analysis()


@router.get("")
def analyze_get_no_slash():
    return run_analysis()


@router.post("")
def analyze_post_no_slash():
    return run_analysis()