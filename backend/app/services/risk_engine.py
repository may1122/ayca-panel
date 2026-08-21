import math

import pandas as pd

from app.services.data_quality import estimate_period_days
from app.services.inventory_intelligence_engine import build_inventory_intelligence


CRITICAL_STOCK_DAYS = 5
WARNING_STOCK_DAYS = 15
OVER_STOCK_DAYS = 90
DEAD_STOCK_MIN_PERIOD_DAYS = 60


def _empty_result(error: str) -> dict:
    return {
        "success": False,
        "error": error,
        "analysis_period_days": 0,
        "analysis_period_assumed": True,
        "risk_score": 0,
        "zero_stock_count": 0,
        "critical_stock_count": 0,
        "warning_stock_count": 0,
        "over_stock_count": 0,
        "dead_stock_count": 0,
        "dead_stock_value": 0,
        "risk_alerts": [],
        "warnings": [],
        "risk_products": [],
        "capital_products": [],
        "stock_runout_products": [],
        "dead_stock_products": [],
        "risk_score_components": {
            "zero_stock": 0,
            "critical_stock": 0,
            "warning_stock": 0,
            "over_stock": 0,
            "dead_stock": 0,
        },
    }


def _safe_stock_days(value):
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if math.isinf(numeric) or math.isnan(numeric):
        return None

    return round(numeric, 1)


def calculate_risk_metrics(
    inventory_df=None,
    product_df=None,
    sales_df=None,
):
    if inventory_df is None or inventory_df.empty:
        return _empty_result(
            "Envanter dosyası boş veya bulunamadı."
        )

    intelligence, period_days = build_inventory_intelligence(
        inventory_df=inventory_df,
        product_df=product_df,
        period_df=sales_df,
        target_stock_days=30,
        critical_days=CRITICAL_STOCK_DAYS,
        warning_days=WARNING_STOCK_DAYS,
    )

    if intelligence.empty:
        return _empty_result(
            "Envanter dosyasında stok kolonu bulunamadı."
        )

    period_source_df = (
        sales_df
        if sales_df is not None and not sales_df.empty
        else product_df
    )

    _, period_assumed = estimate_period_days(
        period_source_df,
        default_days=30,
    )

    has_sales = intelligence["sold_quantity"] > 0
    has_stock = intelligence["stock"] > 0

    # 1) Sıfır stok:
    # Sadece analiz döneminde satış hareketi olan ürünlerde stok <= 0 ise risk sayılır.
    zero_mask = (
        (intelligence["stock"] <= 0)
        & has_sales
    )

    # 2) Kritik stok:
    # Kullanıcının tanımladığı kritik/minimum stok seviyesi VEYA
    # satış hızına göre 5 gün ve altı stok ömrü.
    user_critical_mask = (
        has_stock
        & has_sales
        & (intelligence["critical_stock"] > 0)
        & (
            intelligence["stock"]
            <= intelligence["critical_stock"]
        )
    )

    consumption_critical_mask = (
        has_stock
        & (intelligence["daily_consumption"] > 0)
        & (
            intelligence["stock_days"]
            <= CRITICAL_STOCK_DAYS
        )
    )

    critical_mask = (
        (user_critical_mask | consumption_critical_mask)
        & ~zero_mask
    )

    # 3) Uyarı:
    # Kritik olmayan, ancak 15 gün veya daha az stok ömrü olan ürün.
    warning_mask = (
        has_stock
        & (intelligence["daily_consumption"] > 0)
        & (
            intelligence["stock_days"]
            <= WARNING_STOCK_DAYS
        )
        & ~critical_mask
    )

    # 4) Fazla stok:
    # Satışı olan ve 90 gün veya üzeri stok karşılığı taşıyan ürün.
    over_mask = (
        has_stock
        & has_sales
        & (
            intelligence["stock_days"]
            >= OVER_STOCK_DAYS
        )
        & ~critical_mask
        & ~warning_mask
    )

    # 5) Ölü stok:
    # 30 günlük veya varsayımsal veriyle kesin "ölü stok" demiyoruz.
    # En az 60 günlük doğrulanmış analiz döneminde hiç satışı olmayan,
    # fakat stokta bulunan ürünler ölü stok kabul edilir.
    dead_stock_eligible = (
        not period_assumed
        and period_days >= DEAD_STOCK_MIN_PERIOD_DAYS
    )

    if dead_stock_eligible:
        dead_mask = (
            has_stock
            & ~has_sales
        )
    else:
        dead_mask = pd.Series(
            False,
            index=intelligence.index,
        )

    zero_count = int(zero_mask.sum())
    critical_count = int(critical_mask.sum())
    warning_count = int(warning_mask.sum())
    over_count = int(over_mask.sum())
    dead_count = int(dead_mask.sum())

    total = max(int(len(intelligence)), 1)

    # Açıklanabilir, sabit ağırlıklı operasyon riski.
    # En yüksek ağırlık: sıfır stok ve kritik stok.
    weighted = (
        zero_count * 3
        + critical_count * 3
        + warning_count * 2
        + over_count
        + dead_count
    )

    max_weighted = total * 3

    risk_score = min(
        round(
            (weighted / max_weighted) * 100,
            2,
        ),
        100,
    )

    risk_products = []

    masks = [
        (
            zero_mask,
            "Sıfır Stok",
            "Kritik",
            "Acil tedarik ve sipariş kontrolü yap.",
        ),
        (
            critical_mask,
            "Kritik Stok",
            "Kritik",
            "Minimum stok seviyesi ve stok bitiş süresine göre siparişi öne çek.",
        ),
        (
            warning_mask,
            "Stok Uyarısı",
            "Yüksek",
            "15 gün içinde stok planını güncelle.",
        ),
        (
            over_mask,
            "Fazla Stok",
            "Orta",
            "Siparişi yavaşlat ve satış hızını takip et.",
        ),
        (
            dead_mask,
            "Ölü Stok",
            "Orta",
            "İade, transfer veya kampanya aksiyonu değerlendir.",
        ),
    ]

    for mask, risk_type, level, action in masks:
        for _, row in intelligence[mask].head(15).iterrows():
            risk_products.append(
                {
                    "product_name": row["product_name"],
                    "risk_type": risk_type,
                    "stock": round(
                        float(row["stock"]),
                        2,
                    ),
                    "critical_stock": round(
                        float(row["critical_stock"]),
                        2,
                    ),
                    "sold_quantity": round(
                        float(row["sold_quantity"]),
                        2,
                    ),
                    "stock_days": _safe_stock_days(
                        row["stock_days"]
                    ),
                    "level": level,
                    "recommended_action": action,
                }
            )

    capital = (
        intelligence.sort_values(
            "stock_value",
            ascending=False,
        )
        .head(20)
    )

    capital_products = [
        {
            "product_name": row["product_name"],
            "stock": round(
                float(row["stock"]),
                2,
            ),
            "sold_quantity": round(
                float(row["sold_quantity"]),
                2,
            ),
            "stock_value": round(
                float(row["stock_value"]),
                2,
            ),
            "status": row["stock_status"],
        }
        for _, row in capital.iterrows()
    ]

    runout = (
        intelligence[
            (intelligence["daily_consumption"] > 0)
            & (intelligence["stock_days"] <= 30)
        ]
        .sort_values("stock_days")
        .head(50)
    )

    stock_runout_products = [
        {
            "product_name": row["product_name"],
            "stock": round(
                float(row["stock"]),
                2,
            ),
            "sold_quantity": round(
                float(row["sold_quantity"]),
                2,
            ),
            "daily_consumption": round(
                float(row["daily_consumption"]),
                2,
            ),
            "estimated_runout_days": round(
                float(row["stock_days"]),
                1,
            ),
            "status": row["stock_status"],
        }
        for _, row in runout.iterrows()
    ]

    dead = (
        intelligence[dead_mask]
        .sort_values(
            "stock_value",
            ascending=False,
        )
        .head(50)
    )

    dead_stock_products = [
        {
            "product_name": row["product_name"],
            "stock": round(
                float(row["stock"]),
                2,
            ),
            "stock_value": round(
                float(row["stock_value"]),
                2,
            ),
            "sold_quantity": round(
                float(row["sold_quantity"]),
                2,
            ),
            "recommended_action": (
                "İade, transfer, kampanya veya sipariş "
                "durdurma değerlendir."
            ),
        }
        for _, row in dead.iterrows()
    ]

    alerts = []

    if zero_count:
        alerts.append(
            f"{zero_count} ürün sıfır stokta."
        )

    if critical_count:
        alerts.append(
            f"{critical_count} ürün kritik stok seviyesinde."
        )

    if warning_count:
        alerts.append(
            f"{warning_count} ürünün tahmini stok ömrü "
            f"{WARNING_STOCK_DAYS} gün veya altında."
        )

    if dead_count:
        alerts.append(
            f"{dead_count} hareketsiz üründe sermaye bağlı."
        )

    if over_count:
        alerts.append(
            f"{over_count} üründe {OVER_STOCK_DAYS} gün "
            "ve üzeri stok karşılığı var."
        )

    warnings = []

    if period_assumed:
        warnings.append(
            "Satış dönemi tarih kolonundan doğrulanamadı; "
            "30 gün varsayıldı."
        )

    if not dead_stock_eligible:
        if period_assumed:
            warnings.append(
                "Ölü stok analizi yapılmadı; satış dönemi "
                "doğrulanamadı."
            )
        elif period_days < DEAD_STOCK_MIN_PERIOD_DAYS:
            warnings.append(
                "Ölü stok analizi yapılmadı; güvenilir ölü stok "
                f"tespiti için en az {DEAD_STOCK_MIN_PERIOD_DAYS} "
                "günlük satış verisi gerekir."
            )

    return {
        "success": True,
        "analysis_period_days": period_days,
        "analysis_period_assumed": period_assumed,
        "risk_score": risk_score,
        "risk_score_components": {
            "zero_stock": zero_count,
            "critical_stock": critical_count,
            "warning_stock": warning_count,
            "over_stock": over_count,
            "dead_stock": dead_count,
        },
        "zero_stock_count": zero_count,
        "critical_stock_count": critical_count,
        "warning_stock_count": warning_count,
        "over_stock_count": over_count,
        "dead_stock_count": dead_count,
        "dead_stock_value": round(
            float(
                intelligence.loc[
                    dead_mask,
                    "stock_value",
                ].sum()
            ),
            2,
        ),
        "risk_alerts": alerts,
        "warnings": warnings,
        "risk_products": risk_products,
        "capital_products": capital_products,
        "stock_runout_products": stock_runout_products,
        "dead_stock_products": dead_stock_products,
    }