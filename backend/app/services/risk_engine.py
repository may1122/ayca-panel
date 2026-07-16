import math

import pandas as pd


def find_first_column(
    df: pd.DataFrame,
    candidates: list[str],
):
    for column in candidates:
        if column in df.columns:
            return column

    return None


def normalize_barcode(
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


def to_number(
    series: pd.Series,
) -> pd.Series:
    return pd.to_numeric(
        series,
        errors="coerce",
    ).fillna(0)


def calculate_risk_metrics(
    inventory_df=None,
    product_df=None,
):
    if inventory_df is None or inventory_df.empty:
        return {
            "success": False,
            "error": "Envanter dosyası boş veya bulunamadı.",
            "risk_score": 0,
            "zero_stock_count": 0,
            "critical_stock_count": 0,
            "over_stock_count": 0,
            "risk_alerts": [],
            "risk_products": [],
            "capital_products": [],
        }

    inventory = inventory_df.copy()

    barcode_column = find_first_column(
        inventory,
        [
            "Barkod",
            "Barkod No",
            "Ürün Barkodu",
        ],
    )

    product_name_column = find_first_column(
        inventory,
        [
            "Ürün Adı",
            "Ürün",
            "İlaç Adı",
        ],
    )

    stock_column = find_first_column(
        inventory,
        [
            "Stok",
            "Mevcut Stok",
            "Stok Adedi",
        ],
    )

    critical_stock_column = find_first_column(
        inventory,
        [
            "Kritik Stok",
            "Minimum Stok",
            "Min Stok",
        ],
    )

    stock_value_column = find_first_column(
        inventory,
        [
            "Mal Top(Kdv Dahil)",
            "Mal Top(Kdv Hariç)",
            "Psf Toplam",
            "Stok Değeri",
        ],
    )

    psf_column = find_first_column(
        inventory,
        [
            "Psf",
            "PSF",
            "Satış Fiyatı",
        ],
    )

    if stock_column is None:
        return {
            "success": False,
            "error": "Envanter dosyasında stok kolonu bulunamadı.",
            "available_columns": list(inventory.columns),
            "risk_score": 0,
            "zero_stock_count": 0,
            "critical_stock_count": 0,
            "over_stock_count": 0,
            "risk_alerts": [],
            "risk_products": [],
            "capital_products": [],
        }

    inventory["_stock"] = to_number(
        inventory[stock_column]
    )

    inventory["_critical_stock"] = (
        to_number(
            inventory[critical_stock_column]
        )
        if critical_stock_column is not None
        else 0
    )

    inventory["_product_name"] = (
        inventory[product_name_column]
        .fillna("Bilinmeyen Ürün")
        .astype(str)
        .str.strip()
        if product_name_column is not None
        else "Bilinmeyen Ürün"
    )

    if stock_value_column is not None:
        inventory["_stock_value"] = to_number(
            inventory[stock_value_column]
        )
    elif psf_column is not None:
        inventory["_stock_value"] = (
            inventory["_stock"]
            * to_number(
                inventory[psf_column]
            )
        )
    else:
        inventory["_stock_value"] = 0

    inventory["_sold_quantity"] = 0.0

    if (
        product_df is not None
        and not product_df.empty
        and barcode_column is not None
    ):
        product = product_df.copy()

        product_barcode_column = find_first_column(
            product,
            [
                "Barkod",
                "Barkod No",
                "Ürün Barkodu",
            ],
        )

        sold_quantity_column = find_first_column(
            product,
            [
                "Satılan Adet",
                "Satış Adedi",
                "Adet",
            ],
        )

        if (
            product_barcode_column is not None
            and sold_quantity_column is not None
        ):
            inventory["_barcode"] = normalize_barcode(
                inventory[barcode_column]
            )

            product["_barcode"] = normalize_barcode(
                product[product_barcode_column]
            )

            product["_sold_quantity"] = to_number(
                product[sold_quantity_column]
            )

            product_summary = (
                product
                .groupby(
                    "_barcode",
                    as_index=False,
                )["_sold_quantity"]
                .sum()
            )

            inventory = inventory.merge(
                product_summary,
                on="_barcode",
                how="left",
                suffixes=("", "_product"),
            )

            inventory["_sold_quantity"] = (
                inventory["_sold_quantity_product"]
                .fillna(0)
            )

    inventory["_sold_quantity"] = to_number(
        inventory["_sold_quantity"]
    )

    # Ürün bazlı rapor yaklaşık dönem satışını içerir.
    # Kritik stok: eldeki stok, rapor satışının yaklaşık %15'inden düşükse.
    inventory["_dynamic_critical"] = inventory.apply(
        lambda row: max(
            float(row["_critical_stock"]),
            math.ceil(
                float(row["_sold_quantity"]) * 0.15
            ),
        ),
        axis=1,
    )

    zero_stock_mask = (
        inventory["_stock"] <= 0
    )

    critical_stock_mask = (
        (inventory["_stock"] > 0)
        & (inventory["_sold_quantity"] > 0)
        & (
            inventory["_stock"]
            <= inventory["_dynamic_critical"]
        )
    )

    over_stock_mask = (
        (inventory["_stock"] >= 100)
        & (
            inventory["_sold_quantity"] <= 3
        )
    ) | (
        (inventory["_stock"] >= 50)
        & (
            inventory["_stock"]
            >= inventory["_sold_quantity"] * 3
        )
    )

    # Aynı ürün iki risk grubunda görünmesin.
    over_stock_mask = (
        over_stock_mask
        & ~zero_stock_mask
        & ~critical_stock_mask
    )

    zero_stock_count = int(
        zero_stock_mask.sum()
    )

    critical_stock_count = int(
        critical_stock_mask.sum()
    )

    over_stock_count = int(
        over_stock_mask.sum()
    )

    total_products = int(
        len(inventory)
    )

    weighted_risk = (
        zero_stock_count * 3
        + critical_stock_count * 2
        + over_stock_count
    )

    risk_score = (
        min(
            round(
                (
                    weighted_risk
                    / max(
                        total_products * 3,
                        1,
                    )
                )
                * 100,
                2,
            ),
            100,
        )
        if total_products > 0
        else 0
    )

    risk_alerts = []

    if zero_stock_count > 0:
        risk_alerts.append({
            "type": "zero_stock",
            "level": "high",
            "message": (
                f"{zero_stock_count} üründe stok sıfır veya altında."
            ),
        })

    if critical_stock_count > 0:
        risk_alerts.append({
            "type": "critical_stock",
            "level": "high",
            "message": (
                f"{critical_stock_count} ürün satış hızına göre kritik seviyede."
            ),
        })

    if over_stock_count > 0:
        risk_alerts.append({
            "type": "over_stock",
            "level": "medium",
            "message": (
                f"{over_stock_count} üründe fazla stok veya düşük devir riski var."
            ),
        })

    risk_products = []

    for _, row in inventory.iterrows():
        stock = int(
            round(
                float(row["_stock"])
            )
        )

        sold_quantity = int(
            round(
                float(row["_sold_quantity"])
            )
        )

        product_name = str(
            row["_product_name"]
        )

        risk_type = None
        level = None
        action = None
        priority = 0

        if stock <= 0:
            risk_type = "Sıfır stok"
            level = "Kritik"
            action = "Acil sipariş"
            priority = 100000 + sold_quantity

        elif (
            sold_quantity > 0
            and stock
            <= float(row["_dynamic_critical"])
        ):
            risk_type = "Kritik stok"
            level = "Yüksek"
            action = "Sipariş ver"
            priority = 70000 + sold_quantity

        elif (
            (stock >= 100 and sold_quantity <= 3)
            or (
                stock >= 50
                and stock >= sold_quantity * 3
            )
        ):
            risk_type = "Fazla stok"
            level = "Orta"
            action = "Siparişi durdur"
            priority = (
                30000
                + stock
                + float(row["_stock_value"]) / 100
            )

        if risk_type is not None:
            risk_products.append({
                "product_name": product_name,
                "risk_type": risk_type,
                "stock": stock,
                "sold_quantity": sold_quantity,
                "level": level,
                "recommended_action": action,
                "_priority": priority,
            })

    risk_products = sorted(
        risk_products,
        key=lambda item: item["_priority"],
        reverse=True,
    )[:20]

    for item in risk_products:
        item.pop(
            "_priority",
            None,
        )

    capital_df = inventory[
        over_stock_mask
    ].copy()

    capital_df = capital_df.sort_values(
        by=[
            "_stock_value",
            "_stock",
        ],
        ascending=[
            False,
            False,
        ],
    )

    capital_products = [
        {
            "product_name": str(
                row["_product_name"]
            ),
            "stock": int(
                round(
                    float(row["_stock"])
                )
            ),
            "sold_quantity": int(
                round(
                    float(row["_sold_quantity"])
                )
            ),
            "stock_value": round(
                float(row["_stock_value"]),
                2,
            ),
            "status": "Sermaye bağlıyor",
        }
        for _, row in capital_df.head(20).iterrows()
    ]

    return {
        "success": True,
        "risk_score": risk_score,
        "total_products": total_products,
        "zero_stock_count": zero_stock_count,
        "critical_stock_count": critical_stock_count,
        "over_stock_count": over_stock_count,
        "risk_alerts": risk_alerts,
        "risk_products": risk_products,
        "capital_products": capital_products,
        "columns_used": {
            "barcode": barcode_column,
            "product_name": product_name_column,
            "stock": stock_column,
            "critical_stock": critical_stock_column,
            "stock_value": stock_value_column,
        },
    }