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


@router.post("/")
def analyze():

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
            "message": "Company bulunamadı."
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

    inventory_df = inventory["df"]
    sales_df = sales["df"]
    product_df = product_sales["df"]

    inventory_metrics = None
    finance_metrics = None
    order_suggestions = None
    risk_metrics = None
    dashboard_metrics = None

    # Inventory Analysis
    if inventory_df is not None:
        inventory_metrics = calculate_inventory_metrics(
            inventory_df
        )

    # Finance Analysis
    if sales_df is not None:
        finance_metrics = calculate_finance_metrics(
            sales_df
        )

    # Order Suggestions
    if product_df is not None:
        order_suggestions = calculate_order_suggestions(
            product_df
        )

    # Risk Analysis
    risk_metrics = calculate_risk_metrics(
        inventory_df=inventory_df,
        product_df=product_df,
    )

    # Dashboard Metrics
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
        "dashboard_metrics": dashboard_metrics,
    }