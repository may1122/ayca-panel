import math
import re
import unicodedata
from datetime import date

import pandas as pd

from app.services.data_quality import (
    estimate_period_days,
    find_first_column,
    normalize_barcode,
    normalize_text,
    parse_date_series,
    to_number,
)


EXPIRY_COLUMN_CANDIDATES = [
    "Miad Tarihi",
    "Miat Tarihi",
    "Miad",
    "Miat",
    "SKT",
    "S.K.T",
    "S.K.T.",
    "SKT Tarihi",
    "Skt Tarihi",
    "Son Kullanma Tarihi",
    "Son Kullanım Tarihi",
    "Son Kullanma",
    "Son Kullanım",
    "Son Kull. Tarihi",
    "Son Kul. Tarihi",
    "Expiry Date",
    "Expiration Date",
    "Expiry",
]


def _normalize_column_name(value: object) -> str:
    text = str(value or "").strip().casefold()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(
        character
        for character in text
        if not unicodedata.combining(character)
    )

    text = text.translate(
        str.maketrans(
            {
                "ı": "i",
                "ş": "s",
                "ğ": "g",
                "ü": "u",
                "ö": "o",
                "ç": "c",
            }
        )
    )

    return re.sub(r"[^a-z0-9]+", "", text)


def _find_expiry_column(df: pd.DataFrame | None) -> str | None:
    if df is None or df.empty:
        return None

    exact_match = find_first_column(
        df,
        EXPIRY_COLUMN_CANDIDATES,
    )

    if exact_match is not None:
        return exact_match

    normalized_columns = {
        column: _normalize_column_name(column)
        for column in df.columns
    }

    normalized_candidates = {
        _normalize_column_name(candidate)
        for candidate in EXPIRY_COLUMN_CANDIDATES
    }

    for column, normalized in normalized_columns.items():
        if normalized in normalized_candidates:
            return column

    expiry_tokens = (
        "miad",
        "miat",
        "skt",
        "sonkullanma",
        "sonkullanim",
        "expiry",
        "expiration",
    )

    for column, normalized in normalized_columns.items():
        if any(token in normalized for token in expiry_tokens):
            return column

    return None


def _parse_expiry_series(series: pd.Series) -> pd.Series:
    parsed = parse_date_series(series)

    if parsed.notna().all():
        return parsed

    numeric = pd.to_numeric(
        series,
        errors="coerce",
    )

    excel_mask = (
        parsed.isna()
        & numeric.notna()
        & numeric.between(20000, 80000)
    )

    if excel_mask.any():
        parsed.loc[excel_mask] = pd.to_datetime(
            numeric.loc[excel_mask],
            unit="D",
            origin="1899-12-30",
            errors="coerce",
        )

    return parsed


def _prepare_expiry_source(
    source_df: pd.DataFrame | None,
) -> tuple[pd.DataFrame | None, str | None, str | None]:
    """
    Kaynak dosyada miad kolonunu bulur ve eşleştirme için
    barkod veya ürün adı anahtarı hazırlar.

    Returns:
        prepared_source,
        match_key_type ("barcode" | "name" | None),
        expiry_column
    """
    if source_df is None or source_df.empty:
        return None, None, None

    expiry_column = _find_expiry_column(source_df)

    if expiry_column is None:
        return None, None, None

    source = source_df.copy()
    source["_source_expiry"] = _parse_expiry_series(
        source[expiry_column]
    )

    source = source[
        source["_source_expiry"].notna()
    ].copy()

    if source.empty:
        return None, None, expiry_column

    barcode_column = find_first_column(
        source,
        ["Barkod", "Barkod No", "Ürün Barkodu"],
    )

    if barcode_column is not None:
        source["_match_key"] = normalize_barcode(
            source[barcode_column]
        )

        source = source[
            source["_match_key"] != ""
        ].copy()

        if not source.empty:
            source = (
                source.sort_values("_source_expiry")
                .drop_duplicates(
                    subset=["_match_key"],
                    keep="last",
                )
            )
            return (
                source[["_match_key", "_source_expiry"]],
                "barcode",
                expiry_column,
            )

    name_column = find_first_column(
        source,
        [
            "Ürün Adı",
            "Ürün",
            "İlaç Adı",
            "Malzeme Adı",
        ],
    )

    if name_column is not None:
        source["_match_key"] = (
            source[name_column]
            .fillna("")
            .astype(str)
            .map(
                lambda value: normalize_text(
                    value
                ).casefold()
            )
        )

        source = source[
            source["_match_key"] != ""
        ].copy()

        if not source.empty:
            source = (
                source.sort_values("_source_expiry")
                .drop_duplicates(
                    subset=["_match_key"],
                    keep="last",
                )
            )
            return (
                source[["_match_key", "_source_expiry"]],
                "name",
                expiry_column,
            )

    return None, None, expiry_column


def _merge_expiry_from_source(
    inventory_df: pd.DataFrame,
    source_df: pd.DataFrame | None,
) -> tuple[pd.DataFrame, dict]:
    """
    Kaynak dosyadaki miad bilgisini envantere taşır.
    Öncelik barkod, fallback ürün adıdır.
    """
    inventory = inventory_df.copy()

    source, match_type, expiry_column = (
        _prepare_expiry_source(source_df)
    )

    metadata = {
        "found": False,
        "match_type": match_type,
        "expiry_column": expiry_column,
        "matched_count": 0,
    }

    if source is None or match_type is None:
        return inventory, metadata

    if match_type == "barcode":
        inventory_barcode_column = find_first_column(
            inventory,
            ["Barkod", "Barkod No", "Ürün Barkodu"],
        )

        if inventory_barcode_column is None:
            return inventory, metadata

        inventory["_match_key"] = normalize_barcode(
            inventory[inventory_barcode_column]
        )

    else:
        inventory_name_column = find_first_column(
            inventory,
            [
                "Ürün Adı",
                "Ürün",
                "İlaç Adı",
                "Malzeme Adı",
            ],
        )

        if inventory_name_column is None:
            return inventory, metadata

        inventory["_match_key"] = (
            inventory[inventory_name_column]
            .fillna("")
            .astype(str)
            .map(
                lambda value: normalize_text(
                    value
                ).casefold()
            )
        )

    inventory = inventory.merge(
        source,
        on="_match_key",
        how="left",
    )

    matched_count = int(
        inventory["_source_expiry"].notna().sum()
    )

    metadata["found"] = matched_count > 0
    metadata["matched_count"] = matched_count

    return inventory, metadata


def build_inventory_intelligence(
    inventory_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
    period_df: pd.DataFrame | None = None,
    target_stock_days: int = 30,
    critical_days: int = 5,
    warning_days: int = 15,
):
    if inventory_df is None or inventory_df.empty:
        return pd.DataFrame(), 30

    inventory = inventory_df.copy()

    barcode_column = find_first_column(
        inventory,
        ["Barkod", "Barkod No", "Ürün Barkodu"],
    )
    name_column = find_first_column(
        inventory,
        ["Ürün Adı", "Ürün", "İlaç Adı"],
    )
    stock_column = find_first_column(
        inventory,
        ["Stok", "Mevcut Stok", "Stok Adedi"],
    )
    critical_column = find_first_column(
        inventory,
        ["Kritik Stok", "Minimum Stok", "Min Stok"],
    )

    price_column = find_first_column(
        inventory,
        ["Psf", "PSF", "Satış Fiyatı", "Alış Fiyatı"],
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

    if stock_column is None:
        return pd.DataFrame(), 30

    out = pd.DataFrame(index=inventory.index)

    out["product_name"] = (
        inventory[name_column]
        .fillna("Bilinmeyen Ürün")
        .astype(str)
        .str.strip()
        if name_column is not None
        else "Bilinmeyen Ürün"
    )

    out["stock"] = to_number(inventory[stock_column])

    out["critical_stock"] = (
        to_number(inventory[critical_column])
        if critical_column is not None
        else 0.0
    )

    out["unit_price"] = (
        to_number(inventory[price_column])
        if price_column is not None
        else 0.0
    )

    out["stock_value"] = (
        to_number(inventory[stock_value_column])
        if stock_value_column is not None
        else out["stock"] * out["unit_price"]
    )

    out["sold_quantity"] = 0.0

    # Analiz döneminin resmi kaynağı mümkünse satış hareketleridir.
    # Ürün bazında toplamlar çoğu zaman tarih kolonu içermez.
    period_source_df = (
        period_df
        if period_df is not None and not period_df.empty
        else product_df
    )

    period_days, _period_assumed = estimate_period_days(
        period_source_df,
        default_days=30,
    )

    if (
        product_df is not None
        and not product_df.empty
        and barcode_column is not None
    ):
        product = product_df.copy()

        product_barcode_column = find_first_column(
            product,
            ["Barkod", "Barkod No", "Ürün Barkodu"],
        )
        sold_column = find_first_column(
            product,
            ["Satılan Adet", "Satış Adedi", "Adet"],
        )

        if (
            product_barcode_column is not None
            and sold_column is not None
        ):
            out["_barcode"] = normalize_barcode(
                inventory[barcode_column]
            )
            product["_barcode"] = normalize_barcode(
                product[product_barcode_column]
            )
            product["_sold"] = to_number(product[sold_column])

            product = product[product["_barcode"] != ""]

            summary = (
                product.groupby("_barcode", as_index=False)["_sold"]
                .sum()
            )

            out = out.merge(
                summary,
                on="_barcode",
                how="left",
            )

            out["sold_quantity"] = out["_sold"].fillna(0.0)

    out["daily_consumption"] = (
        out["sold_quantity"] / max(period_days, 1)
    )

    out["stock_days"] = out.apply(
        lambda row: (
            float(row["stock"])
            / float(row["daily_consumption"])
            if float(row["daily_consumption"]) > 0
            else math.inf
        ),
        axis=1,
    )

    out["estimated_runout_days"] = out["stock_days"]

    out["target_stock"] = (
        out["daily_consumption"] * target_stock_days
    ).apply(math.ceil)

    out["recommended_order"] = (
        out["target_stock"] - out["stock"]
    ).clip(lower=0).apply(math.ceil)

    out["estimated_order_value"] = (
        out["recommended_order"] * out["unit_price"]
    )

    out["stock_status"] = "Güvenli"

    out.loc[
        (out["stock"] <= 0)
        & (out["sold_quantity"] > 0),
        "stock_status",
    ] = "Sıfır Stok"

    out.loc[
        (out["stock"] > 0)
        & (out["daily_consumption"] > 0)
        & (out["stock_days"] <= critical_days),
        "stock_status",
    ] = "Kritik"

    out.loc[
        (out["stock"] > 0)
        & (out["daily_consumption"] > 0)
        & (out["stock_days"] > critical_days)
        & (out["stock_days"] <= warning_days),
        "stock_status",
    ] = "Dikkat"

    out.loc[
        (out["stock"] > 0)
        & (out["sold_quantity"] <= 0),
        "stock_status",
    ] = "Ölü Stok"

    return out, period_days


def calculate_expiry_metrics(
    inventory_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
    sales_df: pd.DataFrame | None = None,
    warning_days: int = 90,
):
    if inventory_df is None or inventory_df.empty:
        return {
            "success": False,
            "error": "Envanter dosyası boş veya bulunamadı.",
            "expiry_source": None,
            "expiry_column": None,
            "matched_expiry_count": 0,
            "warning_days": warning_days,
            "warning_count": 0,
            "expired_count": 0,
            "risk_stock_value": 0,
            "nearest_expiry_days": None,
            "products": [],
        }

    df = inventory_df.copy()

    inventory_expiry_column = _find_expiry_column(df)

    expiry_source = None
    expiry_column = None
    matched_expiry_count = 0
    match_type = None

    if inventory_expiry_column is not None:
        df["_expiry"] = _parse_expiry_series(
            df[inventory_expiry_column]
        )
        expiry_source = "inventory"
        expiry_column = inventory_expiry_column
        matched_expiry_count = int(
            df["_expiry"].notna().sum()
        )
    else:
        df, product_metadata = _merge_expiry_from_source(
            inventory_df=df,
            source_df=product_df,
        )

        if product_metadata["found"]:
            df["_expiry"] = df["_source_expiry"]
            expiry_source = "product_sales"
            expiry_column = product_metadata[
                "expiry_column"
            ]
            matched_expiry_count = product_metadata[
                "matched_count"
            ]
            match_type = product_metadata[
                "match_type"
            ]
        else:
            df = df.drop(
                columns=[
                    "_match_key",
                    "_source_expiry",
                ],
                errors="ignore",
            )

            df, sales_metadata = _merge_expiry_from_source(
                inventory_df=df,
                source_df=sales_df,
            )

            if sales_metadata["found"]:
                df["_expiry"] = df["_source_expiry"]
                expiry_source = "sales"
                expiry_column = sales_metadata[
                    "expiry_column"
                ]
                matched_expiry_count = sales_metadata[
                    "matched_count"
                ]
                match_type = sales_metadata[
                    "match_type"
                ]

    if "_expiry" not in df.columns:
        return {
            "success": False,
            "error": (
                "Miad/SKT bilgisi Envanter, Ürün Satış ve "
                "Satış dosyalarında bulunamadı veya envanterle "
                "eşleştirilemedi."
            ),
            "expiry_source": None,
            "expiry_column": None,
            "match_type": None,
            "matched_expiry_count": 0,
            "inventory_columns": [
                str(column)
                for column in inventory_df.columns
            ],
            "product_columns": (
                [
                    str(column)
                    for column in product_df.columns
                ]
                if product_df is not None
                else []
            ),
            "sales_columns": (
                [
                    str(column)
                    for column in sales_df.columns
                ]
                if sales_df is not None
                else []
            ),
            "warning_days": warning_days,
            "warning_count": 0,
            "expired_count": 0,
            "risk_stock_value": 0,
            "nearest_expiry_days": None,
            "products": [],
        }

    name_column = find_first_column(
        df,
        [
            "Ürün Adı",
            "Ürün",
            "İlaç Adı",
            "Malzeme Adı",
        ],
    )

    stock_column = find_first_column(
        df,
        [
            "Stok",
            "Mevcut Stok",
            "Stok Adedi",
            "Kalan Stok",
        ],
    )

    price_column = find_first_column(
        df,
        [
            "Alış Fiyatı",
            "Net Alış Fiyatı",
            "Maliyet",
            "Psf",
            "PSF",
            "Satış Fiyatı",
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

    supplier_column = find_first_column(
        df,
        [
            "Tedarikçi",
            "Tedarikci",
            "Firma",
        ],
    )

    shelf_column = find_first_column(
        df,
        [
            "Raf Lokasyonu",
            "Raf",
            "Lokasyon",
        ],
    )

    category_column = find_first_column(
        df,
        [
            "Kategori",
            "Ürün Kategorisi",
            "Kategori Adı",
        ],
    )

    df["_stock"] = (
        to_number(df[stock_column])
        if stock_column is not None
        else 0.0
    )

    df["_price"] = (
        to_number(df[price_column])
        if price_column is not None
        else 0.0
    )

    df["_stock_value"] = (
        to_number(df[stock_value_column])
        if stock_value_column is not None
        else df["_stock"] * df["_price"]
    )

    today = pd.Timestamp(date.today()).normalize()

    df["_days"] = (
        df["_expiry"] - today
    ).dt.days

    valid_expiry = df[
        df["_expiry"].notna()
    ].copy()

    active_stock = valid_expiry[
        valid_expiry["_stock"] > 0
    ].copy()

    active = active_stock[
        active_stock["_days"] <= warning_days
    ].copy()

    expired = active[
        active["_days"] < 0
    ].copy()

    warning = active[
        active["_days"] >= 0
    ].copy()

    products = []

    for _, row in (
        active.sort_values("_days")
        .head(100)
        .iterrows()
    ):
        days = int(row["_days"])

        products.append(
            {
                "product_name": (
                    str(row[name_column]).strip()
                    if name_column is not None
                    else "Bilinmeyen Ürün"
                ),
                "category": (
                    str(row[category_column]).strip()
                    if category_column is not None
                    else "-"
                ),
                "expiry_date": row["_expiry"].strftime(
                    "%Y-%m-%d"
                ),
                "days_left": days,
                "stock": round(
                    float(row["_stock"]),
                    2,
                ),
                "stock_value": round(
                    float(row["_stock_value"]),
                    2,
                ),
                "status": (
                    "Miadı Geçmiş"
                    if days < 0
                    else "Çok Yakın"
                    if days <= 30
                    else "Yaklaşıyor"
                ),
                "supplier": (
                    str(row[supplier_column]).strip()
                    if supplier_column is not None
                    else "-"
                ),
                "shelf": (
                    str(row[shelf_column]).strip()
                    if shelf_column is not None
                    else "-"
                ),
            }
        )

    nearest = (
        int(warning["_days"].min())
        if not warning.empty
        else None
    )

    warnings = []

    if expiry_source != "inventory":
        warnings.append(
            "Miad bilgisi envanter dosyasında bulunamadığı için "
            f"{expiry_source} dosyasından {match_type} ile eşleştirildi."
        )

    return {
        "success": True,
        "expiry_source": expiry_source,
        "expiry_column": expiry_column,
        "match_type": match_type,
        "matched_expiry_count": matched_expiry_count,
        "valid_expiry_count": int(
            len(valid_expiry)
        ),
        "warning_days": warning_days,
        "warning_count": int(
            len(warning)
        ),
        "expired_count": int(
            len(expired)
        ),
        "risk_stock_value": round(
            float(
                active[
                    "_stock_value"
                ].sum()
            ),
            2,
        ),
        "nearest_expiry_days": nearest,
        "products": products,
        "warnings": warnings,
    }