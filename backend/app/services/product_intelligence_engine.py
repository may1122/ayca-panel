import math

import pandas as pd

from app.services.data_quality import (
    find_first_column,
    normalize_barcode,
    normalize_text,
    to_number,
)
from app.services.inventory_intelligence_engine import (
    build_inventory_intelligence,
)


PRODUCT_NAME_CANDIDATES = [
    "Ürün Adı (İçinde Geçen İsim Şeklinde Arama Yapılabilir)",
    "Ürün Adı",
    "Ürün",
    "İlaç Adı",
]

BARCODE_CANDIDATES = [
    "Barkod",
    "Barkod No",
    "Ürün Barkodu",
]

QUANTITY_CANDIDATES = [
    "Satılan Adet",
    "Satış Adedi",
    "Adet",
    "Miktar",
]

TURNOVER_CANDIDATES = [
    "Satış Tutarı",
    "Toplam Tutar",
    "Ciro",
    "Net Tutar",
]

PROFIT_CANDIDATES = [
    "Kar Tutarı",
    "Kâr Tutarı",
    "Brüt Kar",
    "Brüt Kâr",
]

COST_CANDIDATES = [
    "Maliyet Tutarı",
    "Toplam Maliyet",
    "Maliyet",
]

RETURN_QUANTITY_CANDIDATES = [
    "İade Adedi",
    "İade Miktarı",
    "İade",
]


def _safe_float(value) -> float:
    try:
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return 0.0
        return number
    except (TypeError, ValueError):
        return 0.0


def _safe_optional_float(value):
    try:
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return None
        return number
    except (TypeError, ValueError):
        return None


def _build_product_sales_summary(
    product_df: pd.DataFrame | None,
) -> tuple[pd.DataFrame, dict]:
    """
    Ürün Bazında Toplamlar dosyasını ürün seviyesinde normalize eder.

    Öncelik:
    1) Barkod ile eşleştirme
    2) Barkod yoksa normalize ürün adı ile eşleştirme

    Dönüş:
        summary dataframe,
        kullanılan kolonlara ait metadata
    """
    empty_columns = [
        "_barcode",
        "_name_key",
        "product_name",
        "quantity_sold",
        "turnover",
        "profit",
        "cost",
        "return_quantity",
    ]

    if product_df is None or product_df.empty:
        return pd.DataFrame(columns=empty_columns), {
            "product_name_column": None,
            "barcode_column": None,
            "quantity_column": None,
            "turnover_column": None,
            "profit_column": None,
            "cost_column": None,
            "return_quantity_column": None,
        }

    df = product_df.copy()

    product_name_column = find_first_column(
        df,
        PRODUCT_NAME_CANDIDATES,
    )
    barcode_column = find_first_column(
        df,
        BARCODE_CANDIDATES,
    )
    quantity_column = find_first_column(
        df,
        QUANTITY_CANDIDATES,
    )
    turnover_column = find_first_column(
        df,
        TURNOVER_CANDIDATES,
    )
    profit_column = find_first_column(
        df,
        PROFIT_CANDIDATES,
    )
    cost_column = find_first_column(
        df,
        COST_CANDIDATES,
    )
    return_quantity_column = find_first_column(
        df,
        RETURN_QUANTITY_CANDIDATES,
    )

    df["_barcode"] = (
        normalize_barcode(df[barcode_column])
        if barcode_column is not None
        else ""
    )

    if product_name_column is not None:
        df["product_name"] = (
            df[product_name_column]
            .fillna("Bilinmeyen Ürün")
            .astype(str)
            .str.strip()
            .replace("", "Bilinmeyen Ürün")
        )
        df["_name_key"] = (
            df["product_name"]
            .map(lambda value: normalize_text(value).casefold())
        )
    else:
        df["product_name"] = "Bilinmeyen Ürün"
        df["_name_key"] = ""

    df["_quantity"] = (
        to_number(df[quantity_column])
        if quantity_column is not None
        else 0.0
    )

    df["_turnover"] = (
        to_number(df[turnover_column])
        if turnover_column is not None
        else 0.0
    )

    if profit_column is not None:
        df["_profit"] = to_number(df[profit_column])
        df["_cost"] = (
            to_number(df[cost_column])
            if cost_column is not None
            else df["_turnover"] - df["_profit"]
        )
    elif cost_column is not None and turnover_column is not None:
        df["_cost"] = to_number(df[cost_column])
        df["_profit"] = df["_turnover"] - df["_cost"]
    else:
        df["_profit"] = 0.0
        df["_cost"] = 0.0

    df["_return_quantity"] = (
        to_number(df[return_quantity_column])
        if return_quantity_column is not None
        else 0.0
    )

    # Barkodu olan ürünlerde barkodu ana anahtar olarak kullan.
    barcode_rows = df[df["_barcode"] != ""].copy()

    barcode_summary = pd.DataFrame()

    if not barcode_rows.empty:
        barcode_summary = (
            barcode_rows.groupby(
                "_barcode",
                as_index=False,
            )
            .agg(
                {
                    "product_name": "last",
                    "_name_key": "last",
                    "_quantity": "sum",
                    "_turnover": "sum",
                    "_profit": "sum",
                    "_cost": "sum",
                    "_return_quantity": "sum",
                }
            )
            .rename(
                columns={
                    "_quantity": "quantity_sold",
                    "_turnover": "turnover",
                    "_profit": "profit",
                    "_cost": "cost",
                    "_return_quantity": "return_quantity",
                }
            )
        )

    # Barkodu olmayan ürünlerde normalize ürün adını fallback anahtar yap.
    name_rows = df[
        (df["_barcode"] == "")
        & (df["_name_key"] != "")
    ].copy()

    name_summary = pd.DataFrame()

    if not name_rows.empty:
        name_summary = (
            name_rows.groupby(
                "_name_key",
                as_index=False,
            )
            .agg(
                {
                    "product_name": "last",
                    "_quantity": "sum",
                    "_turnover": "sum",
                    "_profit": "sum",
                    "_cost": "sum",
                    "_return_quantity": "sum",
                }
            )
            .rename(
                columns={
                    "_quantity": "quantity_sold",
                    "_turnover": "turnover",
                    "_profit": "profit",
                    "_cost": "cost",
                    "_return_quantity": "return_quantity",
                }
            )
        )
        name_summary["_barcode"] = ""

    frames = [
        frame
        for frame in [barcode_summary, name_summary]
        if not frame.empty
    ]

    if frames:
        summary = pd.concat(
            frames,
            ignore_index=True,
            sort=False,
        )
    else:
        summary = pd.DataFrame(columns=empty_columns)

    for column in [
        "quantity_sold",
        "turnover",
        "profit",
        "cost",
        "return_quantity",
    ]:
        if column not in summary.columns:
            summary[column] = 0.0

    metadata = {
        "product_name_column": product_name_column,
        "barcode_column": barcode_column,
        "quantity_column": quantity_column,
        "turnover_column": turnover_column,
        "profit_column": profit_column,
        "cost_column": cost_column,
        "return_quantity_column": return_quantity_column,
    }

    return summary, metadata


def _merge_sales_metrics(
    intelligence: pd.DataFrame,
    product_summary: pd.DataFrame,
) -> pd.DataFrame:
    out = intelligence.copy()

    if out.empty:
        return out

    if "_barcode" not in out.columns:
        out["_barcode"] = ""

    out["_name_key"] = (
        out["product_name"]
        .fillna("")
        .astype(str)
        .map(lambda value: normalize_text(value).casefold())
    )

    metric_columns = [
        "turnover",
        "profit",
        "cost",
        "return_quantity",
    ]

    for column in metric_columns:
        out[column] = 0.0

    if product_summary.empty:
        return out

    # 1) Barkod eşleşmesi
    barcode_summary = product_summary[
        product_summary["_barcode"] != ""
    ].copy()

    if not barcode_summary.empty:
        barcode_metrics = barcode_summary[
            [
                "_barcode",
                "turnover",
                "profit",
                "cost",
                "return_quantity",
            ]
        ].drop_duplicates(
            subset=["_barcode"],
            keep="last",
        )

        out = out.merge(
            barcode_metrics,
            on="_barcode",
            how="left",
            suffixes=("", "_barcode_match"),
        )

        for column in metric_columns:
            match_column = f"{column}_barcode_match"

            if match_column in out.columns:
                out[column] = (
                    out[match_column]
                    .fillna(out[column])
                )
                out = out.drop(
                    columns=[match_column],
                    errors="ignore",
                )

    # 2) Barkodla finans metriği bulunamayanlar için isim fallback
    name_summary = product_summary[
        product_summary["_name_key"] != ""
    ].copy()

    if not name_summary.empty:
        name_metrics = (
            name_summary.groupby(
                "_name_key",
                as_index=False,
            )
            .agg(
                {
                    "turnover": "sum",
                    "profit": "sum",
                    "cost": "sum",
                    "return_quantity": "sum",
                }
            )
        )

        out = out.merge(
            name_metrics,
            on="_name_key",
            how="left",
            suffixes=("", "_name_match"),
        )

        for column in metric_columns:
            match_column = f"{column}_name_match"

            if match_column in out.columns:
                out[column] = out.apply(
                    lambda row: (
                        row[column]
                        if _safe_float(row[column]) != 0
                        else _safe_float(row[match_column])
                    ),
                    axis=1,
                )
                out = out.drop(
                    columns=[match_column],
                    errors="ignore",
                )

    return out


def _performance_status(row: pd.Series) -> str:
    sold_quantity = _safe_float(row.get("sold_quantity"))
    stock = _safe_float(row.get("stock"))
    stock_days = _safe_optional_float(row.get("stock_days"))
    profit = _safe_float(row.get("profit"))
    turnover = _safe_float(row.get("turnover"))
    profit_margin = _safe_float(row.get("profit_margin"))

    if sold_quantity <= 0 and stock > 0:
        return "Ölü / Hareketsiz"

    if sold_quantity > 0 and stock <= 0:
        return "Satış Var - Stok Yok"

    if (
        sold_quantity > 0
        and stock_days is not None
        and stock_days <= 5
    ):
        return "Yüksek Talep - Kritik Stok"

    if (
        turnover > 0
        and profit <= 0
    ):
        return "Satış Var - Kâr Yok"

    if (
        turnover > 0
        and profit_margin < 8
    ):
        return "Düşük Marj"

    if (
        sold_quantity > 0
        and stock_days is not None
        and stock_days > 60
    ):
        return "Fazla Stok Riski"

    if sold_quantity > 0:
        return "Sağlıklı"

    return "İzlenmeli"


def _recommended_action(row: pd.Series) -> str:
    status = str(row.get("performance_status") or "")
    recommended_order = int(
        max(
            0,
            round(
                _safe_float(
                    row.get("recommended_order")
                )
            ),
        )
    )

    if status == "Satış Var - Stok Yok":
        if recommended_order > 0:
            return (
                f"Stok tükenmiş. Öncelikli olarak yaklaşık "
                f"{recommended_order} adet sipariş değerlendir."
            )
        return "Stok tükenmiş; tedarik durumunu kontrol et."

    if status == "Yüksek Talep - Kritik Stok":
        if recommended_order > 0:
            return (
                f"Satış hızı yüksek. Yaklaşık "
                f"{recommended_order} adet siparişi önceliklendir."
            )
        return "Satış hızı yüksek; stok seviyesini yakından takip et."

    if status == "Ölü / Hareketsiz":
        return (
            "Yeni sipariş verme; mevcut stoğun eritilmesi, iade veya "
            "transfer seçeneklerini değerlendir."
        )

    if status == "Fazla Stok Riski":
        return (
            "Yeni siparişi ertele; mevcut stok devir hızını ve bağlı "
            "sermayeyi takip et."
        )

    if status == "Satış Var - Kâr Yok":
        return (
            "Satış devam ediyor ancak kâr oluşmuyor; alış maliyeti ve "
            "fiyatlandırmayı kontrol et."
        )

    if status == "Düşük Marj":
        return (
            "Ürün satıyor ancak marj düşük; maliyet ve satış fiyatını "
            "yeniden değerlendir."
        )

    if status == "Sağlıklı":
        return "Mevcut satış ve stok dengesini koru."

    return "Ürünü satış, stok ve kârlılık açısından izlemeye devam et."


def _product_record(row: pd.Series) -> dict:
    stock_days = _safe_optional_float(
        row.get("stock_days")
    )

    return {
        "product_name": str(
            row.get("product_name")
            or "Bilinmeyen Ürün"
        ),
        "barcode": str(
            row.get("_barcode")
            or ""
        ),
        "stock": round(
            _safe_float(row.get("stock")),
            2,
        ),
        "critical_stock": round(
            _safe_float(row.get("critical_stock")),
            2,
        ),
        "stock_value": round(
            _safe_float(row.get("stock_value")),
            2,
        ),
        "stock_status": str(
            row.get("stock_status")
            or "Bilinmiyor"
        ),
        "quantity_sold": round(
            _safe_float(row.get("sold_quantity")),
            2,
        ),
        "daily_consumption": round(
            _safe_float(row.get("daily_consumption")),
            4,
        ),
        "stock_days": (
            round(stock_days, 1)
            if stock_days is not None
            else None
        ),
        "turnover": round(
            _safe_float(row.get("turnover")),
            2,
        ),
        "profit": round(
            _safe_float(row.get("profit")),
            2,
        ),
        "cost": round(
            _safe_float(row.get("cost")),
            2,
        ),
        "profit_margin": round(
            _safe_float(row.get("profit_margin")),
            2,
        ),
        "return_quantity": round(
            _safe_float(row.get("return_quantity")),
            2,
        ),
        "recommended_order": int(
            max(
                0,
                round(
                    _safe_float(
                        row.get("recommended_order")
                    )
                ),
            )
        ),
        "estimated_order_value": round(
            _safe_float(
                row.get("estimated_order_value")
            ),
            2,
        ),
        "performance_status": str(
            row.get("performance_status")
            or "İzlenmeli"
        ),
        "recommended_action": str(
            row.get("recommended_action")
            or ""
        ),
    }


def calculate_product_intelligence(
    inventory_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
    target_stock_days: int = 30,
):
    """
    AYÇA Product Intelligence V1

    Envanter + Ürün Bazında Toplamlar verisini birleştirerek
    ürün bazında satış, stok, ciro, kâr ve sipariş zekâsı üretir.

    Hesapların tamamı yüklenen Excel verilerinden türetilir.
    """
    if inventory_df is None or inventory_df.empty:
        return {
            "success": False,
            "error": "Envanter dosyası boş veya bulunamadı.",
            "analysis_period_days": 30,
            "product_count": 0,
            "products": [],
            "top_selling_products": [],
            "top_turnover_products": [],
            "top_profit_products": [],
            "critical_high_demand_products": [],
            "capital_locked_products": [],
            "low_margin_products": [],
            "dead_products": [],
            "warnings": [],
        }

    intelligence, period_days = build_inventory_intelligence(
        inventory_df=inventory_df,
        product_df=product_df,
        target_stock_days=target_stock_days,
    )

    if intelligence.empty:
        return {
            "success": False,
            "error": "Product Intelligence için stok verisi üretilemedi.",
            "analysis_period_days": period_days,
            "product_count": 0,
            "products": [],
            "top_selling_products": [],
            "top_turnover_products": [],
            "top_profit_products": [],
            "critical_high_demand_products": [],
            "capital_locked_products": [],
            "low_margin_products": [],
            "dead_products": [],
            "warnings": [],
        }

    product_summary, metadata = _build_product_sales_summary(
        product_df
    )

    intelligence = _merge_sales_metrics(
        intelligence=intelligence,
        product_summary=product_summary,
    )

    intelligence["profit_margin"] = intelligence.apply(
        lambda row: (
            (
                _safe_float(row.get("profit"))
                / _safe_float(row.get("turnover"))
            )
            * 100
            if _safe_float(row.get("turnover")) > 0
            else 0.0
        ),
        axis=1,
    )

    intelligence["performance_status"] = intelligence.apply(
        _performance_status,
        axis=1,
    )

    intelligence["recommended_action"] = intelligence.apply(
        _recommended_action,
        axis=1,
    )

    records = [
        _product_record(row)
        for _, row in intelligence.iterrows()
    ]

    def top_records(
        frame: pd.DataFrame,
        sort_column: str,
        count: int = 50,
        ascending: bool = False,
    ) -> list[dict]:
        if frame.empty or sort_column not in frame.columns:
            return []

        selected = (
            frame.sort_values(
                sort_column,
                ascending=ascending,
            )
            .head(count)
        )

        return [
            _product_record(row)
            for _, row in selected.iterrows()
        ]

    top_selling_products = top_records(
        intelligence[
            intelligence["sold_quantity"] > 0
        ],
        "sold_quantity",
    )

    top_turnover_products = top_records(
        intelligence[
            intelligence["turnover"] > 0
        ],
        "turnover",
    )

    top_profit_products = top_records(
        intelligence[
            intelligence["profit"] != 0
        ],
        "profit",
    )

    critical_high_demand = intelligence[
        (
            intelligence["sold_quantity"] > 0
        )
        & (
            (
                intelligence["stock"] <= 0
            )
            | (
                intelligence["stock_status"].isin(
                    [
                        "Sıfır Stok",
                        "Kritik",
                        "Dikkat",
                    ]
                )
            )
        )
    ].copy()

    critical_high_demand["_priority_score"] = (
        critical_high_demand["sold_quantity"]
        / critical_high_demand[
            "stock_days"
        ].replace(
            [math.inf, 0],
            0.1,
        )
    )

    critical_high_demand_products = top_records(
        critical_high_demand,
        "_priority_score",
    )

    capital_locked = intelligence[
        intelligence["stock_value"] > 0
    ].copy()

    capital_locked_products = top_records(
        capital_locked,
        "stock_value",
    )

    low_margin = intelligence[
        (
            intelligence["turnover"] > 0
        )
        & (
            intelligence["profit_margin"] < 8
        )
    ].copy()

    low_margin_products = top_records(
        low_margin,
        "turnover",
    )

    dead_products_df = intelligence[
        intelligence["performance_status"]
        == "Ölü / Hareketsiz"
    ].copy()

    dead_products = top_records(
        dead_products_df,
        "stock_value",
    )

    warnings = []

    if product_df is None or product_df.empty:
        warnings.append(
            "Ürün Bazında Toplamlar verisi bulunamadı; "
            "ciro, kâr ve ürün satış karşılaştırmaları sınırlı."
        )

    if metadata["barcode_column"] is None:
        warnings.append(
            "Ürün toplamlarında barkod kolonu bulunamadı; "
            "eşleştirmede ürün adı fallback olarak kullanılabilir."
        )

    if metadata["turnover_column"] is None:
        warnings.append(
            "Ürün bazlı ciro kolonu bulunamadı."
        )

    if (
        metadata["profit_column"] is None
        and metadata["cost_column"] is None
    ):
        warnings.append(
            "Ürün bazlı kâr veya maliyet kolonu bulunamadı; "
            "kârlılık analizi üretilemedi."
        )

    return {
        "success": True,
        "analysis_period_days": int(period_days),
        "target_stock_days": int(target_stock_days),
        "product_count": int(len(intelligence)),
        "source_columns": metadata,
        "products": records,
        "top_selling_products": top_selling_products,
        "top_turnover_products": top_turnover_products,
        "top_profit_products": top_profit_products,
        "critical_high_demand_products": critical_high_demand_products,
        "capital_locked_products": capital_locked_products,
        "low_margin_products": low_margin_products,
        "dead_products": dead_products,
        "warnings": warnings,
    }