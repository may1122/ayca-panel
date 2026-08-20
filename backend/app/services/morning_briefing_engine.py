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


def _clamp_score(value: float) -> int:
    return int(max(0, min(100, round(value))))


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

    total_products = int(_safe_number(inventory_metrics.get("total_products"), 0))

    zero_stock_count = int(_safe_number(risk_metrics.get("zero_stock_count"), 0))
    critical_stock_count = int(_safe_number(risk_metrics.get("critical_stock_count"), 0))
    warning_stock_count = int(_safe_number(risk_metrics.get("warning_stock_count"), 0))
    over_stock_count = int(_safe_number(risk_metrics.get("over_stock_count"), 0))
    dead_stock_count = int(_safe_number(risk_metrics.get("dead_stock_count"), 0))
    risk_score = _safe_number(risk_metrics.get("risk_score"), 0)

    expiry_warning_count = int(_safe_number(expiry_metrics.get("warning_count"), 0))
    expired_count = int(_safe_number(expiry_metrics.get("expired_count"), 0))

    suggestion_count = int(_safe_number(order_suggestions.get("suggestion_count"), 0))
    estimated_order_budget = _safe_number(
        order_suggestions.get("estimated_order_budget"),
        0,
    )

    total_turnover = _safe_number(finance_metrics.get("total_turnover"), 0)
    average_sale = _safe_number(finance_metrics.get("average_sale"), 0)
    transaction_count = int(_safe_number(finance_metrics.get("transaction_count"), 0))
    total_profit = _safe_number(finance_metrics.get("total_profit"), 0)
    profit_margin = _safe_number(finance_metrics.get("profit_margin"), 0)

    inventory_success = bool(inventory_metrics.get("success"))
    finance_success = bool(finance_metrics.get("success"))
    risk_success = bool(risk_metrics.get("success"))
    order_success = bool(order_suggestions.get("success"))
    expiry_success = bool(expiry_metrics.get("success"))

    # ---------------------------------------------------------
    # HEALTH SCORE
    # ---------------------------------------------------------
    # Skor açıklanabilir operasyon metriklerinden oluşur.
    # Finansal performans brifingde gösterilir; sağlık skorunu doğrudan
    # yükseltmez/düşürmez. Acil operasyon riskleri ayrıca skor tavanı uygular.
    score_items: dict[str, int] = {}

    if total_products > 0 and inventory_success:
        availability_score = _clamp_score(
            100
            - (zero_stock_count / total_products) * 100
        )

        stock_score = _clamp_score(
            100
            - (critical_stock_count / total_products) * 60
            - (warning_stock_count / total_products) * 20
            - (over_stock_count / total_products) * 10
            - (dead_stock_count / total_products) * 10
        )

        score_items["Ürün Bulunurluğu"] = availability_score
        score_items["Stok Dengesi"] = stock_score

    if total_products > 0 and expiry_success:
        expiry_score = _clamp_score(
            100
            - (expiry_warning_count / total_products) * 30
            - (expired_count / total_products) * 100
        )
        score_items["Miad Yönetimi"] = expiry_score

    if risk_success:
        score_items["Risk Kontrolü"] = _clamp_score(
            100 - risk_score
        )

    if score_items:
        score = round(
            sum(score_items.values()) / len(score_items)
        )
    else:
        score = 0

    # Kritik operasyon sinyalleri ortalama tarafından gizlenmemeli.
    # Bu kurallar bir "iş kuralı tavanı"dır ve tamamen açıklanabilirdir.
    severity_caps: list[dict] = []

    if zero_stock_count > 0 and expired_count > 0:
        score = min(score, 64)
        severity_caps.append(
            {
                "reason": "Aktif sıfır stok ve miadı geçmiş ürün birlikte bulundu.",
                "max_score": 64,
            }
        )
    else:
        if zero_stock_count > 0:
            score = min(score, 74)
            severity_caps.append(
                {
                    "reason": "Aktif satışı olan sıfır stok ürün bulundu.",
                    "max_score": 74,
                }
            )

        if expired_count > 0:
            score = min(score, 69)
            severity_caps.append(
                {
                    "reason": "Miadı geçmiş ürün bulundu.",
                    "max_score": 69,
                }
            )

    if (
        total_products > 0
        and critical_stock_count / total_products >= 0.10
    ):
        score = min(score, 74)
        severity_caps.append(
            {
                "reason": "Ürünlerin en az %10'u kritik stok seviyesinde.",
                "max_score": 74,
            }
        )

    # ---------------------------------------------------------
    # DATA QUALITY / CONFIDENCE
    # ---------------------------------------------------------
    quality_checks = {
        "inventory_metrics": inventory_success,
        "risk_metrics": risk_success,
        "order_suggestions": order_success,
        "finance_metrics": finance_success,
        "expiry_metrics": expiry_success,
    }

    successful_checks = sum(
        1 for value in quality_checks.values() if value
    )

    confidence_score = round(
        successful_checks
        / max(len(quality_checks), 1)
        * 100
    )

    data_warnings: list[str] = []

    for source in (
        risk_metrics,
        order_suggestions,
        finance_metrics,
    ):
        for warning in source.get("warnings", []):
            warning_text = str(warning)
            if warning_text not in data_warnings:
                data_warnings.append(warning_text)

    if not inventory_success:
        error = inventory_metrics.get(
            "error",
            "Envanter özeti doğrulanamadı.",
        )
        if str(error) not in data_warnings:
            data_warnings.append(str(error))

    if not expiry_success:
        expiry_error = expiry_metrics.get("error")
        if expiry_error and str(expiry_error) not in data_warnings:
            data_warnings.append(str(expiry_error))

    # ---------------------------------------------------------
    # BRIEFING TEXT
    # ---------------------------------------------------------
    strong: list[str] = []
    watch: list[str] = []
    urgent: list[str] = []
    actions: list[str] = []

    if zero_stock_count:
        urgent.append(
            f"{zero_stock_count} ürünün stoğu sıfır."
        )
        actions.append(
            f"Stokta olmayan {zero_stock_count} ürünü acil kontrol edin."
        )
    elif risk_success:
        strong.append(
            "Stokta tamamen tükenen aktif ürün görünmüyor."
        )

    if critical_stock_count:
        watch.append(
            f"{critical_stock_count} ürün kritik stok seviyesinde."
        )
        actions.append(
            f"{critical_stock_count} kritik ürünün siparişini öne çekin."
        )
    elif risk_success:
        strong.append(
            "Kritik stok seviyesinde ürün görünmüyor."
        )

    if warning_stock_count:
        watch.append(
            f"{warning_stock_count} ürün stok uyarı seviyesinde."
        )

    if expired_count:
        urgent.append(
            f"{expired_count} ürünün miadı geçmiş görünüyor."
        )
        actions.append(
            f"Miadı geçmiş {expired_count} ürünü raf/stoktan ayırın ve kontrol edin."
        )
    elif expiry_warning_count:
        watch.append(
            f"{expiry_warning_count} ürün miad uyarı penceresinde."
        )
        actions.append(
            f"Miadı yaklaşan {expiry_warning_count} ürüne raf önceliği verin."
        )
    elif expiry_success:
        strong.append(
            "Yakın miad baskısı düşük görünüyor."
        )

    if dead_stock_count:
        watch.append(
            f"{dead_stock_count} üründe doğrulanmış hareketsizlik tespit edildi."
        )
        actions.append(
            f"{dead_stock_count} ölü stok ürünü için iade/transfer/kampanya planlayın."
        )

    if over_stock_count:
        watch.append(
            f"{over_stock_count} üründe 90 gün ve üzeri stok karşılığı var."
        )
        actions.append(
            f"{over_stock_count} fazla stok ürününde yeni siparişi yavaşlatın."
        )

    if suggestion_count:
        actions.append(
            f"{suggestion_count} ürün için sipariş önerisini değerlendirin."
        )
    elif order_success:
        strong.append(
            "Yeni sipariş önerisi gerektiren ürün görünmüyor."
        )

    if finance_success and total_turnover > 0:
        strong.append(
            f"Analiz döneminde toplam ciro {total_turnover:,.2f} TL."
        )

    if finance_success and finance_metrics.get("profit_source"):
        strong.append(
            f"Doğrulanmış toplam kâr {total_profit:,.2f} TL, "
            f"kâr marjı %{profit_margin:.2f}."
        )

    if not actions:
        actions.append(
            "Kritik aksiyon görünmüyor. Bugün genel takip yeterli."
        )

    if urgent:
        result = (
            "Acil stok veya miad riski bulunuyor. "
            "Öncelik kırmızı aksiyonlarda olmalı."
        )
    elif watch:
        result = (
            "Genel durum kontrol altında; stok, miad "
            "ve sipariş sinyallerini takip edin."
        )
    else:
        result = (
            "Eczanenin mevcut görünümü sağlıklı. "
            "Rutin takip yeterli görünüyor."
        )

    if confidence_score < 100:
        result += (
            f" Veri güveni %{confidence_score}; "
            "eksik veya varsayılan hesaplar için veri uyarılarını kontrol edin."
        )

    return {
        "success": True,
        "score": score,
        "status": _health_status(score),
        "score_items": score_items,
        "severity_caps": severity_caps,
        "risk_score": round(risk_score, 2),
        "confidence_score": confidence_score,
        "quality_checks": quality_checks,
        "data_warnings": data_warnings[:10],
        "top_actions": actions[:5],
        "strong": strong[:5],
        "watch": watch[:5],
        "urgent": urgent[:5],
        "result": result,
        "summary": {
            "total_products": total_products,
            "zero_stock_count": zero_stock_count,
            "critical_stock_count": critical_stock_count,
            "warning_stock_count": warning_stock_count,
            "over_stock_count": over_stock_count,
            "dead_stock_count": dead_stock_count,
            "expiry_warning_count": expiry_warning_count,
            "expired_count": expired_count,
            "suggestion_count": suggestion_count,
            "estimated_order_budget": round(estimated_order_budget, 2),
            "total_turnover": round(total_turnover, 2),
            "average_sale": round(average_sale, 2),
            "transaction_count": transaction_count,
            "total_profit": round(total_profit, 2),
            "profit_margin": round(profit_margin, 2),
        },
    }