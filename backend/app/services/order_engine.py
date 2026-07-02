import pandas as pd


def calculate_order_suggestions(
    inventory_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
):
    required_inventory_columns = ["Barkod", "Ürün Adı", "Stok", "Psf"]

    for column in required_inventory_columns:
        if column not in inventory_df.columns:
            return {
                "success": False,
                "error": f"Envanter dosyasında '{column}' kolonu bulunamadı.",
                "available_columns": list(inventory_df.columns),
            }

    if product_df is None:
        return {
            "success": False,
            "error": "Ürün bazlı satış dosyası bulunamadı.",
        }

    required_product_columns = ["Barkod", "Satılan Adet"]

    for column in required_product_columns:
        if column not in product_df.columns:
            return {
                "success": False,
                "error": f"Ürün bazlı dosyada '{column}' kolonu bulunamadı.",
                "available_columns": list(product_df.columns),
            }

    inventory = inventory_df.copy()
    product = product_df.copy()

    inventory["Barkod"] = inventory["Barkod"].astype(str)
    product["Barkod"] = product["Barkod"].astype(str)

    inventory["Stok"] = pd.to_numeric(inventory["Stok"], errors="coerce").fillna(0)
    inventory["Psf"] = pd.to_numeric(inventory["Psf"], errors="coerce").fillna(0)
    product["Satılan Adet"] = pd.to_numeric(product["Satılan Adet"], errors="coerce").fillna(0)

    merged = inventory.merge(
        product[["Barkod", "Satılan Adet"]],
        on="Barkod",
        how="left",
    )

    merged["Satılan Adet"] = merged["Satılan Adet"].fillna(0)

    # Şimdilik ürün bazlı dosyayı 30 günlük satış gibi kabul ediyoruz.
    merged["Hedef Stok"] = merged["Satılan Adet"]

    merged["Önerilen Sipariş"] = (
        merged["Hedef Stok"] - merged["Stok"]
    ).clip(lower=0)

    merged["Tahmini Sipariş Tutarı"] = (
        merged["Önerilen Sipariş"] * merged["Psf"]
    )

    suggestions = merged[
        (merged["Satılan Adet"] > 0) &
        (merged["Önerilen Sipariş"] > 0)
    ].copy()

    suggestions["Öncelik"] = suggestions.apply(
        lambda row: "Yüksek"
        if row["Stok"] == 0
        else "Orta"
        if row["Önerilen Sipariş"] >= 5
        else "Normal",
        axis=1,
    )

    suggestions = suggestions.sort_values(
        by=["Tahmini Sipariş Tutarı", "Önerilen Sipariş"],
        ascending=[False, False],
    )

    top_suggestions = suggestions.head(20)

    return {
        "success": True,
        "suggestion_count": int(len(suggestions)),
        "estimated_order_budget": round(
            float(suggestions["Tahmini Sipariş Tutarı"].sum()), 2
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
        ].to_dict(orient="records"),
    }