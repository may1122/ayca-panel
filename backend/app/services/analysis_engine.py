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

    critical_stock_count = int((stock <= critical_stock).sum())

    total_products = int(len(df))
    risk_score = round((critical_stock_count / total_products) * 100, 2) if total_products else 0

    return {
        "success": True,
        "total_products": total_products,
        "critical_stock_count": critical_stock_count,
        "risk_score": risk_score,
    }