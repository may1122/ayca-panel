import pandas as pd


def calculate_finance_metrics(df: pd.DataFrame):
    required_columns = ["Tutar"]

    for column in required_columns:
        if column not in df.columns:
            return {
                "success": False,
                "error": f"'{column}' kolonu bulunamadı.",
            }

    amount = pd.to_numeric(df["Tutar"], errors="coerce").fillna(0)

    total_turnover = float(amount.sum())
    average_sale = float(amount.mean()) if len(amount) else 0

    return {
        "success": True,
        "total_turnover": round(total_turnover, 2),
        "average_sale": round(average_sale, 2),
        "transaction_count": int(len(df)),
    }