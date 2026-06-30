from fastapi import APIRouter

from app.services.supabase_client import supabase
from app.services.excel_reader import (
    get_latest_file_upload,
    read_excel_from_storage,
    read_excel_dataframe_from_storage,
)
from app.services.analysis_engine import calculate_inventory_metrics

router = APIRouter(
    prefix="/analyze",
    tags=["Analyze"],
)


def summarize_file(company_id: str, file_type: str):
    uploaded_file = get_latest_file_upload(
        company_id=company_id,
        file_type=file_type,
    )

    if not uploaded_file:
        return {
            "file": None,
            "summary": None,
        }

    summary = read_excel_from_storage(
        uploaded_file["storage_path"]
    )

    return {
        "file": uploaded_file,
        "summary": summary,
    }


def upsert_dashboard_metrics(company_id: str, inventory_metrics: dict):
    if not inventory_metrics:
        return None

    payload = {
        "company_id": company_id,
        "risk_score": inventory_metrics.get("risk_score", 72.5),
        "critical_stock_count": inventory_metrics.get("critical_stock_count", 0),
        "estimated_lost_profit": inventory_metrics.get("estimated_lost_profit", 0),
        "estimated_order_amount": inventory_metrics.get("estimated_order_amount", 0),
        "ai_suggestion_count": inventory_metrics.get("ai_suggestion_count", 0),
    }

    result = (
        supabase
        .table("dashboard_metrics")
        .upsert(payload, on_conflict="company_id")
        .execute()
    )

    return result.data


@router.post("/")
def analyze():
    companies = (
        supabase
        .table("companies")
        .select("id,name,status")
        .limit(1)
        .execute()
    )

    company = companies.data[0]
    company_id = company["id"]

    inventory = summarize_file(company_id, "inventory")
    sales = summarize_file(company_id, "sales")
    product = summarize_file(company_id, "product")

    inventory_metrics = None
    dashboard_metrics = None

    if inventory["file"]:
        inventory_df = read_excel_dataframe_from_storage(
            inventory["file"]["storage_path"]
        )

        inventory_metrics = calculate_inventory_metrics(inventory_df)

        dashboard_metrics = upsert_dashboard_metrics(
            company_id=company_id,
            inventory_metrics=inventory_metrics,
        )

    return {
        "status": "ready",
        "company": company,
        "files": {
            "inventory": inventory,
            "sales": sales,
            "product": product,
        },
        "inventory_metrics": inventory_metrics,
        "dashboard_metrics": dashboard_metrics,
    }