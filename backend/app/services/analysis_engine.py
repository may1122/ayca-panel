import pandas as pd

from app.services.data_quality import find_first_column, to_number


def calculate_inventory_metrics(df: pd.DataFrame):
    if df is None or df.empty:
        return {
            "success": False,
            "error": "Envanter dosyası boş veya bulunamadı.",
            "total_products": 0,
            "zero_stock_count": 0,
            "critical_stock_count": 0,
            "inventory_value": 0,
        }

    stock_column = find_first_column(
        df,
        ["Stok", "Mevcut Stok", "Stok Adedi"],
    )
    critical_column = find_first_column(
        df,
        ["Kritik Stok", "Minimum Stok", "Min Stok"],
    )
    stock_value_column = find_first_column(
        df,
        [
            "Mal Top(Kdv Dahil)",
            "Mal Top(Kdv Hariç)",
            "Psf Toplam",
            "Stok Değeri",
        ],
    )

    if stock_column is None:
        return {
            "success": False,
            "error": "Envanter dosyasında stok kolonu bulunamadı.",
            "available_columns": list(df.columns),
            "total_products": int(len(df)),
            "zero_stock_count": 0,
            "critical_stock_count": 0,
            "inventory_value": 0,
        }

    stock = to_number(df[stock_column])

    critical_stock = (
        to_number(df[critical_column])
        if critical_column is not None
        else pd.Series(0.0, index=df.index)
    )

    total_products = int(len(df))
    zero_stock_count = int((stock <= 0).sum())

    critical_stock_count = int(
        (
            (stock > 0)
            & (critical_stock > 0)
            & (stock <= critical_stock)
        ).sum()
    )

    inventory_value = (
        float(to_number(df[stock_value_column]).sum())
        if stock_value_column is not None
        else 0.0
    )

    warnings = []

    if critical_column is None:
        warnings.append(
            "Kritik/minimum stok kolonu bulunamadı; "
            "kritik stok özeti üretilemedi."
        )

    if stock_value_column is None:
        warnings.append(
            "Stok değeri kolonu bulunamadı; "
            "toplam envanter değeri hesaplanamadı."
        )

    return {
        "success": True,
        "stock_column": stock_column,
        "critical_stock_column": critical_column,
        "stock_value_column": stock_value_column,
        "total_products": total_products,
        "zero_stock_count": zero_stock_count,
        "critical_stock_count": critical_stock_count,
        "inventory_value": round(inventory_value, 2),
        "warnings": warnings,
    }