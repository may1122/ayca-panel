import pandas as pd


def normalize_barcode_series(
    series: pd.Series,
) -> pd.Series:
    return (
        series
        .astype(str)
        .str.strip()
        .str.replace(
            r"\.0$",
            "",
            regex=True,
        )
    )


def calculate_order_suggestions(
    inventory_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
):
    required_inventory_columns = [
        "Barkod",
        "Ürün Adı",
        "Stok",
        "Psf",
    ]

    for column in required_inventory_columns:
        if column not in inventory_df.columns:
            return {
                "success": False,
                "error": (
                    f"Envanter dosyasında '{column}' kolonu bulunamadı."
                ),
                "available_columns": list(
                    inventory_df.columns
                ),
                "suggestion_count": 0,
                "estimated_order_budget": 0,
                "top_suggestions": [],
            }

    if product_df is None or product_df.empty:
        return {
            "success": False,
            "error": "Ürün bazlı satış dosyası bulunamadı.",
            "suggestion_count": 0,
            "estimated_order_budget": 0,
            "top_suggestions": [],
        }

    product_name_column = (
        "Ürün Adı (İçinde Geçen İsim Şeklinde Arama Yapılabilir)"
        if (
            "Ürün Adı (İçinde Geçen İsim Şeklinde Arama Yapılabilir)"
            in product_df.columns
        )
        else None
    )

    required_product_columns = [
        "Barkod",
        "Satılan Adet",
    ]

    for column in required_product_columns:
        if column not in product_df.columns:
            return {
                "success": False,
                "error": (
                    f"Ürün bazlı dosyada '{column}' kolonu bulunamadı."
                ),
                "available_columns": list(
                    product_df.columns
                ),
                "suggestion_count": 0,
                "estimated_order_budget": 0,
                "top_suggestions": [],
            }

    inventory = inventory_df.copy()
    product = product_df.copy()

    inventory["Barkod"] = normalize_barcode_series(
        inventory["Barkod"]
    )

    product["Barkod"] = normalize_barcode_series(
        product["Barkod"]
    )

    inventory["Stok"] = pd.to_numeric(
        inventory["Stok"],
        errors="coerce",
    ).fillna(0)

    inventory["Psf"] = pd.to_numeric(
        inventory["Psf"],
        errors="coerce",
    ).fillna(0)

    product["Satılan Adet"] = pd.to_numeric(
        product["Satılan Adet"],
        errors="coerce",
    ).fillna(0)

    aggregation = {
        "Satılan Adet": "sum",
    }

    if product_name_column is not None:
        aggregation[product_name_column] = "first"

    product_summary = (
        product
        .groupby(
            "Barkod",
            as_index=False,
        )
        .agg(aggregation)
    )

    merged = inventory.merge(
        product_summary,
        on="Barkod",
        how="left",
    )

    merged["Satılan Adet"] = (
        merged["Satılan Adet"]
        .fillna(0)
    )

    # Rapor dönemindeki satış kadar hedef stok.
    merged["Hedef Stok"] = (
        merged["Satılan Adet"]
        .clip(lower=0)
    )

    merged["Önerilen Sipariş"] = (
        merged["Hedef Stok"]
        - merged["Stok"]
    ).clip(lower=0)

    merged["Tahmini Sipariş Tutarı"] = (
        merged["Önerilen Sipariş"]
        * merged["Psf"]
    )

    suggestions = merged[
        (merged["Satılan Adet"] > 0)
        & (merged["Önerilen Sipariş"] > 0)
    ].copy()

    suggestions["Öncelik"] = suggestions.apply(
        lambda row: (
            "Yüksek"
            if row["Stok"] <= 0
            else "Orta"
            if (
                row["Stok"]
                <= row["Satılan Adet"] * 0.15
            )
            else "Normal"
        ),
        axis=1,
    )

    priority_order = {
        "Yüksek": 3,
        "Orta": 2,
        "Normal": 1,
    }

    suggestions["_priority_order"] = (
        suggestions["Öncelik"]
        .map(priority_order)
        .fillna(0)
    )

    suggestions = suggestions.sort_values(
        by=[
            "_priority_order",
            "Satılan Adet",
            "Tahmini Sipariş Tutarı",
        ],
        ascending=[
            False,
            False,
            False,
        ],
    )

    top_suggestions = (
        suggestions
        .head(20)
        .copy()
    )

    return {
        "success": True,
        "suggestion_count": int(
            len(suggestions)
        ),
        "estimated_order_budget": round(
            float(
                suggestions[
                    "Tahmini Sipariş Tutarı"
                ].sum()
            ),
            2,
        ),
        "top_suggestions": top_suggestions[
            [
                "Ürün Adı",
                "Stok",
                "Satılan Adet",
                "Hedef Stok",
                "Önerilen Sipariş",
                "Tahmini Sipariş Tutarı",
                "Öncelik",
            ]
        ].to_dict(
            orient="records"
        ),
    }