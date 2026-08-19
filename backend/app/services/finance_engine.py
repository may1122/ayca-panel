import pandas as pd


def find_first_column(df: pd.DataFrame, candidates: list[str]):
    for column in candidates:
        if column in df.columns:
            return column
    return None


def to_number(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def calculate_category_metrics(
    sales_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
):
    """Kategori bazlı ciro, kâr, marj, satış ve işlem performansı üretir."""

    source_df = sales_df.copy()
    category_column = find_first_column(
        source_df,
        ["Kategori", "Ürün Kategorisi", "Kategori Adı", "Ana Kategori", "İlaç Dışı Ürün Grubu"],
    )

    if category_column is None and product_df is not None and not product_df.empty:
        source_df = product_df.copy()
        category_column = find_first_column(
            source_df,
            ["Kategori", "Ürün Kategorisi", "Kategori Adı", "Ana Kategori", "İlaç Dışı Ürün Grubu"],
        )

    if category_column is None:
        return []

    amount_column = find_first_column(
        source_df,
        ["Toplam Tutar", "Ödenen Tutar", "Tutar", "Net Tutar", "Satış Tutarı", "Ciro"],
    )
    profit_column = find_first_column(
        source_df,
        ["Kar Tutarı", "Kâr Tutarı", "Brüt Kar", "Brüt Kâr"],
    )
    quantity_column = find_first_column(
        source_df,
        ["Satılan Adet", "Satış Adedi", "Adet", "Miktar"],
    )
    transaction_column = find_first_column(
        source_df,
        [
            "Fiş/Reçete No",
            "Fis Recete No",
            "Fiş No",
            "Reçete No",
            "Reçete Numarası",
            "İşlem No",
            "Belge No",
        ],
    )

    source_df["_category"] = (
        source_df[category_column]
        .fillna("Kategorisiz")
        .astype(str)
        .str.strip()
        .replace("", "Kategorisiz")
    )
    source_df["_turnover"] = (
        to_number(source_df[amount_column]) if amount_column is not None else 0
    )
    source_df["_profit"] = (
        to_number(source_df[profit_column]) if profit_column is not None else 0
    )
    source_df["_quantity"] = (
        to_number(source_df[quantity_column]) if quantity_column is not None else 0
    )

    grouped = (
        source_df.groupby("_category", as_index=False)
        .agg(
            {
                "_turnover": "sum",
                "_profit": "sum",
                "_quantity": "sum",
            }
        )
    )

    if transaction_column is not None:
        transactions = (
            source_df.groupby("_category")[transaction_column]
            .nunique(dropna=True)
            .rename("_transaction_count")
            .reset_index()
        )
    else:
        transactions = (
            source_df.groupby("_category")
            .size()
            .rename("_transaction_count")
            .reset_index()
        )

    grouped = grouped.merge(transactions, on="_category", how="left")

    grouped["_profit_margin"] = grouped.apply(
        lambda row: (
            (float(row["_profit"]) / float(row["_turnover"])) * 100
            if float(row["_turnover"]) > 0
            else 0
        ),
        axis=1,
    )
    grouped["_average_basket"] = grouped.apply(
        lambda row: (
            float(row["_turnover"]) / int(row["_transaction_count"])
            if int(row["_transaction_count"]) > 0
            else 0
        ),
        axis=1,
    )

    grouped = grouped.sort_values("_turnover", ascending=False)

    return [
        {
            "category": row["_category"],
            "turnover": round(float(row["_turnover"]), 2),
            "profit": round(float(row["_profit"]), 2),
            "profit_margin": round(float(row["_profit_margin"]), 2),
            "quantity_sold": int(round(float(row["_quantity"]))),
            "transaction_count": int(row["_transaction_count"]),
            "average_basket": round(float(row["_average_basket"]), 2),
        }
        for _, row in grouped.iterrows()
    ]


def calculate_finance_metrics(
    sales_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
):
    if sales_df is None or sales_df.empty:
        return {
            "success": False,
            "error": "Satış dosyası boş veya bulunamadı.",
            "daily_revenue": [],
            "top_products": [],
            "category_metrics": [],
        }

    df = sales_df.copy()

    amount_column = find_first_column(
        df,
        ["Toplam Tutar", "Ödenen Tutar", "Tutar", "Net Tutar", "Satış Tutarı", "Ciro"],
    )
    date_column = find_first_column(
        df,
        ["İşlem Tarihi", "Reç. Tar", "Alım Tarih", "Tarih", "Satış Tarihi"],
    )
    profit_column = find_first_column(
        df,
        ["Kar Tutarı", "Kâr Tutarı", "Brüt Kar", "Brüt Kâr"],
    )
    cost_column = find_first_column(
        df,
        ["Maliyet Tutarı", "Toplam Maliyet", "Maliyet"],
    )

    if amount_column is None:
        return {
            "success": False,
            "error": "Ciro hesaplamak için uygun tutar kolonu bulunamadı.",
            "available_columns": list(df.columns),
            "daily_revenue": [],
            "top_products": [],
            "category_metrics": [],
        }

    df["_amount"] = to_number(df[amount_column])
    total_turnover = float(df["_amount"].sum())
    transaction_count = int(len(df))
    average_sale = total_turnover / transaction_count if transaction_count > 0 else 0

    total_profit = 0.0
    if profit_column is not None:
        df["_profit"] = to_number(df[profit_column])
        total_profit = float(df["_profit"].sum())

    total_cost = 0.0
    if cost_column is not None:
        df["_cost"] = to_number(df[cost_column])
        total_cost = float(df["_cost"].sum())

    profit_margin = (
        (total_profit / total_turnover) * 100 if total_turnover > 0 else 0
    )

    daily_revenue = []
    if date_column is not None:
        df["_transaction_date"] = pd.to_datetime(
            df[date_column], errors="coerce", dayfirst=True
        )
        valid_dates = df.dropna(subset=["_transaction_date"]).copy()

        if not valid_dates.empty:
            valid_dates["_day"] = valid_dates["_transaction_date"].dt.normalize()
            aggregation = {"_amount": "sum"}
            if "_profit" in valid_dates.columns:
                aggregation["_profit"] = "sum"

            daily_df = (
                valid_dates.groupby("_day", as_index=False)
                .agg(aggregation)
                .sort_values("_day")
            )

            for _, row in daily_df.iterrows():
                item = {
                    "day": row["_day"].strftime("%Y-%m-%d"),
                    "label": row["_day"].strftime("%d.%m"),
                    "revenue": round(float(row["_amount"]), 2),
                }
                if "_profit" in daily_df.columns:
                    item["profit"] = round(float(row["_profit"]), 2)
                daily_revenue.append(item)

    top_products = []
    if product_df is not None and not product_df.empty:
        product = product_df.copy()

        product_name_column = find_first_column(
            product,
            [
                "Ürün Adı (İçinde Geçen İsim Şeklinde Arama Yapılabilir)",
                "Ürün Adı",
                "Ürün",
                "İlaç Adı",
            ],
        )
        quantity_column = find_first_column(
            product,
            ["Satılan Adet", "Satış Adedi", "Adet"],
        )
        product_turnover_column = find_first_column(
            product,
            ["Satış Tutarı", "Toplam Tutar", "Ciro"],
        )
        product_profit_column = find_first_column(
            product,
            ["Kar Tutarı", "Kâr Tutarı"],
        )

        if product_name_column is not None and quantity_column is not None:
            product["_product_name"] = (
                product[product_name_column]
                .fillna("Bilinmeyen Ürün")
                .astype(str)
                .str.strip()
            )
            product["_quantity"] = to_number(product[quantity_column])
            product["_turnover"] = (
                to_number(product[product_turnover_column])
                if product_turnover_column is not None
                else 0
            )
            product["_profit"] = (
                to_number(product[product_profit_column])
                if product_profit_column is not None
                else 0
            )

            grouped = (
                product.groupby("_product_name", as_index=False)
                .agg(
                    {
                        "_quantity": "sum",
                        "_turnover": "sum",
                        "_profit": "sum",
                    }
                )
            )

            sort_column = (
                "_profit" if product_profit_column is not None else "_turnover"
            )
            grouped = grouped.sort_values(sort_column, ascending=False).head(20)

            top_products = [
                {
                    "product_name": row["_product_name"],
                    "quantity_sold": int(round(float(row["_quantity"]))),
                    "turnover": round(float(row["_turnover"]), 2),
                    "profit": round(float(row["_profit"]), 2),
                }
                for _, row in grouped.iterrows()
            ]

    category_metrics = calculate_category_metrics(
        sales_df=sales_df,
        product_df=product_df,
    )

    return {
        "success": True,
        "amount_column": amount_column,
        "date_column": date_column,
        "profit_column": profit_column,
        "cost_column": cost_column,
        "total_turnover": round(total_turnover, 2),
        "average_sale": round(average_sale, 2),
        "transaction_count": transaction_count,
        "total_profit": round(total_profit, 2),
        "total_cost": round(total_cost, 2),
        "profit_margin": round(profit_margin, 2),
        "daily_revenue": daily_revenue,
        "top_products": top_products,
        "category_metrics": category_metrics,
    }