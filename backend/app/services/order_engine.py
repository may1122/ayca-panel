import pandas as pd

from app.services.data_quality import (
    estimate_period_days,
    find_first_column,
    normalize_barcode,
    normalize_text,
    to_number,
)
from app.services.inventory_intelligence_engine import build_inventory_intelligence


PURCHASE_PRICE_CANDIDATES = [
    "Alış Fiyatı",
    "Alis Fiyati",
    "Net Alış Fiyatı",
    "Net Alis Fiyati",
    "Net Alış",
    "Net Alis",
    "Maliyet",
    "Maliyet Fiyatı",
    "Maliyet Fiyati",
]

FALLBACK_PRICE_CANDIDATES = [
    "Psf",
    "PSF",
    "Satış Fiyatı",
    "Satis Fiyati",
]


def _prepare_order_costs(
    inventory_df: pd.DataFrame,
    intelligence: pd.DataFrame,
) -> tuple[pd.DataFrame, str, bool]:
    """
    Sipariş bütçesi için mümkünse alış/maliyet fiyatını kullanır.
    Alış/maliyet fiyatı bulunamazsa mevcut ürün fiyatına geri düşer.

    Returns:
        intelligence_with_costs,
        price_source,
        price_assumed
    """
    out = intelligence.copy()

    purchase_price_column = find_first_column(
        inventory_df,
        PURCHASE_PRICE_CANDIDATES,
    )

    if purchase_price_column is None:
        out["order_unit_cost"] = out["unit_price"]
        out["estimated_order_value"] = (
            out["recommended_order"] * out["order_unit_cost"]
        )
        return out, "fallback_unit_price", True

    inventory = inventory_df.copy()
    inventory["_order_unit_cost"] = to_number(
        inventory[purchase_price_column]
    )

    inventory_barcode_column = find_first_column(
        inventory,
        ["Barkod", "Barkod No", "Ürün Barkodu"],
    )

    if (
        inventory_barcode_column is not None
        and "_barcode" in out.columns
    ):
        inventory["_barcode"] = normalize_barcode(
            inventory[inventory_barcode_column]
        )

        price_map = (
            inventory[
                inventory["_barcode"] != ""
            ][["_barcode", "_order_unit_cost"]]
            .drop_duplicates(
                subset=["_barcode"],
                keep="last",
            )
        )

        out = out.merge(
            price_map,
            on="_barcode",
            how="left",
        )

        out["order_unit_cost"] = (
            out["_order_unit_cost"]
            .fillna(out["unit_price"])
        )

        out = out.drop(
            columns=["_order_unit_cost"],
            errors="ignore",
        )

    else:
        inventory_name_column = find_first_column(
            inventory,
            ["Ürün Adı", "Ürün", "İlaç Adı"],
        )

        if inventory_name_column is not None:
            inventory["_name_key"] = (
                inventory[inventory_name_column]
                .fillna("")
                .astype(str)
                .map(lambda value: normalize_text(value).casefold())
            )

            out["_name_key"] = (
                out["product_name"]
                .fillna("")
                .astype(str)
                .map(lambda value: normalize_text(value).casefold())
            )

            price_map = (
                inventory[
                    inventory["_name_key"] != ""
                ][["_name_key", "_order_unit_cost"]]
                .drop_duplicates(
                    subset=["_name_key"],
                    keep="last",
                )
            )

            out = out.merge(
                price_map,
                on="_name_key",
                how="left",
            )

            out["order_unit_cost"] = (
                out["_order_unit_cost"]
                .fillna(out["unit_price"])
            )

            out = out.drop(
                columns=[
                    "_order_unit_cost",
                    "_name_key",
                ],
                errors="ignore",
            )
        else:
            out["order_unit_cost"] = out["unit_price"]

    out["estimated_order_value"] = (
        out["recommended_order"] * out["order_unit_cost"]
    )

    return out, purchase_price_column, False


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

    # İşletmenin kendi minimum/kritik stok seviyesi,
    # 30 günlük tüketim hedefinden daha yüksekse onu taban kabul et.
    intelligence["effective_target_stock"] = (
        intelligence[
            ["target_stock", "critical_stock"]
        ]
        .max(axis=1)
        .clip(lower=0)
    )

    intelligence["recommended_order"] = (
        intelligence["effective_target_stock"]
        - intelligence["stock"]
    ).clip(lower=0).apply(lambda value: int(-(-value // 1)))

    intelligence, price_source, price_assumed = _prepare_order_costs(
        inventory_df=inventory_df,
        intelligence=intelligence,
    )

    suggestions = intelligence[
        (intelligence["sold_quantity"] > 0)
        & (intelligence["recommended_order"] > 0)
    ].copy()

    def priority(row):
        if row["stock"] <= 0:
            return "Yüksek"

        if (
            row["critical_stock"] > 0
            and row["stock"] <= row["critical_stock"]
        ):
            return "Yüksek"

        if row["stock_days"] <= 5:
            return "Yüksek"

        if row["stock_days"] <= 15:
            return "Orta"

        return "Normal"

    suggestions["priority"] = suggestions.apply(
        priority,
        axis=1,
    )

    priority_order = {
        "Yüksek": 3,
        "Orta": 2,
        "Normal": 1,
    }

    suggestions["_priority"] = (
        suggestions["priority"]
        .map(priority_order)
        .fillna(0)
    )

    suggestions = suggestions.sort_values(
        [
            "_priority",
            "recommended_order",
            "estimated_order_value",
        ],
        ascending=[False, False, False],
    )

    records = []

    for _, row in suggestions.head(50).iterrows():
        stock_days = (
            None
            if row["stock_days"] == float("inf")
            else round(float(row["stock_days"]), 1)
        )

        records.append(
            {
                "Ürün Adı": row["product_name"],
                "Stok": round(float(row["stock"]), 2),
                "Kritik Stok": round(
                    float(row["critical_stock"]),
                    2,
                ),
                "Satılan Adet": round(
                    float(row["sold_quantity"]),
                    2,
                ),
                "Günlük Tüketim": round(
                    float(row["daily_consumption"]),
                    2,
                ),
                "Stok Gün Karşılığı": stock_days,
                "Hedef Stok": int(
                    row["effective_target_stock"]
                ),
                "Önerilen Sipariş": int(
                    row["recommended_order"]
                ),
                "Sipariş Birim Maliyeti": round(
                    float(row["order_unit_cost"]),
                    2,
                ),
                "Tahmini Sipariş Tutarı": round(
                    float(row["estimated_order_value"]),
                    2,
                ),
                "Öncelik": row["priority"],
            }
        )

    _, period_assumed = estimate_period_days(
        product_df,
        default_days=30,
    )

    warnings = []

    if period_assumed:
        warnings.append(
            "Satış dönemi tarih kolonundan doğrulanamadı; "
            "30 gün varsayıldı."
        )

    if price_assumed:
        warnings.append(
            "Alış/maliyet fiyatı bulunamadı; sipariş bütçesinde "
            "mevcut ürün fiyatı kullanıldı."
        )

    return {
        "success": True,
        "analysis_period_days": period_days,
        "analysis_period_assumed": period_assumed,
        "target_stock_days": target_stock_days,
        "suggestion_count": int(len(suggestions)),
        "estimated_order_budget": round(
            float(
                suggestions[
                    "estimated_order_value"
                ].sum()
            ),
            2,
        ),
        "price_source": price_source,
        "price_assumed": price_assumed,
        "warnings": warnings,
        "top_suggestions": records,
    }