import pandas as pd

from app.services.data_quality import (
    find_first_column,
    parse_date_series,
    to_number,
)


TRANSACTION_CANDIDATES = [
    "Fiş/Reçete No",
    "Fis Recete No",
    "Fiş No",
    "Reçete No",
    "Reçete Numarası",
    "İşlem No",
    "Belge No",
]


def _calculate_transaction_count(df: pd.DataFrame) -> tuple[int, str | None, bool]:
    transaction_column = find_first_column(df, TRANSACTION_CANDIDATES)

    if transaction_column is None:
        return int(len(df)), None, True

    values = df[transaction_column].dropna().astype(str).str.strip()
    values = values[values != ""]

    return int(values.nunique()), transaction_column, False


def calculate_category_metrics(
    sales_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
):
    """Kategori bazlı ciro, kâr, marj, satış ve işlem performansı üretir."""

    source_df = sales_df.copy()

    category_column = find_first_column(
        source_df,
        [
            "Kategori",
            "Ürün Kategorisi",
            "Kategori Adı",
            "Ana Kategori",
            "İlaç Dışı Ürün Grubu",
        ],
    )

    if (
        category_column is None
        and product_df is not None
        and not product_df.empty
    ):
        source_df = product_df.copy()
        category_column = find_first_column(
            source_df,
            [
                "Kategori",
                "Ürün Kategorisi",
                "Kategori Adı",
                "Ana Kategori",
                "İlaç Dışı Ürün Grubu",
            ],
        )

    if category_column is None:
        return []

    amount_column = find_first_column(
        source_df,
        [
            "Toplam Tutar",
            "Ödenen Tutar",
            "Tutar",
            "Net Tutar",
            "Satış Tutarı",
            "Ciro",
        ],
    )
    profit_column = find_first_column(
        source_df,
        [
            "Kar Tutarı",
            "Kâr Tutarı",
            "Brüt Kar",
            "Brüt Kâr",
        ],
    )
    cost_column = find_first_column(
        source_df,
        [
            "Maliyet Tutarı",
            "Toplam Maliyet",
            "Maliyet",
        ],
    )
    quantity_column = find_first_column(
        source_df,
        [
            "Satılan Adet",
            "Satış Adedi",
            "Adet",
            "Miktar",
        ],
    )
    transaction_column = find_first_column(
        source_df,
        TRANSACTION_CANDIDATES,
    )

    source_df["_category"] = (
        source_df[category_column]
        .fillna("Kategorisiz")
        .astype(str)
        .str.strip()
        .replace("", "Kategorisiz")
    )

    source_df["_turnover"] = (
        to_number(source_df[amount_column])
        if amount_column is not None
        else 0.0
    )

    if profit_column is not None:
        source_df["_profit"] = to_number(
            source_df[profit_column]
        )
    elif cost_column is not None and amount_column is not None:
        source_df["_profit"] = (
            source_df["_turnover"]
            - to_number(source_df[cost_column])
        )
    else:
        source_df["_profit"] = 0.0

    source_df["_quantity"] = (
        to_number(source_df[quantity_column])
        if quantity_column is not None
        else 0.0
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
        transaction_source = source_df[
            ["_category", transaction_column]
        ].copy()

        transaction_source["_transaction"] = (
            transaction_source[transaction_column]
            .fillna("")
            .astype(str)
            .str.strip()
        )

        transaction_source = transaction_source[
            transaction_source["_transaction"] != ""
        ]

        transactions = (
            transaction_source.groupby("_category")[
                "_transaction"
            ]
            .nunique()
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

    grouped = grouped.merge(
        transactions,
        on="_category",
        how="left",
    )

    grouped["_transaction_count"] = (
        grouped["_transaction_count"]
        .fillna(0)
        .astype(int)
    )

    grouped["_profit_margin"] = grouped.apply(
        lambda row: (
            (float(row["_profit"]) / float(row["_turnover"])) * 100
            if float(row["_turnover"]) > 0
            else 0.0
        ),
        axis=1,
    )

    grouped["_average_basket"] = grouped.apply(
        lambda row: (
            float(row["_turnover"])
            / int(row["_transaction_count"])
            if int(row["_transaction_count"]) > 0
            else 0.0
        ),
        axis=1,
    )

    grouped = grouped.sort_values(
        "_turnover",
        ascending=False,
    )

    return [
        {
            "category": row["_category"],
            "turnover": round(float(row["_turnover"]), 2),
            "profit": round(float(row["_profit"]), 2),
            "profit_margin": round(
                float(row["_profit_margin"]),
                2,
            ),
            "quantity_sold": int(
                round(float(row["_quantity"]))
            ),
            "transaction_count": int(
                row["_transaction_count"]
            ),
            "average_basket": round(
                float(row["_average_basket"]),
                2,
            ),
        }
        for _, row in grouped.iterrows()
    ]



PERIOD_LABELS = {
    "week": "Bu Hafta",
    "month": "Bu Ay",
    "3months": "Son 3 Ay",
    "year": "Bu Yıl",
    "all": "Tümü",
}


def _normalize_period(period: str | None) -> str:
    normalized = str(period or "month").strip().lower()

    aliases = {
        "week": "week",
        "hafta": "week",
        "bu hafta": "week",
        "month": "month",
        "ay": "month",
        "bu ay": "month",
        "3months": "3months",
        "3_months": "3months",
        "3 months": "3months",
        "son 3 ay": "3months",
        "quarter": "3months",
        "year": "year",
        "yıl": "year",
        "yil": "year",
        "bu yıl": "year",
        "bu yil": "year",
        "all": "all",
        "tümü": "all",
        "tumu": "all",
    }

    return aliases.get(normalized, "month")


def _period_bounds(
    reference_date: pd.Timestamp,
    period: str,
) -> tuple[pd.Timestamp | None, pd.Timestamp]:
    end_date = reference_date.normalize()

    if period == "all":
        return None, end_date

    if period == "week":
        start_date = end_date - pd.Timedelta(
            days=end_date.weekday()
        )
        return start_date, end_date

    if period == "month":
        start_date = end_date.replace(day=1)
        return start_date, end_date

    if period == "3months":
        start_date = (
            end_date - pd.DateOffset(months=3)
            + pd.Timedelta(days=1)
        ).normalize()
        return start_date, end_date

    if period == "year":
        start_date = pd.Timestamp(
            year=end_date.year,
            month=1,
            day=1,
        )
        return start_date, end_date

    return end_date.replace(day=1), end_date


def _filter_period(
    df: pd.DataFrame,
    date_column: str | None,
    period: str,
    reference_date: pd.Timestamp | None = None,
) -> tuple[pd.DataFrame, dict]:
    normalized_period = _normalize_period(period)

    if date_column is None:
        return df.copy(), {
            "period": normalized_period,
            "period_label": PERIOD_LABELS[normalized_period],
            "period_start": None,
            "period_end": None,
            "period_reference_date": None,
            "period_filter_applied": False,
            "period_filter_reason": "date_column_missing",
        }

    working = df.copy()

    if "_transaction_date" not in working.columns:
        working["_transaction_date"] = parse_date_series(
            working[date_column]
        )

    valid_dates = working["_transaction_date"].dropna()

    if valid_dates.empty:
        return working, {
            "period": normalized_period,
            "period_label": PERIOD_LABELS[normalized_period],
            "period_start": None,
            "period_end": None,
            "period_reference_date": None,
            "period_filter_applied": False,
            "period_filter_reason": "valid_date_missing",
        }

    # Analizin dayandığı son gerçek işlem tarihini referans al.
    # Böylece geçmiş tarihli dosya yüklendiğinde "Bu Ay" boş sonuç üretmez.
    anchor = (
        reference_date.normalize()
        if reference_date is not None
        else valid_dates.max().normalize()
    )

    start_date, end_date = _period_bounds(
        anchor,
        normalized_period,
    )

    if normalized_period == "all":
        filtered = working[
            working["_transaction_date"].notna()
        ].copy()
    else:
        filtered = working[
            working["_transaction_date"].notna()
            & (working["_transaction_date"] >= start_date)
            & (
                working["_transaction_date"]
                < end_date + pd.Timedelta(days=1)
            )
        ].copy()

    return filtered, {
        "period": normalized_period,
        "period_label": PERIOD_LABELS[normalized_period],
        "period_start": (
            start_date.strftime("%Y-%m-%d")
            if start_date is not None
            else valid_dates.min().normalize().strftime(
                "%Y-%m-%d"
            )
        ),
        "period_end": end_date.strftime("%Y-%m-%d"),
        "period_reference_date": anchor.strftime(
            "%Y-%m-%d"
        ),
        "period_filter_applied": True,
        "period_filter_reason": None,
    }


def _calculate_period_summary(
    df: pd.DataFrame,
    date_column: str | None,
    period: str,
) -> dict:
    filtered, metadata = _filter_period(
        df,
        date_column,
        period,
    )

    turnover = float(filtered["_amount"].sum())

    transaction_count, _, transaction_assumed = (
        _calculate_transaction_count(filtered)
    )

    profit = (
        float(filtered["_profit"].sum())
        if "_profit" in filtered.columns
        else 0.0
    )

    cost = (
        float(filtered["_cost"].sum())
        if "_cost" in filtered.columns
        else max(turnover - profit, 0.0)
    )

    average_sale = (
        turnover / transaction_count
        if transaction_count > 0
        else 0.0
    )

    profit_margin = (
        (profit / turnover) * 100
        if turnover > 0
        else 0.0
    )

    return {
        **metadata,
        "total_turnover": round(turnover, 2),
        "total_profit": round(profit, 2),
        "total_cost": round(cost, 2),
        "profit_margin": round(profit_margin, 2),
        "transaction_count": int(transaction_count),
        "transaction_count_assumed": transaction_assumed,
        "average_sale": round(average_sale, 2),
        "row_count": int(len(filtered)),
    }



def _calculate_date_range_summary(
    df: pd.DataFrame,
    start_date: pd.Timestamp,
    end_date: pd.Timestamp,
    label: str,
) -> dict:
    working = df[
        df["_transaction_date"].notna()
        & (df["_transaction_date"] >= start_date)
        & (
            df["_transaction_date"]
            < end_date + pd.Timedelta(days=1)
        )
    ].copy()

    turnover = float(working["_amount"].sum())

    transaction_count, _, transaction_assumed = (
        _calculate_transaction_count(working)
    )

    profit = (
        float(working["_profit"].sum())
        if "_profit" in working.columns
        else 0.0
    )

    cost = (
        float(working["_cost"].sum())
        if "_cost" in working.columns
        else max(turnover - profit, 0.0)
    )

    average_sale = (
        turnover / transaction_count
        if transaction_count > 0
        else 0.0
    )

    profit_margin = (
        (profit / turnover) * 100
        if turnover > 0
        else 0.0
    )

    daily_revenue = []

    if not working.empty:
        daily = working.copy()
        daily["_day"] = (
            daily["_transaction_date"].dt.normalize()
        )

        daily_df = (
            daily.groupby("_day", as_index=False)
            .agg(
                {
                    "_amount": "sum",
                    "_profit": "sum",
                }
            )
            .sort_values("_day")
        )

        daily_revenue = [
            {
                "day": row["_day"].strftime("%Y-%m-%d"),
                "label": row["_day"].strftime("%d.%m"),
                "revenue": round(
                    float(row["_amount"]),
                    2,
                ),
                "profit": round(
                    float(row["_profit"]),
                    2,
                ),
            }
            for _, row in daily_df.iterrows()
        ]

    return {
        "period": "week",
        "period_label": label,
        "period_start": start_date.strftime("%Y-%m-%d"),
        "period_end": end_date.strftime("%Y-%m-%d"),
        "period_reference_date": end_date.strftime(
            "%Y-%m-%d"
        ),
        "period_filter_applied": True,
        "total_turnover": round(turnover, 2),
        "total_profit": round(profit, 2),
        "total_cost": round(cost, 2),
        "profit_margin": round(profit_margin, 2),
        "transaction_count": int(transaction_count),
        "transaction_count_assumed": (
            transaction_assumed
        ),
        "average_sale": round(average_sale, 2),
        "row_count": int(len(working)),
        "daily_revenue": daily_revenue,
    }


def _build_week_metrics(
    df: pd.DataFrame,
) -> list[dict]:
    if (
        "_transaction_date" not in df.columns
        or df["_transaction_date"].dropna().empty
    ):
        return []

    valid_dates = df["_transaction_date"].dropna()
    latest_date = valid_dates.max().normalize()
    earliest_date = valid_dates.min().normalize()

    latest_week_start = (
        latest_date
        - pd.Timedelta(days=latest_date.weekday())
    ).normalize()

    earliest_week_start = (
        earliest_date
        - pd.Timedelta(days=earliest_date.weekday())
    ).normalize()

    week_count = int(
        (
            latest_week_start - earliest_week_start
        ).days
        // 7
    ) + 1

    metrics = []

    # En yeni hafta ilk sırada. Frontend weekOffset=0 ile
    # doğrudan güncel haftayı gösterir.
    for offset in range(week_count):
        start_date = (
            latest_week_start
            - pd.Timedelta(days=offset * 7)
        )
        natural_end = (
            start_date + pd.Timedelta(days=6)
        )
        end_date = min(natural_end, latest_date)

        summary = _calculate_date_range_summary(
            df=df,
            start_date=start_date,
            end_date=end_date,
            label="Haftalık",
        )

        summary["week_offset"] = offset
        summary["is_latest_week"] = offset == 0
        metrics.append(summary)

    return metrics

def calculate_finance_metrics(
    sales_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
    period: str = "month",
):
    if sales_df is None or sales_df.empty:
        return {
            "success": False,
            "error": "Satış dosyası boş veya bulunamadı.",
            "period": _normalize_period(period),
            "period_label": PERIOD_LABELS[
                _normalize_period(period)
            ],
            "period_metrics": {},
            "daily_revenue": [],
            "top_products": [],
            "category_metrics": [],
            "warnings": [],
        }

    raw_df = sales_df.copy()

    amount_column = find_first_column(
        raw_df,
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
        raw_df,
        [
            "İşlem Tarihi",
            "Reç. Tar",
            "Alım Tarih",
            "Tarih",
            "Satış Tarihi",
        ],
    )
    profit_column = find_first_column(
        raw_df,
        [
            "Kar Tutarı",
            "Kâr Tutarı",
            "Brüt Kar",
            "Brüt Kâr",
        ],
    )
    cost_column = find_first_column(
        raw_df,
        [
            "Maliyet Tutarı",
            "Toplam Maliyet",
            "Maliyet",
        ],
    )

    if amount_column is None:
        return {
            "success": False,
            "error": (
                "Ciro hesaplamak için uygun tutar kolonu "
                "bulunamadı."
            ),
            "available_columns": list(raw_df.columns),
            "period": _normalize_period(period),
            "period_label": PERIOD_LABELS[
                _normalize_period(period)
            ],
            "period_metrics": {},
            "daily_revenue": [],
            "top_products": [],
            "category_metrics": [],
            "warnings": [],
        }

    raw_df["_amount"] = to_number(
        raw_df[amount_column]
    )

    if date_column is not None:
        raw_df["_transaction_date"] = parse_date_series(
            raw_df[date_column]
        )

    profit_source = None

    if profit_column is not None:
        raw_df["_profit"] = to_number(
            raw_df[profit_column]
        )
        profit_source = profit_column

        if cost_column is not None:
            raw_df["_cost"] = to_number(
                raw_df[cost_column]
            )
        else:
            raw_df["_cost"] = (
                raw_df["_amount"]
                - raw_df["_profit"]
            )
    elif cost_column is not None:
        raw_df["_cost"] = to_number(
            raw_df[cost_column]
        )
        raw_df["_profit"] = (
            raw_df["_amount"]
            - raw_df["_cost"]
        )
        profit_source = (
            f"{amount_column} - {cost_column}"
        )
    else:
        raw_df["_profit"] = 0.0
        raw_df["_cost"] = 0.0

    normalized_period = _normalize_period(period)

    period_metrics = {
        period_key: _calculate_period_summary(
            raw_df,
            date_column,
            period_key,
        )
        for period_key in [
            "week",
            "month",
            "3months",
            "year",
            "all",
        ]
    }

    week_metrics = _build_week_metrics(
        raw_df
    )

    df, period_metadata = _filter_period(
        raw_df,
        date_column,
        normalized_period,
    )

    total_turnover = float(df["_amount"].sum())
    total_profit = float(df["_profit"].sum())
    total_cost = float(df["_cost"].sum())

    (
        transaction_count,
        transaction_column,
        transaction_assumed,
    ) = _calculate_transaction_count(df)

    average_sale = (
        total_turnover / transaction_count
        if transaction_count > 0
        else 0.0
    )

    profit_margin = (
        (total_profit / total_turnover) * 100
        if total_turnover > 0
        and profit_source is not None
        else 0.0
    )

    daily_revenue = []

    valid_dates = (
        df.dropna(
            subset=["_transaction_date"]
        ).copy()
        if "_transaction_date" in df.columns
        else pd.DataFrame()
    )

    if not valid_dates.empty:
        valid_dates["_day"] = (
            valid_dates["_transaction_date"]
            .dt.normalize()
        )

        aggregation = {
            "_amount": "sum",
            "_profit": "sum",
        }

        daily_df = (
            valid_dates.groupby(
                "_day",
                as_index=False,
            )
            .agg(aggregation)
            .sort_values("_day")
        )

        for _, row in daily_df.iterrows():
            daily_revenue.append(
                {
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
                    "profit": round(
                        float(row["_profit"]),
                        2,
                    ),
                }
            )

    filtered_product_df = product_df

    if (
        product_df is not None
        and not product_df.empty
    ):
        product_date_column = find_first_column(
            product_df,
            [
                "İşlem Tarihi",
                "Reç. Tar",
                "Alım Tarih",
                "Tarih",
                "Satış Tarihi",
            ],
        )

        if product_date_column is not None:
            filtered_product_df, _ = _filter_period(
                product_df,
                product_date_column,
                normalized_period,
                reference_date=(
                    pd.Timestamp(
                        period_metadata[
                            "period_reference_date"
                        ]
                    )
                    if period_metadata.get(
                        "period_reference_date"
                    )
                    else None
                ),
            )

    top_products = []

    if (
        filtered_product_df is not None
        and not filtered_product_df.empty
    ):
        product = filtered_product_df.copy()

        product_name_column = find_first_column(
            product,
            [
                (
                    "Ürün Adı (İçinde Geçen İsim "
                    "Şeklinde Arama Yapılabilir)"
                ),
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
        product_cost_column = find_first_column(
            product,
            [
                "Maliyet Tutarı",
                "Toplam Maliyet",
                "Maliyet",
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
                .replace("", "Bilinmeyen Ürün")
            )

            product["_quantity"] = to_number(
                product[quantity_column]
            )

            product["_turnover"] = (
                to_number(
                    product[
                        product_turnover_column
                    ]
                )
                if product_turnover_column
                is not None
                else 0.0
            )

            if product_profit_column is not None:
                product["_profit"] = to_number(
                    product[
                        product_profit_column
                    ]
                )
            elif (
                product_cost_column is not None
                and product_turnover_column
                is not None
            ):
                product["_profit"] = (
                    product["_turnover"]
                    - to_number(
                        product[
                            product_cost_column
                        ]
                    )
                )
            else:
                product["_profit"] = 0.0

            grouped = (
                product.groupby(
                    "_product_name",
                    as_index=False,
                )
                .agg(
                    {
                        "_quantity": "sum",
                        "_turnover": "sum",
                        "_profit": "sum",
                    }
                )
            )

            if (
                product_profit_column is not None
                or (
                    product_cost_column is not None
                    and product_turnover_column
                    is not None
                )
            ):
                sort_column = "_profit"
            elif product_turnover_column is not None:
                sort_column = "_turnover"
            else:
                sort_column = "_quantity"

            grouped = (
                grouped.sort_values(
                    sort_column,
                    ascending=False,
                )
                .head(20)
            )

            top_products = [
                {
                    "product_name": row[
                        "_product_name"
                    ],
                    "quantity_sold": int(
                        round(
                            float(
                                row["_quantity"]
                            )
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

    category_metrics = calculate_category_metrics(
        sales_df=df,
        product_df=filtered_product_df,
    )

    warnings = []

    if transaction_assumed:
        warnings.append(
            "İşlem/fiş/reçete numarası bulunamadı; "
            "işlem sayısı satır sayısı kabul edildi."
        )

    if profit_source is None:
        warnings.append(
            "Kâr veya maliyet kolonu bulunamadı; "
            "kâr ve marj hesapları doğrulanamadı."
        )

    if date_column is None:
        warnings.append(
            "Satış tarihi kolonu bulunamadı; dönem filtresi "
            "uygulanamadı ve tüm satış verisi kullanıldı."
        )
    elif not period_metadata[
        "period_filter_applied"
    ]:
        warnings.append(
            "Geçerli satış tarihi bulunamadı; dönem filtresi "
            "uygulanamadı."
        )

    if (
        product_df is not None
        and not product_df.empty
        and find_first_column(
            product_df,
            [
                "İşlem Tarihi",
                "Reç. Tar",
                "Alım Tarih",
                "Tarih",
                "Satış Tarihi",
            ],
        )
        is None
    ):
        warnings.append(
            "Ürün satış dosyasında tarih kolonu bulunamadı; "
            "top ürün sıralaması dönem filtresinden bağımsız "
            "kalabilir."
        )

    return {
        "success": True,
        "amount_column": amount_column,
        "date_column": date_column,
        "transaction_column": transaction_column,
        "transaction_count_assumed": (
            transaction_assumed
        ),
        "profit_column": profit_column,
        "cost_column": cost_column,
        "profit_source": profit_source,
        "period": period_metadata["period"],
        "period_label": period_metadata[
            "period_label"
        ],
        "period_start": period_metadata[
            "period_start"
        ],
        "period_end": period_metadata[
            "period_end"
        ],
        "period_reference_date": (
            period_metadata[
                "period_reference_date"
            ]
        ),
        "period_filter_applied": (
            period_metadata[
                "period_filter_applied"
            ]
        ),
        "period_metrics": period_metrics,
        "week_metrics": week_metrics,
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
        "category_metrics": category_metrics,
        "warnings": warnings,
    }