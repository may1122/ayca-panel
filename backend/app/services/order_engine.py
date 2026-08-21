import math

import pandas as pd

from app.services.data_quality import (
    estimate_period_days,
    find_first_column,
    normalize_barcode,
    normalize_text,
    to_number,
)
from app.services.inventory_intelligence_engine import (
    build_inventory_intelligence,
)


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
    Sipariş ve stok sermayesi hesabında mümkünse alış/maliyet
    fiyatını kullanır. Alış/maliyet fiyatı bulunamazsa mevcut
    ürün fiyatına geri düşer.

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
            out["recommended_order"]
            * out["order_unit_cost"]
        )
        out["inventory_capital_value"] = (
            out["stock"].clip(lower=0)
            * out["order_unit_cost"]
        )

        return (
            out,
            "fallback_unit_price",
            True,
        )

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
                .map(
                    lambda value: normalize_text(
                        value
                    ).casefold()
                )
            )

            out["_name_key"] = (
                out["product_name"]
                .fillna("")
                .astype(str)
                .map(
                    lambda value: normalize_text(
                        value
                    ).casefold()
                )
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
        out["recommended_order"]
        * out["order_unit_cost"]
    )

    out["inventory_capital_value"] = (
        out["stock"].clip(lower=0)
        * out["order_unit_cost"]
    )

    return (
        out,
        purchase_price_column,
        False,
    )


def _apply_capital_guard(
    suggestions: pd.DataFrame,
    inventory_value: float,
    max_order_to_inventory_ratio: float,
) -> tuple[pd.DataFrame, dict]:
    """
    Ham sipariş önerisini mevcut stok sermayesine göre sınırlar.

    Bütçe dağıtımı:
      1. Yüksek öncelik
      2. Orta öncelik
      3. Normal öncelik

    Aynı öncelikte daha kısa stok günü ve daha yüksek önerilen
    miktar önce değerlendirilir.

    Limit aşılırsa son üründe bütçeye sığan adet kadar kısmi
    sipariş önerilebilir.
    """
    out = suggestions.copy()

    raw_budget = float(
        out["estimated_order_value"].sum()
    )

    if (
        inventory_value <= 0
        or max_order_to_inventory_ratio <= 0
    ):
        out["raw_recommended_order"] = (
            out["recommended_order"]
        )
        out["raw_estimated_order_value"] = (
            out["estimated_order_value"]
        )

        return out, {
            "inventory_value": round(
                float(inventory_value),
                2,
            ),
            "raw_order_budget": round(
                raw_budget,
                2,
            ),
            "max_recommended_order_budget": round(
                raw_budget,
                2,
            ),
            "capital_guard_applied": False,
            "capital_guard_ratio": (
                max_order_to_inventory_ratio
            ),
            "raw_order_to_inventory_ratio": None,
            "order_to_inventory_ratio": None,
            "budget_reduction": 0.0,
        }

    budget_limit = (
        float(inventory_value)
        * float(max_order_to_inventory_ratio)
    )

    raw_ratio = (
        raw_budget / inventory_value
        if inventory_value > 0
        else None
    )

    out["raw_recommended_order"] = (
        out["recommended_order"]
    )
    out["raw_estimated_order_value"] = (
        out["estimated_order_value"]
    )

    guard_applied = raw_budget > budget_limit

    if not guard_applied:
        final_budget = raw_budget

        return out, {
            "inventory_value": round(
                float(inventory_value),
                2,
            ),
            "raw_order_budget": round(
                raw_budget,
                2,
            ),
            "max_recommended_order_budget": round(
                budget_limit,
                2,
            ),
            "capital_guard_applied": False,
            "capital_guard_ratio": (
                max_order_to_inventory_ratio
            ),
            "raw_order_to_inventory_ratio": round(
                float(raw_ratio),
                4,
            ),
            "order_to_inventory_ratio": round(
                float(raw_ratio),
                4,
            ),
            "budget_reduction": 0.0,
        }

    remaining_budget = budget_limit

    adjusted_orders = []
    adjusted_values = []

    for _, row in out.iterrows():
        unit_cost = float(
            row["order_unit_cost"]
        )
        raw_qty = int(
            row["recommended_order"]
        )

        if (
            remaining_budget <= 0
            or unit_cost <= 0
            or raw_qty <= 0
        ):
            adjusted_qty = 0
        else:
            affordable_qty = int(
                math.floor(
                    remaining_budget / unit_cost
                )
            )

            adjusted_qty = min(
                raw_qty,
                max(affordable_qty, 0),
            )

        adjusted_value = (
            adjusted_qty * unit_cost
        )

        adjusted_orders.append(
            adjusted_qty
        )
        adjusted_values.append(
            adjusted_value
        )

        remaining_budget = max(
            0.0,
            remaining_budget - adjusted_value,
        )

    out["recommended_order"] = (
        adjusted_orders
    )
    out["estimated_order_value"] = (
        adjusted_values
    )

    out = out[
        out["recommended_order"] > 0
    ].copy()

    final_budget = float(
        out["estimated_order_value"].sum()
    )

    final_ratio = (
        final_budget / inventory_value
        if inventory_value > 0
        else None
    )

    return out, {
        "inventory_value": round(
            float(inventory_value),
            2,
        ),
        "raw_order_budget": round(
            raw_budget,
            2,
        ),
        "max_recommended_order_budget": round(
            budget_limit,
            2,
        ),
        "capital_guard_applied": True,
        "capital_guard_ratio": (
            max_order_to_inventory_ratio
        ),
        "raw_order_to_inventory_ratio": round(
            float(raw_ratio),
            4,
        ),
        "order_to_inventory_ratio": round(
            float(final_ratio),
            4,
        ),
        "budget_reduction": round(
            raw_budget - final_budget,
            2,
        ),
    }


def calculate_order_suggestions(
    inventory_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
    sales_df: pd.DataFrame | None = None,
    target_stock_days: int = 30,
    max_order_to_inventory_ratio: float = 0.35,
):
    if inventory_df is None or inventory_df.empty:
        return {
            "success": False,
            "error": (
                "Envanter dosyası boş veya bulunamadı."
            ),
            "suggestion_count": 0,
            "estimated_order_budget": 0,
            "raw_order_budget": 0,
            "inventory_value": 0,
            "top_suggestions": [],
        }

    intelligence, period_days = (
        build_inventory_intelligence(
            inventory_df=inventory_df,
            product_df=product_df,
            period_df=sales_df,
            target_stock_days=target_stock_days,
        )
    )

    if intelligence.empty:
        return {
            "success": False,
            "error": (
                "Sipariş analizi için stok kolonu "
                "bulunamadı."
            ),
            "suggestion_count": 0,
            "estimated_order_budget": 0,
            "raw_order_budget": 0,
            "inventory_value": 0,
            "top_suggestions": [],
        }

    # İşletmenin kendi minimum/kritik stok seviyesi,
    # 30 günlük tüketim hedefinden daha yüksekse onu
    # taban kabul et.
    intelligence["effective_target_stock"] = (
        intelligence[
            [
                "target_stock",
                "critical_stock",
            ]
        ]
        .max(axis=1)
        .clip(lower=0)
    )

    intelligence["recommended_order"] = (
        intelligence[
            "effective_target_stock"
        ]
        - intelligence["stock"]
    ).clip(lower=0).apply(
        lambda value: int(math.ceil(value))
    )

    (
        intelligence,
        price_source,
        price_assumed,
    ) = _prepare_order_costs(
        inventory_df=inventory_df,
        intelligence=intelligence,
    )

    # Eczanenin mevcut stok sermayesi.
    # Mümkünse alış/maliyet fiyatından hesaplanır.
    inventory_value = float(
        intelligence[
            "inventory_capital_value"
        ].sum()
    )

    suggestions = intelligence[
        (
            intelligence[
                "sold_quantity"
            ] > 0
        )
        & (
            intelligence[
                "recommended_order"
            ] > 0
        )
    ].copy()

    def priority(row):
        if row["stock"] <= 0:
            return "Yüksek"

        if (
            row["critical_stock"] > 0
            and row["stock"]
            <= row["critical_stock"]
        ):
            return "Yüksek"

        if row["stock_days"] <= 5:
            return "Yüksek"

        if row["stock_days"] <= 15:
            return "Orta"

        return "Normal"

    suggestions["priority"] = (
        suggestions.apply(
            priority,
            axis=1,
        )
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

    # Capital Guard bütçeyi bu sıralamaya göre dağıtır.
    suggestions = suggestions.sort_values(
        [
            "_priority",
            "stock_days",
            "recommended_order",
            "estimated_order_value",
        ],
        ascending=[
            False,
            True,
            False,
            False,
        ],
    )

    (
        suggestions,
        capital_guard,
    ) = _apply_capital_guard(
        suggestions=suggestions,
        inventory_value=inventory_value,
        max_order_to_inventory_ratio=(
            max_order_to_inventory_ratio
        ),
    )

    records = []

    for _, row in (
        suggestions.head(50).iterrows()
    ):
        stock_days = (
            None
            if row["stock_days"]
            == float("inf")
            else round(
                float(row["stock_days"]),
                1,
            )
        )

        record = {
            "Ürün Adı": row["product_name"],
            "Stok": round(
                float(row["stock"]),
                2,
            ),
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
            "Stok Gün Karşılığı": (
                stock_days
            ),
            "Hedef Stok": int(
                row[
                    "effective_target_stock"
                ]
            ),
            "Önerilen Sipariş": int(
                row["recommended_order"]
            ),
            "Sipariş Birim Maliyeti": round(
                float(
                    row[
                        "order_unit_cost"
                    ]
                ),
                2,
            ),
            "Tahmini Sipariş Tutarı": round(
                float(
                    row[
                        "estimated_order_value"
                    ]
                ),
                2,
            ),
            "Öncelik": row["priority"],
        }

        if (
            "raw_recommended_order"
            in row.index
        ):
            record[
                "Ham Önerilen Sipariş"
            ] = int(
                row[
                    "raw_recommended_order"
                ]
            )

        if (
            "raw_estimated_order_value"
            in row.index
        ):
            record[
                "Ham Sipariş Tutarı"
            ] = round(
                float(
                    row[
                        "raw_estimated_order_value"
                    ]
                ),
                2,
            )

        records.append(record)

    period_source_df = (
        sales_df
        if sales_df is not None and not sales_df.empty
        else product_df
    )

    (
        _,
        period_assumed,
    ) = estimate_period_days(
        period_source_df,
        default_days=30,
    )

    warnings = []

    if period_assumed:
        warnings.append(
            "Satış dönemi tarih kolonundan "
            "doğrulanamadı; 30 gün varsayıldı."
        )

    if price_assumed:
        warnings.append(
            "Alış/maliyet fiyatı bulunamadı; "
            "sipariş ve stok sermayesi hesabında "
            "mevcut ürün fiyatı kullanıldı."
        )

    if capital_guard[
        "capital_guard_applied"
    ]:
        warnings.append(
            "Ham sipariş bütçesi mevcut stok "
            "sermayesine göre yüksek bulundu. "
            f"Sipariş bütçesi stok değerinin "
            f"%{round(max_order_to_inventory_ratio * 100)} "
            "seviyesinde sınırlandırıldı."
        )

    estimated_order_budget = round(
        float(
            suggestions[
                "estimated_order_value"
            ].sum()
        ),
        2,
    )

    return {
        "success": True,
        "analysis_period_days": (
            period_days
        ),
        "analysis_period_assumed": (
            period_assumed
        ),
        "target_stock_days": (
            target_stock_days
        ),
        "suggestion_count": int(
            len(suggestions)
        ),
        "raw_suggestion_count": int(
            (
                intelligence[
                    "sold_quantity"
                ] > 0
            )
            .where(
                intelligence[
                    "recommended_order"
                ] > 0,
                False,
            )
            .sum()
        ),
        "inventory_value": round(
            inventory_value,
            2,
        ),
        "estimated_order_budget": (
            estimated_order_budget
        ),
        "raw_order_budget": capital_guard[
            "raw_order_budget"
        ],
        "max_recommended_order_budget": (
            capital_guard[
                "max_recommended_order_budget"
            ]
        ),
        "capital_guard_applied": (
            capital_guard[
                "capital_guard_applied"
            ]
        ),
        "capital_guard_ratio": (
            capital_guard[
                "capital_guard_ratio"
            ]
        ),
        "raw_order_to_inventory_ratio": (
            capital_guard[
                "raw_order_to_inventory_ratio"
            ]
        ),
        "order_to_inventory_ratio": (
            capital_guard[
                "order_to_inventory_ratio"
            ]
        ),
        "budget_reduction": (
            capital_guard[
                "budget_reduction"
            ]
        ),
        "price_source": price_source,
        "price_assumed": price_assumed,
        "warnings": warnings,
        "top_suggestions": records,
    }