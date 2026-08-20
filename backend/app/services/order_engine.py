import pandas as pd

from app.services.inventory_intelligence_engine import build_inventory_intelligence


def calculate_order_suggestions(
    inventory_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
    target_stock_days: int = 30,
):
    if inventory_df is None or inventory_df.empty:
        return {
            "success": False,
            "error": "Envanter dosyası boş veya bulunamadı.",
            "suggestion_count": 0,
            "estimated_order_budget": 0,
            "top_suggestions": [],
        }

    intelligence, period_days = build_inventory_intelligence(
        inventory_df=inventory_df,
        product_df=product_df,
        target_stock_days=target_stock_days,
    )

    if intelligence.empty:
        return {
            "success": False,
            "error": "Sipariş analizi için stok kolonu bulunamadı.",
            "suggestion_count": 0,
            "estimated_order_budget": 0,
            "top_suggestions": [],
        }

    suggestions = intelligence[
        (intelligence["sold_quantity"] > 0)
        & (intelligence["recommended_order"] > 0)
    ].copy()

    def priority(row):
        if row["stock"] <= 0:
            return "Yüksek"
        if row["stock_days"] <= 5:
            return "Yüksek"
        if row["stock_days"] <= 15:
            return "Orta"
        return "Normal"

    suggestions["priority"] = suggestions.apply(priority, axis=1)
    priority_order = {"Yüksek": 3, "Orta": 2, "Normal": 1}
    suggestions["_priority"] = suggestions["priority"].map(priority_order).fillna(0)
    suggestions = suggestions.sort_values(
        ["_priority", "recommended_order", "estimated_order_value"],
        ascending=[False, False, False],
    )

    records = []
    for _, row in suggestions.head(50).iterrows():
        stock_days = None if row["stock_days"] == float("inf") else round(float(row["stock_days"]), 1)
        records.append(
            {
                "Ürün Adı": row["product_name"],
                "Stok": round(float(row["stock"]), 2),
                "Satılan Adet": round(float(row["sold_quantity"]), 2),
                "Günlük Tüketim": round(float(row["daily_consumption"]), 2),
                "Stok Gün Karşılığı": stock_days,
                "Hedef Stok": int(row["target_stock"]),
                "Önerilen Sipariş": int(row["recommended_order"]),
                "Tahmini Sipariş Tutarı": round(float(row["estimated_order_value"]), 2),
                "Öncelik": row["priority"],
            }
        )

    return {
        "success": True,
        "analysis_period_days": period_days,
        "target_stock_days": target_stock_days,
        "suggestion_count": int(len(suggestions)),
        "estimated_order_budget": round(float(suggestions["estimated_order_value"].sum()), 2),
        "top_suggestions": records,
    }
