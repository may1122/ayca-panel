import re
import unicodedata

import pandas as pd


def normalize_text(value: object) -> str:
    if value is None:
        return ""

    text = str(value).strip()

    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text)

    return text


def normalize_column_name(value: object) -> str:
    return normalize_text(value)


def find_first_column(
    df: pd.DataFrame,
    candidates: list[str],
) -> str | None:
    if df is None or len(df.columns) == 0:
        return None

    normalized_lookup = {
        normalize_column_name(column).casefold(): column
        for column in df.columns
    }

    for candidate in candidates:
        key = normalize_column_name(candidate).casefold()

        if key in normalized_lookup:
            return normalized_lookup[key]

    return None


def parse_number(value: object) -> float | None:
    if value is None:
        return None

    if pd.isna(value):
        return None

    if isinstance(value, (int, float)):
        return float(value)

    text = normalize_text(value)

    if not text:
        return None

    text = (
        text
        .replace("₺", "")
        .replace("TL", "")
        .replace("tl", "")
        .replace("€", "")
        .replace("$", "")
        .replace("%", "")
        .replace(" ", "")
    )

    # Türkçe format:
    # 1.234,56 -> 1234.56
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "")
            text = text.replace(",", ".")
        else:
            # İngilizce format:
            # 1,234.56 -> 1234.56
            text = text.replace(",", "")

    # 1234,56 -> 1234.56
    elif "," in text:
        text = text.replace(",", ".")

    # Türkçe binlik ayırıcı:
    # 1.250 -> 1250
    # 1.250.000 -> 1250000
    elif "." in text:
        parts = text.split(".")

        if (
            len(parts) > 1
            and all(part.isdigit() for part in parts)
            and all(len(part) == 3 for part in parts[1:])
        ):
            text = "".join(parts)

    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def to_number(
    series: pd.Series,
    default: float = 0.0,
) -> pd.Series:
    return series.apply(parse_number).fillna(default)


def normalize_barcode_value(value: object) -> str:
    if value is None or pd.isna(value):
        return ""

    text = normalize_text(value)

    if text.endswith(".0"):
        text = text[:-2]

    text = re.sub(r"\s+", "", text)

    return text


def normalize_barcode(series: pd.Series) -> pd.Series:
    return series.apply(normalize_barcode_value)


def parse_date_series(series: pd.Series) -> pd.Series:
    return pd.to_datetime(
        series,
        errors="coerce",
        dayfirst=True,
    )


def estimate_period_days(
    df: pd.DataFrame | None,
    date_candidates: list[str] | None = None,
    default_days: int = 30,
) -> tuple[int, bool]:
    if df is None or df.empty:
        return default_days, True

    if date_candidates is None:
        date_candidates = [
            "Tarih",
            "Satış Tarihi",
            "İşlem Tarihi",
            "Reç. Tar",
            "Alım Tarih",
        ]

    date_column = find_first_column(
        df,
        date_candidates,
    )

    if date_column is None:
        return default_days, True

    dates = parse_date_series(df[date_column]).dropna()

    if dates.empty:
        return default_days, True

    span = (
        dates.max().normalize()
        - dates.min().normalize()
    ).days + 1

    span = max(1, min(int(span), 365))

    return span, False


SALES_ID_CANDIDATES = [
    "Satış No",
    "Satis No",
    "Fiş/Reçete No",
    "Fis Recete No",
    "Fiş No",
    "Fis No",
    "Reçete No",
    "Recete No",
    "İşlem No",
    "Islem No",
    "Belge No",
]

SALES_SIGNATURE_CANDIDATES = [
    "Satış Tipi",
    "Satis Tipi",
    "İşlem Tarihi",
    "Islem Tarihi",
    "Satış Tarihi",
    "Satis Tarihi",
    "Tarih",
    "Toplam Tutar",
    "Ödenen Tutar",
    "Odenen Tutar",
    "Net Tutar",
    "Satış Tutarı",
    "Satis Tutari",
    "Tutar",
    "Hasta",
    "Hasta Adı",
    "Hasta Adi",
    "Müşteri",
    "Musteri",
    "Ürün Adı",
    "Urun Adi",
    "Ürün",
    "Urun",
    "Adet",
    "Miktar",
]


def deduplicate_sales_rows(
    df: pd.DataFrame | None,
) -> tuple[pd.DataFrame, dict]:
    """
    Satış kayıtlarını temkinli biçimde duplicate kontrolünden geçirir.

    Güvenlik ilkesi:
    - En az bir işlem/satış kimliği kolonu varsa, kimlik + mevcut iş alanlarıyla
      bileşik imza oluşturulur ve yalnızca tam aynı işlem satırları düşürülür.
    - Kimlik kolonu yoksa otomatik kayıt silinmez. Yalnızca exact duplicate
      sayısı raporlanır.
    """
    if df is None:
        return pd.DataFrame(), {
            "duplicate_check_applied": False,
            "duplicate_rows_detected": 0,
            "duplicate_rows_removed": 0,
            "duplicate_key_columns": [],
            "duplicate_check_reason": "dataframe_missing",
        }

    if df.empty:
        return df.copy(), {
            "duplicate_check_applied": True,
            "duplicate_rows_detected": 0,
            "duplicate_rows_removed": 0,
            "duplicate_key_columns": [],
            "duplicate_check_reason": None,
        }

    id_column = find_first_column(df, SALES_ID_CANDIDATES)

    if id_column is None:
        exact_duplicate_count = int(df.duplicated(keep="first").sum())
        return df.copy(), {
            "duplicate_check_applied": False,
            "duplicate_rows_detected": exact_duplicate_count,
            "duplicate_rows_removed": 0,
            "duplicate_key_columns": [],
            "duplicate_check_reason": "transaction_id_missing",
        }

    key_columns = [id_column]

    for candidate in SALES_SIGNATURE_CANDIDATES:
        column = find_first_column(df, [candidate])
        if column is not None and column not in key_columns:
            key_columns.append(column)

    duplicate_mask = df.duplicated(
        subset=key_columns,
        keep="first",
    )

    duplicate_count = int(duplicate_mask.sum())

    cleaned = df.loc[~duplicate_mask].copy()

    return cleaned, {
        "duplicate_check_applied": True,
        "duplicate_rows_detected": duplicate_count,
        "duplicate_rows_removed": duplicate_count,
        "duplicate_key_columns": key_columns,
        "duplicate_check_reason": None,
    }


def dataframe_quality_summary(
    df: pd.DataFrame | None,
) -> dict:
    if df is None:
        return {
            "row_count": 0,
            "column_count": 0,
            "empty_cell_count": 0,
            "duplicate_row_count": 0,
        }

    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "empty_cell_count": int(df.isna().sum().sum()),
        "duplicate_row_count": int(df.duplicated().sum()),
    }