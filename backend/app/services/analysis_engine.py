import pandas as pd


def calculate_inventory_metrics(df: pd.DataFrame):
    required_columns = ["Stok", "Kritik Stok"]

    for column in required_columns:
        if column not in df.columns:
            return {
                "success": False,
                "error": f"'{column}' kolonu bulunamadı.",
            }

    stock = pd.to_numeric(df["Stok"], errors="coerce").fillna(0)
    critical_stock = pd.to_numeric(df["Kritik Stok"], errors="coerce").fillna(0)

    total_products = int(len(df))

    critical_stock_count = int((stock <= critical_stock).sum())
    zero_stock_count = int((stock == 0).sum())
    over_stock_count = int((stock > (critical_stock * 3)).sum())

    risk_score = (
        round((critical_stock_count / total_products) * 100, 2)
        if total_products
        else 0
    )

    estimated_order_amount = int(
        (critical_stock - stock).clip(lower=0).sum()
    )

    estimated_lost_profit = int(
        critical_stock_count * 500
    )

    ai_suggestion_count = int(
        critical_stock_count + zero_stock_count + over_stock_count
    )

    return {
        "success": True,
        "total_products": total_products,
        "risk_score": risk_score,
        "critical_stock_count": critical_stock_count,
        "estimated_order_amount": estimated_order_amount,
        "estimated_lost_profit": estimated_lost_profit,
        "ai_suggestion_count": ai_suggestion_count,
        "zero_stock_count": zero_stock_count,
        "over_stock_count": over_stock_count,
    }