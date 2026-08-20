from typing import Any


def _safe_number(value: Any, default: float = 0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


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
    expiry_metrics: dict | None = None,
) -> dict:
    inventory_metrics = inventory_metrics or {}
    finance_metrics = finance_metrics or {}
    order_suggestions = order_suggestions or {}
    risk_metrics = risk_metrics or {}
    expiry_metrics = expiry_metrics or {}

    total_products = int(_safe_number(inventory_metrics.get("total_products")))
    zero_stock_count = int(_safe_number(risk_metrics.get("zero_stock_count")))
    critical_stock_count = int(_safe_number(risk_metrics.get("critical_stock_count")))
    over_stock_count = int(_safe_number(risk_metrics.get("over_stock_count")))
    dead_stock_count = int(_safe_number(risk_metrics.get("dead_stock_count")))
    expiry_warning_count = int(_safe_number(expiry_metrics.get("warning_count")))
    expired_count = int(_safe_number(expiry_metrics.get("expired_count")))

    if total_products > 0:
        availability_score = max(0, 100 - round((zero_stock_count / total_products) * 100))
        stock_score = max(
            0,
            round(
                100
                - (critical_stock_count / total_products) * 60
                - (over_stock_count / total_products) * 20
                - (dead_stock_count / total_products) * 20
            ),
        )
        expiry_score = max(
            0,
            round(100 - ((expiry_warning_count + expired_count * 2) / total_products) * 70),
        )
    else:
        availability_score = stock_score = expiry_score = 0

    score_items = {
        "Ürün Bulunurluğu": min(100, availability_score),
        "Stok Dengesi": min(100, stock_score),
        "Miad Yönetimi": min(100, expiry_score),
    }
    score = round(sum(score_items.values()) / max(len(score_items), 1))

    suggestion_count = int(_safe_number(order_suggestions.get("suggestion_count")))
    estimated_order_budget = _safe_number(order_suggestions.get("estimated_order_budget"))
    total_turnover = _safe_number(finance_metrics.get("total_turnover"))
    average_sale = _safe_number(finance_metrics.get("average_sale"))
    transaction_count = int(_safe_number(finance_metrics.get("transaction_count")))

    strong: list[str] = []
    watch: list[str] = []
    urgent: list[str] = []
    actions: list[str] = []

    if zero_stock_count:
        urgent.append(f"{zero_stock_count} ürünün stoğu sıfır.")
        actions.append(f"Stokta olmayan {zero_stock_count} ürünü acil kontrol edin.")
    else:
        strong.append("Stokta tamamen tükenen ürün görünmüyor.")

    if critical_stock_count:
        watch.append(f"{critical_stock_count} ürünün tahmini stok ömrü 5 gün veya altında.")
        actions.append(f"{critical_stock_count} kritik ürünün siparişini öne çekin.")
    else:
        strong.append("5 gün içinde bitecek kritik ürün görünmüyor.")

    if expired_count:
        urgent.append(f"{expired_count} ürünün miadı geçmiş görünüyor.")
        actions.append(f"Miadı geçmiş {expired_count} ürünü raf/stoktan ayırın ve kontrol edin.")
    elif expiry_warning_count:
        watch.append(f"{expiry_warning_count} ürün miad uyarı penceresinde.")
        actions.append(f"Miadı yaklaşan {expiry_warning_count} ürüne raf önceliği verin.")
    elif expiry_metrics.get("success"):
        strong.append("Yakın miad baskısı düşük görünüyor.")

    if dead_stock_count:
        watch.append(f"{dead_stock_count} üründe hareket görünmüyor.")
        actions.append(f"{dead_stock_count} ölü stok ürünü için iade/transfer/kampanya planlayın.")

    if over_stock_count:
        watch.append(f"{over_stock_count} üründe 90 gün ve üzeri stok karşılığı var.")

    if suggestion_count:
        actions.append(f"{suggestion_count} ürün için sipariş önerisini değerlendirin.")
    else:
        strong.append("Yeni sipariş önerisi gerektiren ürün görünmüyor.")

    if total_turnover > 0:
        strong.append(f"Analiz döneminde toplam ciro {total_turnover:,.2f} TL.")

    if not actions:
        actions.append("Kritik aksiyon görünmüyor. Bugün genel takip yeterli.")

    result = (
        "Acil stok veya miad riski bulunuyor. Öncelik kırmızı aksiyonlarda olmalı."
        if urgent
        else "Genel durum kontrol altında; stok, miad ve sipariş sinyallerini takip edin."
        if watch
        else "Eczanenin mevcut görünümü sağlıklı. Rutin takip yeterli görünüyor."
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
            "dead_stock_count": dead_stock_count,
            "expiry_warning_count": expiry_warning_count,
            "expired_count": expired_count,
            "suggestion_count": suggestion_count,
            "estimated_order_budget": round(estimated_order_budget, 2),
            "total_turnover": round(total_turnover, 2),
            "average_sale": round(average_sale, 2),
            "transaction_count": transaction_count,
        },
    }
