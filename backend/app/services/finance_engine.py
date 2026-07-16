import pandas as pd


def find_first_column(
    df: pd.DataFrame,
    candidates: list[str],
):
    for column in candidates:
        if column in df.columns:
            return column

    return None


def to_number(
    series: pd.Series,
) -> pd.Series:
    return pd.to_numeric(
        series,
        errors="coerce",
    ).fillna(0)


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
        }

    df = sales_df.copy()

    amount_column = find_first_column(
        df,
        [
            "Toplam Tutar",
            "Ödenen Tutar",
            "Tutar",
            "Net Tutar",
            "Satış Tutarı",
            "Ciro",
        ],
    )

    date_column = find_first_column(
        df,
        [
            "İşlem Tarihi",
            "Reç. Tar",
            "Alım Tarih",
            "Tarih",
            "Satış Tarihi",
        ],
    )

    profit_column = find_first_column(
        df,
        [
            "Kar Tutarı",
            "Kâr Tutarı",
            "Brüt Kar",
            "Brüt Kâr",
        ],
    )

    cost_column = find_first_column(
        df,
        [
            "Maliyet Tutarı",
            "Toplam Maliyet",
            "Maliyet",
        ],
    )

    if amount_column is None:
        return {
            "success": False,
            "error": "Ciro hesaplamak için uygun tutar kolonu bulunamadı.",
            "available_columns": list(df.columns),
            "daily_revenue": [],
            "top_products": [],
        }

    df["_amount"] = to_number(
        df[amount_column]
    )

    total_turnover = float(
        df["_amount"].sum()
    )

    transaction_count = int(
        len(df)
    )

    average_sale = (
        total_turnover / transaction_count
        if transaction_count > 0
        else 0
    )

    total_profit = 0.0

    if profit_column is not None:
        df["_profit"] = to_number(
            df[profit_column]
        )

        total_profit = float(
            df["_profit"].sum()
        )

    total_cost = 0.0

    if cost_column is not None:
        df["_cost"] = to_number(
            df[cost_column]
        )

        total_cost = float(
            df["_cost"].sum()
        )

    profit_margin = (
        (total_profit / total_turnover) * 100
        if total_turnover > 0
        else 0
    )

    daily_revenue = []

    if date_column is not None:
        df["_transaction_date"] = pd.to_datetime(
            df[date_column],
            errors="coerce",
            dayfirst=True,
        )

        valid_dates = df.dropna(
            subset=["_transaction_date"]
        ).copy()

        if not valid_dates.empty:
            valid_dates["_day"] = (
                valid_dates["_transaction_date"]
                .dt.normalize()
            )

            daily_aggregation = {
                "_amount": "sum",
            }

            if "_profit" in valid_dates.columns:
                daily_aggregation["_profit"] = "sum"

            daily_df = (
                valid_dates
                .groupby(
                    "_day",
                    as_index=False,
                )
                .agg(daily_aggregation)
                .sort_values("_day")
            )

            for _, row in daily_df.iterrows():
                item = {
                    "day": row["_day"].strftime(
                        "%Y-%m-%d"
                    ),
                    "label": row["_day"].strftime(
                        "%d.%m"
                    ),
                    "revenue": round(
                        float(row["_amount"]),
                        2,
                    ),
                }

                if "_profit" in daily_df.columns:
                    item["profit"] = round(
                        float(row["_profit"]),
                        2,
                    )

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
            [
                "Satılan Adet",
                "Satış Adedi",
                "Adet",
            ],
        )

        product_turnover_column = find_first_column(
            product,
            [
                "Satış Tutarı",
                "Toplam Tutar",
                "Ciro",
            ],
        )

        product_profit_column = find_first_column(
            product,
            [
                "Kar Tutarı",
                "Kâr Tutarı",
            ],
        )

        if (
            product_name_column is not None
            and quantity_column is not None
        ):
            product["_product_name"] = (
                product[product_name_column]
                .fillna("Bilinmeyen Ürün")
                .astype(str)
                .str.strip()
            )

            product["_quantity"] = to_number(
                product[quantity_column]
            )

            product["_turnover"] = (
                to_number(
                    product[product_turnover_column]
                )
                if product_turnover_column is not None
                else 0
            )

            product["_profit"] = (
                to_number(
                    product[product_profit_column]
                )
                if product_profit_column is not None
                else 0
            )

            grouped = (
                product
                .groupby(
                    "_product_name",
                    as_index=False,
                )
                .agg({
                    "_quantity": "sum",
                    "_turnover": "sum",
                    "_profit": "sum",
                })
            )

            sort_column = (
                "_profit"
                if product_profit_column is not None
                else "_turnover"
            )

            grouped = (
                grouped
                .sort_values(
                    sort_column,
                    ascending=False,
                )
                .head(20)
            )

            top_products = [
                {
                    "product_name": row["_product_name"],
                    "quantity_sold": int(
                        round(
                            float(row["_quantity"])
                        )
                    ),
                    "turnover": round(
                        float(row["_turnover"]),
                        2,
                    ),
                    "profit": round(
                        float(row["_profit"]),
                        2,
                    ),
                }
                for _, row in grouped.iterrows()
            ]

    return {
        "success": True,
        "amount_column": amount_column,
        "date_column": date_column,
        "profit_column": profit_column,
        "cost_column": cost_column,
        "total_turnover": round(
            total_turnover,
            2,
        ),
        "average_sale": round(
            average_sale,
            2,
        ),
        "transaction_count": transaction_count,
        "total_profit": round(
            total_profit,
            2,
        ),
        "total_cost": round(
            total_cost,
            2,
        ),
        "profit_margin": round(
            profit_margin,
            2,
        ),
        "daily_revenue": daily_revenue,
        "top_products": top_products,
    }