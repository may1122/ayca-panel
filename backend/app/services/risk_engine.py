import pandas as pd


def calculate_risk_metrics(
    inventory_df=None,
    product_df=None,
):
    risk_alerts = []

    zero_stock_count = 0
    over_stock_count = 0
    critical_stock_count = 0
    total_products = 0

    if inventory_df is not None:
        df = inventory_df.copy()
        total_products = int(len(df))

        if "Stok" in df.columns:
            stock = pd.to_numeric(df["Stok"], errors="coerce").fillna(0)

            zero_stock_count = int((stock <= 0).sum())

            if zero_stock_count > 0:
                risk_alerts.append({
                    "type": "zero_stock",
                    "level": "high",
                    "message": f"{zero_stock_count} üründe stok sıfır veya altında.",
                })

        if "Stok" in df.columns and "Kritik Stok" in df.columns:
            stock = pd.to_numeric(df["Stok"], errors="coerce").fillna(0)
            critical_stock = pd.to_numeric(
                df["Kritik Stok"],
                errors="coerce",
            ).fillna(0)

            critical_stock_count = int((stock <= critical_stock).sum())

            if critical_stock_count > 0:
                risk_alerts.append({
                    "type": "critical_stock",
                    "level": "medium",
                    "message": f"{critical_stock_count} ürün kritik stok seviyesinde.",
                })

        if "Stok" in df.columns:
            stock = pd.to_numeric(df["Stok"], errors="coerce").fillna(0)

            over_stock_count = int((stock >= 100).sum())

            if over_stock_count > 0:
                risk_alerts.append({
                    "type": "over_stock",
                    "level": "low",
                    "message": f"{over_stock_count} üründe yüksek stok görünüyor.",
                })

    risk_score = 0

    if total_products > 0:
        weighted_risk = (
            zero_stock_count * 3
            + critical_stock_count * 2
            + over_stock_count
        )

        risk_score = round((weighted_risk / total_products) * 10, 2)

        if risk_score > 100:
            risk_score = 100

    return {
        "success": True,
        "risk_score": risk_score,
        "zero_stock_count": zero_stock_count,
        "critical_stock_count": critical_stock_count,
        "over_stock_count": over_stock_count,
        "risk_alerts": risk_alerts,
    }