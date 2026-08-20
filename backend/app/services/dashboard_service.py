from datetime import datetime, timezone

from app.services.supabase_client import supabase


def upsert_dashboard_metrics(
    company_id: str,
    inventory_metrics=None,
    finance_metrics=None,
    order_suggestions=None,
    risk_metrics=None,
):
    inventory_metrics = inventory_metrics or {}
    finance_metrics = finance_metrics or {}
    order_suggestions = order_suggestions or {}
    risk_metrics = risk_metrics or {}

    risk_success = bool(risk_metrics.get("success"))
    finance_success = bool(finance_metrics.get("success"))
    order_success = bool(order_suggestions.get("success"))

    payload = {
        "company_id": company_id,

        # Tek doğru kaynak: risk_engine.py
        "risk_score": (
            risk_metrics.get("risk_score")
            if risk_success
            else None
        ),
        "critical_stock_count": (
            risk_metrics.get("critical_stock_count")
            if risk_success
            else None
        ),
        "zero_stock_count": (
            risk_metrics.get("zero_stock_count")
            if risk_success
            else None
        ),
        "over_stock_count": (
            risk_metrics.get("over_stock_count")
            if risk_success
            else None
        ),

        # Tek doğru kaynak: order_engine.py
        "estimated_order_budget": (
            order_suggestions.get("estimated_order_budget")
            if order_success
            else None
        ),
        "ai_suggestion_count": (
            order_suggestions.get("suggestion_count")
            if order_success
            else None
        ),

        # Legacy alanlar artık kullanılmıyor.
        # Null yazarak önceki analizlerden kalmış sahte/eski değerleri temizliyoruz.
        "estimated_lost_profit": None,
        "estimated_order_amount": None,

        # Tek doğru kaynak: finance_engine.py
        "total_turnover": (
            finance_metrics.get("total_turnover")
            if finance_success
            else None
        ),
        "average_sale": (
            finance_metrics.get("average_sale")
            if finance_success
            else None
        ),
        "transaction_count": (
            finance_metrics.get("transaction_count")
            if finance_success
            else None
        ),

        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

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