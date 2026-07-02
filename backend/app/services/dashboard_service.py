from app.services.supabase_client import supabase


def upsert_dashboard_metrics(
    company_id: str,
    inventory_metrics=None,
    finance_metrics=None,
    order_suggestions=None,
    risk_metrics=None,
):
    payload = {
        "company_id": company_id,
    }

    if inventory_metrics and inventory_metrics.get("success"):
        payload["critical_stock_count"] = inventory_metrics.get(
            "critical_stock_count", 0
        )

    if finance_metrics and finance_metrics.get("success"):
        payload["total_turnover"] = finance_metrics.get(
            "total_turnover", 0
        )
        payload["average_sale"] = finance_metrics.get(
            "average_sale", 0
        )
        payload["transaction_count"] = finance_metrics.get(
            "transaction_count", 0
        )

    if order_suggestions and order_suggestions.get("success"):
        payload["estimated_order_budget"] = order_suggestions.get(
            "estimated_order_budget", 0
        )

    if risk_metrics and risk_metrics.get("success"):
        payload["risk_score"] = risk_metrics.get(
            "risk_score", 0
        )
        payload["zero_stock_count"] = risk_metrics.get(
            "zero_stock_count", 0
        )
        payload["over_stock_count"] = risk_metrics.get(
            "over_stock_count", 0
        )
        payload["critical_stock_count"] = risk_metrics.get(
            "critical_stock_count", 0
        )

    response = (
        supabase
        .table("dashboard_metrics")
        .upsert(
            payload,
            on_conflict="company_id",
        )
        .execute()
    )

    return response.data