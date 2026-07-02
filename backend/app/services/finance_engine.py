import pandas as pd


def calculate_finance_metrics(df: pd.DataFrame):
    amount_columns = [
        "Toplam Tutar",
        "Ödenen Tutar",
        "Tutar",
        "Net Tutar",
        "Satış Tutarı",
        "Ciro",
    ]

    amount_column = None

    for column in amount_columns:
        if column in df.columns:
            amount_column = column
            break

    if amount_column is None:
        return {
            "success": False,
            "error": "Ciro hesaplamak için uygun tutar kolonu bulunamadı.",
            "available_columns": list(df.columns),
        }

    amount = pd.to_numeric(df[amount_column], errors="coerce").fillna(0)

    total_turnover = float(amount.sum())
    average_sale = float(amount.mean()) if len(amount) else 0

    return {
        "success": True,
        "amount_column": amount_column,
        "total_turnover": round(total_turnover, 2),
        "average_sale": round(average_sale, 2),
        "transaction_count": int(len(df)),
    }