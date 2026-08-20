from typing import Any


PRIORITY_WEIGHTS = {
    "ZERO_STOCK": 40,
    "CRITICAL_STOCK": 30,
    "WARNING_STOCK": 15,
    "OVER_STOCK": 10,
    "DEAD_STOCK": 10,
    "EXPIRY_RISK": 20,
    "EXPIRED": 40,
    "HIGH_ORDER_VALUE": 10,
    "HIGH_SALES_VELOCITY": 15,
}


def _safe_number(
    value: Any,
    default: float = 0.0,
) -> float:
    try:
        if value is None:
            return default

        return float(value)
    except (TypeError, ValueError):
        return default


def _priority_label(
    score: float,
) -> str:
    if score >= 80:
        return "Acil"

    if score >= 60:
        return "Yüksek"

    if score >= 35:
        return "Orta"

    return "Normal"


def _clamp_score(
    value: float,
) -> int:
    return int(
        max(
            0,
            min(
                100,
                round(value),
            ),
        )
    )


def _build_reason_codes(
    *,
    zero_stock_count: int,
    critical_stock_count: int,
    warning_stock_count: int,
    over_stock_count: int,
    dead_stock_count: int,
    expiry_warning_count: int,
    expired_count: int,
    suggestion_count: int,
    estimated_order_budget: float,
) -> list[str]:
    reason_codes: list[str] = []

    if zero_stock_count > 0:
        reason_codes.append(
            "ZERO_STOCK"
        )

    if critical_stock_count > 0:
        reason_codes.append(
            "CRITICAL_STOCK"
        )

    if warning_stock_count > 0:
        reason_codes.append(
            "WARNING_STOCK"
        )

    if over_stock_count > 0:
        reason_codes.append(
            "OVER_STOCK"
        )

    if dead_stock_count > 0:
        reason_codes.append(
            "DEAD_STOCK"
        )

    if expiry_warning_count > 0:
        reason_codes.append(
            "EXPIRY_RISK"
        )

    if expired_count > 0:
        reason_codes.append(
            "EXPIRED"
        )

    if (
        suggestion_count > 0
        and estimated_order_budget > 0
    ):
        reason_codes.append(
            "ORDER_ACTION_REQUIRED"
        )

    return reason_codes


def _calculate_priority_score(
    *,
    zero_stock_count: int,
    critical_stock_count: int,
    warning_stock_count: int,
    over_stock_count: int,
    dead_stock_count: int,
    expiry_warning_count: int,
    expired_count: int,
) -> int:
    score = 0.0

    if zero_stock_count > 0:
        score += PRIORITY_WEIGHTS[
            "ZERO_STOCK"
        ]

    if critical_stock_count > 0:
        score += min(
            30,
            critical_stock_count * 2,
        )

    if warning_stock_count > 0:
        score += min(
            15,
            warning_stock_count,
        )

    if over_stock_count > 0:
        score += min(
            10,
            over_stock_count * 0.5,
        )

    if dead_stock_count > 0:
        score += min(
            10,
            dead_stock_count * 0.5,
        )

    if expiry_warning_count > 0:
        score += min(
            20,
            expiry_warning_count,
        )

    if expired_count > 0:
        score += PRIORITY_WEIGHTS[
            "EXPIRED"
        ]

    return _clamp_score(
        score
    )


def _calculate_confidence_score(
    *,
    analysis_confidence_score: float,
    risk_success: bool,
    order_success: bool,
    finance_success: bool,
    expiry_success: bool,
) -> int:
    score = _safe_number(
        analysis_confidence_score,
        0,
    )

    if risk_success:
        score += 5

    if order_success:
        score += 5

    if finance_success:
        score += 5

    if expiry_success:
        score += 5

    return _clamp_score(
        score
    )


def _recommended_action(
    reason_codes: list[str],
) -> str:
    if "EXPIRED" in reason_codes:
        return (
            "Miadı geçmiş ürünleri raf ve stoktan ayırın; "
            "aynı gün içinde iade/imha sürecini kontrol edin."
        )

    if "ZERO_STOCK" in reason_codes:
        return (
            "Satışı devam eden sıfır stok ürünleri önceliklendirin "
            "ve acil tedarik kontrolü yapın."
        )

    if "CRITICAL_STOCK" in reason_codes:
        return (
            "Kritik stok ürünlerini satış hızı ve stok bitiş süresine "
            "göre sıralayıp siparişleri öne çekin."
        )

    if "EXPIRY_RISK" in reason_codes:
        return (
            "Miadı yaklaşan ürünlerde raf önceliği, transfer ve "
            "iade seçeneklerini değerlendirin."
        )

    if "OVER_STOCK" in reason_codes:
        return (
            "Fazla stoklu ürünlerde yeni siparişi yavaşlatın ve "
            "sermaye bağlı ürünleri önceliklendirin."
        )

    if "DEAD_STOCK" in reason_codes:
        return (
            "Hareketsiz ürünlerde iade, transfer veya kampanya "
            "aksiyonu değerlendirin."
        )

    return (
        "Kritik operasyon sinyali görünmüyor. "
        "Rutin stok ve finans takibi yeterli."
    )


def create_decision_summary(
    *,
    inventory_metrics: dict | None = None,
    finance_metrics: dict | None = None,
    order_suggestions: dict | None = None,
    risk_metrics: dict | None = None,
    expiry_metrics: dict | None = None,
    analysis_confidence_score: float = 0,
) -> dict:
    inventory_metrics = (
        inventory_metrics or {}
    )
    finance_metrics = (
        finance_metrics or {}
    )
    order_suggestions = (
        order_suggestions or {}
    )
    risk_metrics = (
        risk_metrics or {}
    )
    expiry_metrics = (
        expiry_metrics or {}
    )

    zero_stock_count = int(
        _safe_number(
            risk_metrics.get(
                "zero_stock_count"
            ),
            0,
        )
    )

    critical_stock_count = int(
        _safe_number(
            risk_metrics.get(
                "critical_stock_count"
            ),
            0,
        )
    )

    warning_stock_count = int(
        _safe_number(
            risk_metrics.get(
                "warning_stock_count"
            ),
            0,
        )
    )

    over_stock_count = int(
        _safe_number(
            risk_metrics.get(
                "over_stock_count"
            ),
            0,
        )
    )

    dead_stock_count = int(
        _safe_number(
            risk_metrics.get(
                "dead_stock_count"
            ),
            0,
        )
    )

    expiry_warning_count = int(
        _safe_number(
            expiry_metrics.get(
                "warning_count"
            ),
            0,
        )
    )

    expired_count = int(
        _safe_number(
            expiry_metrics.get(
                "expired_count"
            ),
            0,
        )
    )

    suggestion_count = int(
        _safe_number(
            order_suggestions.get(
                "suggestion_count"
            ),
            0,
        )
    )

    estimated_order_budget = (
        _safe_number(
            order_suggestions.get(
                "estimated_order_budget"
            ),
            0,
        )
    )

    reason_codes = (
        _build_reason_codes(
            zero_stock_count=zero_stock_count,
            critical_stock_count=critical_stock_count,
            warning_stock_count=warning_stock_count,
            over_stock_count=over_stock_count,
            dead_stock_count=dead_stock_count,
            expiry_warning_count=expiry_warning_count,
            expired_count=expired_count,
            suggestion_count=suggestion_count,
            estimated_order_budget=estimated_order_budget,
        )
    )

    priority_score = (
        _calculate_priority_score(
            zero_stock_count=zero_stock_count,
            critical_stock_count=critical_stock_count,
            warning_stock_count=warning_stock_count,
            over_stock_count=over_stock_count,
            dead_stock_count=dead_stock_count,
            expiry_warning_count=expiry_warning_count,
            expired_count=expired_count,
        )
    )

    confidence_score = (
        _calculate_confidence_score(
            analysis_confidence_score=analysis_confidence_score,
            risk_success=bool(
                risk_metrics.get(
                    "success"
                )
            ),
            order_success=bool(
                order_suggestions.get(
                    "success"
                )
            ),
            finance_success=bool(
                finance_metrics.get(
                    "success"
                )
            ),
            expiry_success=bool(
                expiry_metrics.get(
                    "success"
                )
            ),
        )
    )

    recommended_action = (
        _recommended_action(
            reason_codes
        )
    )

    return {
        "success": True,
        "priority_score": (
            priority_score
        ),
        "priority": (
            _priority_label(
                priority_score
            )
        ),
        "reason_codes": (
            reason_codes
        ),
        "recommended_action": (
            recommended_action
        ),
        "confidence_score": (
            confidence_score
        ),
        "summary": {
            "zero_stock_count": (
                zero_stock_count
            ),
            "critical_stock_count": (
                critical_stock_count
            ),
            "warning_stock_count": (
                warning_stock_count
            ),
            "over_stock_count": (
                over_stock_count
            ),
            "dead_stock_count": (
                dead_stock_count
            ),
            "expiry_warning_count": (
                expiry_warning_count
            ),
            "expired_count": (
                expired_count
            ),
            "suggestion_count": (
                suggestion_count
            ),
            "estimated_order_budget": round(
                estimated_order_budget,
                2,
            ),
        },
    }


