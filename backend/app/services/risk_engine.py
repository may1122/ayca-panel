import pandas as pd

from app.services.inventory_intelligence_engine import build_inventory_intelligence


def calculate_risk_metrics(inventory_df=None, product_df=None):
    if inventory_df is None or inventory_df.empty:
        return {
            "success": False,
            "error": "Envanter dosyası boş veya bulunamadı.",
            "risk_score": 0,
            "zero_stock_count": 0,
            "critical_stock_count": 0,
            "over_stock_count": 0,
            "dead_stock_count": 0,
            "dead_stock_value": 0,
            "risk_alerts": [],
            "risk_products": [],
            "capital_products": [],
            "stock_runout_products": [],
            "dead_stock_products": [],
        }

    intelligence, period_days = build_inventory_intelligence(
        inventory_df=inventory_df,
        product_df=product_df,
        target_stock_days=30,
        critical_days=5,
        warning_days=15,
    )

    if intelligence.empty:
        return {
            "success": False,
            "error": "Envanter dosyasında stok kolonu bulunamadı.",
            "risk_score": 0,
            "zero_stock_count": 0,
            "critical_stock_count": 0,
            "over_stock_count": 0,
            "dead_stock_count": 0,
            "dead_stock_value": 0,
            "risk_alerts": [],
            "risk_products": [],
            "capital_products": [],
            "stock_runout_products": [],
            "dead_stock_products": [],
        }

    zero_mask = (intelligence["stock"] <= 0) & (intelligence["sold_quantity"] > 0)
    critical_mask = (
        (intelligence["stock"] > 0)
        & (intelligence["daily_consumption"] > 0)
        & (intelligence["stock_days"] <= 5)
    )
    warning_mask = (
        (intelligence["stock"] > 0)
        & (intelligence["daily_consumption"] > 0)
        & (intelligence["stock_days"] > 5)
        & (intelligence["stock_days"] <= 15)
    )
    dead_mask = (intelligence["stock"] > 0) & (intelligence["sold_quantity"] <= 0)
    over_mask = (
        (intelligence["stock"] > 0)
        & (intelligence["sold_quantity"] > 0)
        & (intelligence["stock_days"] >= 90)
    )

    zero_count = int(zero_mask.sum())
    critical_count = int(critical_mask.sum())
    over_count = int(over_mask.sum())
    dead_count = int(dead_mask.sum())
    total = max(int(len(intelligence)), 1)

    weighted = zero_count * 3 + critical_count * 3 + int(warning_mask.sum()) * 2 + over_count + dead_count
    risk_score = min(round((weighted / (total * 3)) * 100, 2), 100)

    risk_products = []
    masks = [
        (zero_mask, "Sıfır Stok", "Kritik", "Acil tedarik/sipariş kontrolü yap."),
        (critical_mask, "Kritik Stok", "Kritik", "Stok bitiş süresine göre siparişi öne çek."),
        (warning_mask, "Stok Uyarısı", "Yüksek", "15 gün içinde stok planını güncelle."),
        (over_mask, "Fazla Stok", "Orta", "Siparişi yavaşlat ve satış hızını takip et."),
        (dead_mask, "Ölü Stok", "Orta", "İade, transfer veya kampanya aksiyonu değerlendir."),
    ]
    for mask, risk_type, level, action in masks:
        for _, row in intelligence[mask].head(15).iterrows():
            risk_products.append(
                {
                    "product_name": row["product_name"],
                    "risk_type": risk_type,
                    "stock": round(float(row["stock"]), 2),
                    "sold_quantity": round(float(row["sold_quantity"]), 2),
                    "stock_days": None if row["stock_days"] == float("inf") else round(float(row["stock_days"]), 1),
                    "level": level,
                    "recommended_action": action,
                }
            )

    capital = intelligence.sort_values("stock_value", ascending=False).head(20)
    capital_products = [
        {
            "product_name": row["product_name"],
            "stock": round(float(row["stock"]), 2),
            "sold_quantity": round(float(row["sold_quantity"]), 2),
            "stock_value": round(float(row["stock_value"]), 2),
            "status": row["stock_status"],
        }
        for _, row in capital.iterrows()
    ]

    runout = intelligence[
        (intelligence["daily_consumption"] > 0) & (intelligence["stock_days"] <= 30)
    ].sort_values("stock_days").head(50)
    stock_runout_products = [
        {
            "product_name": row["product_name"],
            "stock": round(float(row["stock"]), 2),
            "sold_quantity": round(float(row["sold_quantity"]), 2),
            "daily_consumption": round(float(row["daily_consumption"]), 2),
            "estimated_runout_days": round(float(row["stock_days"]), 1),
            "status": row["stock_status"],
        }
        for _, row in runout.iterrows()
    ]

    dead = intelligence[dead_mask].sort_values("stock_value", ascending=False).head(50)
    dead_stock_products = [
        {
            "product_name": row["product_name"],
            "stock": round(float(row["stock"]), 2),
            "stock_value": round(float(row["stock_value"]), 2),
            "sold_quantity": round(float(row["sold_quantity"]), 2),
            "recommended_action": "İade, transfer, kampanya veya sipariş durdurma değerlendir.",
        }
        for _, row in dead.iterrows()
    ]

    alerts = []
    if zero_count:
        alerts.append(f"{zero_count} ürün sıfır stokta.")
    if critical_count:
        alerts.append(f"{critical_count} ürünün tahmini stok ömrü 5 gün veya altında.")
    if dead_count:
        alerts.append(f"{dead_count} hareketsiz üründe sermaye bağlı.")
    if over_count:
        alerts.append(f"{over_count} üründe 90 gün ve üzeri stok karşılığı var.")

    return {
        "success": True,
        "analysis_period_days": period_days,
        "risk_score": risk_score,
        "zero_stock_count": zero_count,
        "critical_stock_count": critical_count,
        "warning_stock_count": int(warning_mask.sum()),
        "over_stock_count": over_count,
        "dead_stock_count": dead_count,
        "dead_stock_value": round(float(intelligence.loc[dead_mask, "stock_value"].sum()), 2),
        "risk_alerts": alerts,
        "risk_products": risk_products,
        "capital_products": capital_products,
        "stock_runout_products": stock_runout_products,
        "dead_stock_products": dead_stock_products,
    }
