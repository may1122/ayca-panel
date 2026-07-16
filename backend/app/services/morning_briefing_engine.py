from typing import Any


def _safe_number(value: Any, default: float = 0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _calculate_health_score(
    risk_metrics: dict,
    inventory_metrics: dict,
) -> tuple[int, dict]:
    total_products = int(
        _safe_number(inventory_metrics.get("total_products"))
    )

    zero_stock_count = int(
        _safe_number(risk_metrics.get("zero_stock_count"))
    )

    critical_stock_count = int(
        _safe_number(risk_metrics.get("critical_stock_count"))
    )

    over_stock_count = int(
        _safe_number(risk_metrics.get("over_stock_count"))
    )

    if total_products <= 0:
        return 0, {
            "Ürün Bulunurluğu": 0,
            "Stok Dengesi": 0,
            "Risk Kontrolü": 0,
        }

    zero_ratio = zero_stock_count / total_products
    critical_ratio = critical_stock_count / total_products
    over_stock_ratio = over_stock_count / total_products

    availability_score = max(
        0,
        round(100 - zero_ratio * 100),
    )

    stock_balance_score = max(
        0,
        round(
            100
            - critical_ratio * 70
            - over_stock_ratio * 30
        ),
    )

    risk_control_score = max(
        0,
        round(
            100
            - zero_ratio * 100
            - critical_ratio * 50
            - over_stock_ratio * 20
        ),
    )

    score_items = {
        "Ürün Bulunurluğu": min(100, availability_score),
        "Stok Dengesi": min(100, stock_balance_score),
        "Risk Kontrolü": min(100, risk_control_score),
    }

    health_score = round(
        sum(score_items.values()) / len(score_items)
    )

    return health_score, score_items


def _health_status(score: int) -> str:
    if score >= 90:
        return "Sağlıklı"

    if score >= 75:
        return "Dikkat"

    if score >= 50:
        return "Riskli"

    return "Kritik"


def create_morning_briefing(
    inventory_metrics: dict | None = None,
    finance_metrics: dict | None = None,
    order_suggestions: dict | None = None,
    risk_metrics: dict | None = None,
) -> dict:
    inventory_metrics = inventory_metrics or {}
    finance_metrics = finance_metrics or {}
    order_suggestions = order_suggestions or {}
    risk_metrics = risk_metrics or {}

    score, score_items = _calculate_health_score(
        risk_metrics=risk_metrics,
        inventory_metrics=inventory_metrics,
    )

    zero_stock_count = int(
        _safe_number(risk_metrics.get("zero_stock_count"))
    )

    critical_stock_count = int(
        _safe_number(risk_metrics.get("critical_stock_count"))
    )

    over_stock_count = int(
        _safe_number(risk_metrics.get("over_stock_count"))
    )

    suggestion_count = int(
        _safe_number(order_suggestions.get("suggestion_count"))
    )

    estimated_order_budget = _safe_number(
        order_suggestions.get("estimated_order_budget")
    )

    total_turnover = _safe_number(
        finance_metrics.get("total_turnover")
    )

    average_sale = _safe_number(
        finance_metrics.get("average_sale")
    )

    transaction_count = int(
        _safe_number(finance_metrics.get("transaction_count"))
    )

    strong: list[str] = []
    watch: list[str] = []
    urgent: list[str] = []
    actions: list[str] = []

    if zero_stock_count == 0:
        strong.append(
            "Stokta tamamen tükenen ürün görünmüyor."
        )
    else:
        urgent.append(
            f"{zero_stock_count} ürünün stoğu sıfır veya altında."
        )
        actions.append(
            f"Stokta olmayan {zero_stock_count} ürünü kontrol edin."
        )

    if critical_stock_count == 0:
        strong.append(
            "Kritik stok seviyesinde ürün görünmüyor."
        )
    else:
        watch.append(
            f"{critical_stock_count} ürün kritik stok seviyesinde."
        )
        actions.append(
            f"Kritik stoktaki {critical_stock_count} ürünün sipariş ihtiyacını inceleyin."
        )

    if over_stock_count == 0:
        strong.append(
            "Belirgin bir fazla stok sinyali bulunmuyor."
        )
    else:
        watch.append(
            f"{over_stock_count} üründe fazla stok sinyali var."
        )
        actions.append(
            f"Fazla stok görünen {over_stock_count} üründeki bağlı sermayeyi kontrol edin."
        )

    if suggestion_count > 0:
        actions.append(
            f"{suggestion_count} ürün için oluşturulan sipariş önerisini değerlendirin."
        )
    else:
        strong.append(
            "Yeni sipariş önerisi gerektiren ürün görünmüyor."
        )

    if total_turnover > 0:
        strong.append(
            f"Analiz döneminde toplam ciro {total_turnover:,.2f} TL."
        )

    if not actions:
        actions.append(
            "Kritik aksiyon görünmüyor. Bugün genel takip yeterli."
        )

    if urgent:
        result = (
            "Acil stok riskleri bulunuyor. Öncelikle stoksuz ürünler "
            "ve ardından kritik sipariş listesi kontrol edilmeli."
        )
    elif watch:
        result = (
            "Genel durum kontrol altında ancak stok dengesi ve "
            "sipariş ihtiyaçları takip edilmeli."
        )
    else:
        result = (
            "Eczanenin mevcut stok görünümü sağlıklı. "
            "Rutin takip yeterli görünüyor."
        )

    return {
        "success": True,
        "score": score,
        "status": _health_status(score),
        "score_items": score_items,
        "top_actions": actions[:5],
        "strong": strong[:5],
        "watch": watch[:5],
        "urgent": urgent[:5],
        "result": result,
        "summary": {
            "zero_stock_count": zero_stock_count,
            "critical_stock_count": critical_stock_count,
            "over_stock_count": over_stock_count,
            "suggestion_count": suggestion_count,
            "estimated_order_budget": round(
                estimated_order_budget,
                2,
            ),
            "total_turnover": round(total_turnover, 2),
            "average_sale": round(average_sale, 2),
            "transaction_count": transaction_count,
        },
    }