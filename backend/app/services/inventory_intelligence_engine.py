import math
from datetime import date

import pandas as pd


def find_first_column(df: pd.DataFrame, candidates: list[str]):
    for column in candidates:
        if column in df.columns:
            return column
    return None


def to_number(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def normalize_barcode(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        .str.strip()
        .str.replace(r"\.0$", "", regex=True)
    )


def estimate_period_days(product_df: pd.DataFrame | None, default_days: int = 30) -> int:
    if product_df is None or product_df.empty:
        return default_days

    date_column = find_first_column(
        product_df,
        ["Tarih", "Satış Tarihi", "İşlem Tarihi", "Reç. Tar", "Alım Tarih"],
    )
    if date_column is None:
        return default_days

    dates = pd.to_datetime(product_df[date_column], errors="coerce", dayfirst=True).dropna()
    if dates.empty:
        return default_days

    span = int((dates.max().normalize() - dates.min().normalize()).days) + 1
    return max(1, min(span, 365))


def build_inventory_intelligence(
    inventory_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
    target_stock_days: int = 30,
    critical_days: int = 5,
    warning_days: int = 15,
):
    if inventory_df is None or inventory_df.empty:
        return pd.DataFrame(), 30

    inventory = inventory_df.copy()

    barcode_column = find_first_column(inventory, ["Barkod", "Barkod No", "Ürün Barkodu"])
    name_column = find_first_column(inventory, ["Ürün Adı", "Ürün", "İlaç Adı"])
    stock_column = find_first_column(inventory, ["Stok", "Mevcut Stok", "Stok Adedi"])
    critical_column = find_first_column(inventory, ["Kritik Stok", "Minimum Stok", "Min Stok"])
    price_column = find_first_column(inventory, ["Psf", "PSF", "Satış Fiyatı", "Alış Fiyatı"])
    stock_value_column = find_first_column(
        inventory,
        ["Mal Top(Kdv Dahil)", "Mal Top(Kdv Hariç)", "Psf Toplam", "Stok Değeri"],
    )

    if stock_column is None:
        return pd.DataFrame(), 30

    out = pd.DataFrame(index=inventory.index)
    out["product_name"] = (
        inventory[name_column].fillna("Bilinmeyen Ürün").astype(str).str.strip()
        if name_column is not None
        else "Bilinmeyen Ürün"
    )
    out["stock"] = to_number(inventory[stock_column])
    out["critical_stock"] = to_number(inventory[critical_column]) if critical_column else 0
    out["unit_price"] = to_number(inventory[price_column]) if price_column else 0
    out["stock_value"] = (
        to_number(inventory[stock_value_column])
        if stock_value_column
        else out["stock"] * out["unit_price"]
    )
    out["sold_quantity"] = 0.0

    period_days = estimate_period_days(product_df, default_days=30)

    if product_df is not None and not product_df.empty and barcode_column is not None:
        product = product_df.copy()
        product_barcode_column = find_first_column(product, ["Barkod", "Barkod No", "Ürün Barkodu"])
        sold_column = find_first_column(product, ["Satılan Adet", "Satış Adedi", "Adet"])
        if product_barcode_column is not None and sold_column is not None:
            out["_barcode"] = normalize_barcode(inventory[barcode_column])
            product["_barcode"] = normalize_barcode(product[product_barcode_column])
            product["_sold"] = to_number(product[sold_column])
            summary = product.groupby("_barcode", as_index=False)["_sold"].sum()
            out = out.merge(summary, on="_barcode", how="left")
            out["sold_quantity"] = out["_sold"].fillna(0)

    out["daily_consumption"] = out["sold_quantity"] / max(period_days, 1)
    out["stock_days"] = out.apply(
        lambda row: (
            float(row["stock"]) / float(row["daily_consumption"])
            if float(row["daily_consumption"]) > 0
            else math.inf
        ),
        axis=1,
    )
    out["estimated_runout_days"] = out["stock_days"]
    out["target_stock"] = (out["daily_consumption"] * target_stock_days).apply(math.ceil)
    out["recommended_order"] = (out["target_stock"] - out["stock"]).clip(lower=0).apply(math.ceil)
    out["estimated_order_value"] = out["recommended_order"] * out["unit_price"]

    out["stock_status"] = "Güvenli"
    out.loc[(out["stock"] <= 0) & (out["sold_quantity"] > 0), "stock_status"] = "Sıfır Stok"
    out.loc[
        (out["stock"] > 0) & (out["daily_consumption"] > 0) & (out["stock_days"] <= critical_days),
        "stock_status",
    ] = "Kritik"
    out.loc[
        (out["stock"] > 0)
        & (out["daily_consumption"] > 0)
        & (out["stock_days"] > critical_days)
        & (out["stock_days"] <= warning_days),
        "stock_status",
    ] = "Dikkat"
    out.loc[(out["stock"] > 0) & (out["sold_quantity"] <= 0), "stock_status"] = "Ölü Stok"

    return out, period_days


def calculate_expiry_metrics(inventory_df: pd.DataFrame, warning_days: int = 90):
    if inventory_df is None or inventory_df.empty:
        return {
            "success": False,
            "error": "Envanter dosyası boş veya bulunamadı.",
            "warning_count": 0,
            "expired_count": 0,
            "risk_stock_value": 0,
            "nearest_expiry_days": None,
            "products": [],
        }

    df = inventory_df.copy()
    expiry_column = find_first_column(
        df,
        ["Miad Tarihi", "Miat Tarihi", "SKT", "Son Kullanma Tarihi", "Son Kullanım Tarihi", "Miad"],
    )
    if expiry_column is None:
        return {
            "success": False,
            "error": "Envanter dosyasında miad/SKT kolonu bulunamadı.",
            "warning_count": 0,
            "expired_count": 0,
            "risk_stock_value": 0,
            "nearest_expiry_days": None,
            "products": [],
        }

    name_column = find_first_column(df, ["Ürün Adı", "Ürün", "İlaç Adı"])
    stock_column = find_first_column(df, ["Stok", "Mevcut Stok", "Stok Adedi"])
    price_column = find_first_column(df, ["Psf", "PSF", "Satış Fiyatı", "Alış Fiyatı"])
    stock_value_column = find_first_column(
        df,
        ["Mal Top(Kdv Dahil)", "Mal Top(Kdv Hariç)", "Psf Toplam", "Stok Değeri"],
    )
    supplier_column = find_first_column(df, ["Tedarikçi", "Tedarikci", "Firma"])
    shelf_column = find_first_column(df, ["Raf Lokasyonu", "Raf", "Lokasyon"])

    df["_expiry"] = pd.to_datetime(df[expiry_column], errors="coerce", dayfirst=True)
    df["_stock"] = to_number(df[stock_column]) if stock_column else 0
    df["_price"] = to_number(df[price_column]) if price_column else 0
    df["_stock_value"] = (
        to_number(df[stock_value_column]) if stock_value_column else df["_stock"] * df["_price"]
    )
    today = pd.Timestamp(date.today())
    df["_days"] = (df["_expiry"] - today).dt.days

    active = df[df["_expiry"].notna() & (df["_days"] <= warning_days)].copy()
    expired = active[active["_days"] < 0]
    warning = active[active["_days"] >= 0]

    products = []
    for _, row in active.sort_values("_days").head(50).iterrows():
        days = int(row["_days"])
        products.append(
            {
                "product_name": str(row[name_column]) if name_column else "Bilinmeyen Ürün",
                "expiry_date": row["_expiry"].strftime("%Y-%m-%d"),
                "days_left": days,
                "stock": float(row["_stock"]),
                "stock_value": round(float(row["_stock_value"]), 2),
                "status": "Miadı Geçmiş" if days < 0 else "Çok Yakın" if days <= 30 else "Yaklaşıyor",
                "supplier": str(row[supplier_column]) if supplier_column else "-",
                "shelf": str(row[shelf_column]) if shelf_column else "-",
            }
        )

    nearest = int(warning["_days"].min()) if not warning.empty else None
    return {
        "success": True,
        "warning_days": warning_days,
        "warning_count": int(len(warning)),
        "expired_count": int(len(expired)),
        "risk_stock_value": round(float(active["_stock_value"].sum()), 2),
        "nearest_expiry_days": nearest,
        "products": products,
    }
