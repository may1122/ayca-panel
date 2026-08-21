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
            "products": [],
        }

    product_name_column = find_first_column(
        df,
        [
            "Ürün Adı",
            "Urun Adi",
            "Ürün",
            "Urun",
            "Malzeme Adı",
            "İlaç Adı",
            "Ilac Adi",
        ],
    )

    barcode_column = find_first_column(
        df,
        [
            "Barkod",
            "Barkod No",
            "Barkod Numarası",
            "Barcode",
        ],
    )

    stock_column = find_first_column(
        df,
        [
            "Stok",
            "Mevcut Stok",
            "Stok Adedi",
        ],
    )

    critical_column = find_first_column(
        df,
        [
            "Kritik Stok",
            "Minimum Stok",
            "Min Stok",
        ],
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

    unit_price_column = find_first_column(
        df,
        [
            "PSF",
            "Psf",
            "Perakende Satış Fiyatı",
            "Satış Fiyatı",
            "Fiyat",
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
            "products": [],
        }

    stock = to_number(df[stock_column])

    critical_stock = (
        to_number(df[critical_column])
        if critical_column is not None
        else pd.Series(0.0, index=df.index)
    )

    stock_value = (
        to_number(df[stock_value_column])
        if stock_value_column is not None
        else pd.Series(0.0, index=df.index)
    )

    unit_price = (
        to_number(df[unit_price_column])
        if unit_price_column is not None
        else pd.Series(0.0, index=df.index)
    )

    total_products = int(len(df))

    zero_stock_count = int(
        (stock <= 0).sum()
    )

    critical_stock_count = int(
        (
            (stock > 0)
            & (critical_stock > 0)
            & (stock <= critical_stock)
        ).sum()
    )

    inventory_value = float(
        stock_value.sum()
    )

    products = []

    for index in df.index:
        product_name = (
            str(df.at[index, product_name_column]).strip()
            if product_name_column is not None
            and pd.notna(df.at[index, product_name_column])
            else ""
        )

        barcode = (
            str(df.at[index, barcode_column]).strip()
            if barcode_column is not None
            and pd.notna(df.at[index, barcode_column])
            else ""
        )

        current_stock = float(
            stock.loc[index]
        )

        minimum_stock = float(
            critical_stock.loc[index]
        )

        current_stock_value = float(
            stock_value.loc[index]
        )

        current_unit_price = float(
            unit_price.loc[index]
        )

        if current_stock <= 0:
            stock_status = "Sıfır Stok"

        elif (
            minimum_stock > 0
            and current_stock <= minimum_stock
        ):
            stock_status = "Kritik Stok"

        else:
            stock_status = "Normal"

        products.append(
            {
                "product_name": product_name,
                "barcode": barcode,
                "stock": round(current_stock, 2),
                "critical_stock": round(
                    minimum_stock,
                    2,
                ),
                "stock_value": round(
                    current_stock_value,
                    2,
                ),
                "unit_price": round(
                    current_unit_price,
                    2,
                ),
                "stock_status": stock_status,
            }
        )

    warnings = []

    if product_name_column is None:
        warnings.append(
            "Ürün adı kolonu bulunamadı; "
            "ürün bazlı Copilot sorguları sınırlı çalışacaktır."
        )

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
        "product_name_column": product_name_column,
        "barcode_column": barcode_column,
        "critical_stock_column": critical_column,
        "stock_value_column": stock_value_column,
        "unit_price_column": unit_price_column,

        "total_products": total_products,
        "zero_stock_count": zero_stock_count,
        "critical_stock_count": critical_stock_count,
        "inventory_value": round(
            inventory_value,
            2,
        ),

        # Product Intelligence için gerçek satır verisi
        "products": products,

        "warnings": warnings,
    }