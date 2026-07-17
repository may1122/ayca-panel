from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from typing import Any

import pandas as pd


def normalize_text(value: Any) -> str:
    if value is None:
        return ""

    text = str(value).strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))

    replacements = {
        "ı": "i",
        "ş": "s",
        "ğ": "g",
        "ü": "u",
        "ö": "o",
        "ç": "c",
    }

    for source, target in replacements.items():
        text = text.replace(source, target)

    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def normalize_columns(dataframe: pd.DataFrame) -> pd.DataFrame:
    df = dataframe.copy()
    df.columns = [normalize_text(column) for column in df.columns]
    return df


def find_column(
    dataframe: pd.DataFrame,
    candidates: list[str],
) -> str | None:
    normalized_candidates = [normalize_text(item) for item in candidates]

    for candidate in normalized_candidates:
        if candidate in dataframe.columns:
            return candidate

    for column in dataframe.columns:
        for candidate in normalized_candidates:
            if candidate and candidate in column:
                return column

    return None


def numeric_series(
    dataframe: pd.DataFrame,
    column: str | None,
    default: float = 0,
) -> pd.Series:
    if not column or column not in dataframe.columns:
        return pd.Series(default, index=dataframe.index, dtype="float64")

    values = (
        dataframe[column]
        .astype(str)
        .str.replace(".", "", regex=False)
        .str.replace(",", ".", regex=False)
        .str.replace(r"[^0-9.\-]", "", regex=True)
    )

    return pd.to_numeric(values, errors="coerce").fillna(default)


def text_series(
    dataframe: pd.DataFrame,
    column: str | None,
    default: str = "",
) -> pd.Series:
    if not column or column not in dataframe.columns:
        return pd.Series(default, index=dataframe.index, dtype="object")

    return (
        dataframe[column]
        .fillna(default)
        .astype(str)
        .str.strip()
        .replace(
            {
                "nan": default,
                "None": default,
                "NaT": default,
            }
        )
    )


def date_series(
    dataframe: pd.DataFrame,
    column: str | None,
) -> pd.Series:
    if not column or column not in dataframe.columns:
        return pd.Series(pd.NaT, index=dataframe.index)

    return pd.to_datetime(
        dataframe[column],
        errors="coerce",
        dayfirst=True,
    )


def mask_patient_name(value: Any) -> str:
    text = str(value or "").strip()

    if not text:
        return "Anonim Hasta"

    if text.lower() in {"nan", "none", "null"}:
        return "Anonim Hasta"

    parts = [part for part in text.split() if part]

    masked_parts: list[str] = []

    for part in parts:
        if len(part) == 1:
            masked_parts.append(f"{part.upper()}***")
        else:
            masked_parts.append(
                f"{part[0].upper()}{'*' * min(max(len(part) - 1, 2), 6)}"
            )

    return " ".join(masked_parts)


def safe_float(value: Any) -> float:
    try:
        if pd.isna(value):
            return 0.0
        return round(float(value), 2)
    except (TypeError, ValueError):
        return 0.0


def safe_int(value: Any) -> int:
    try:
        if pd.isna(value):
            return 0
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def detect_columns(dataframe: pd.DataFrame) -> dict[str, str | None]:
    return {
        "patient": find_column(
            dataframe,
            [
                "hasta",
                "hasta adı",
                "hasta adi",
                "hasta adı soyadı",
                "hasta adi soyadi",
                "müşteri",
                "musteri",
                "müşteri adı",
                "musteri adi",
                "cari adı",
                "cari adi",
            ],
        ),
        "patient_id": find_column(
            dataframe,
            [
                "hasta kodu",
                "hasta_kodu",
                "müşteri kodu",
                "musteri_kodu",
                "cari kodu",
                "cari_kodu",
                "hasta no",
                "hasta_no",
            ],
        ),
        "doctor": find_column(
            dataframe,
            [
                "doktor",
                "doktor adı",
                "doktor adi",
                "hekim",
                "hekim adı",
                "hekim adi",
                "reçete doktoru",
                "recete doktoru",
            ],
        ),
        "institution": find_column(
            dataframe,
            [
                "kurum",
                "kurum adı",
                "kurum adi",
                "sgk kurumu",
                "ödeme kurumu",
                "odeme kurumu",
                "provizyon kurumu",
                "sigorta",
            ],
        ),
        "prescription_type": find_column(
            dataframe,
            [
                "reçete türü",
                "recete turu",
                "reçete tipi",
                "recete tipi",
                "reçete grubu",
                "recete grubu",
                "reçete renk",
                "recete renk",
            ],
        ),
        "prescription_no": find_column(
            dataframe,
            [
                "reçete no",
                "recete no",
                "reçete numarası",
                "recete numarasi",
                "reçete kodu",
                "recete kodu",
            ],
        ),
        "transaction_no": find_column(
            dataframe,
            [
                "işlem no",
                "islem no",
                "fiş no",
                "fis no",
                "fatura no",
                "belge no",
                "satış no",
                "satis no",
            ],
        ),
        "date": find_column(
            dataframe,
            [
                "tarih",
                "işlem tarihi",
                "islem tarihi",
                "satış tarihi",
                "satis tarihi",
                "reçete tarihi",
                "recete tarihi",
            ],
        ),
        "turnover": find_column(
            dataframe,
            [
                "ciro",
                "satış tutarı",
                "satis tutari",
                "toplam tutar",
                "net tutar",
                "ödenen tutar",
                "odenen tutar",
                "tutar",
            ],
        ),
        "quantity": find_column(
            dataframe,
            [
                "adet",
                "miktar",
                "satılan adet",
                "satilan adet",
                "ürün adedi",
                "urun adedi",
            ],
        ),
        "product": find_column(
            dataframe,
            [
                "ürün adı",
                "urun adi",
                "ürün",
                "urun",
                "ilaç adı",
                "ilac adi",
            ],
        ),
        "risk_type": find_column(
            dataframe,
            [
                "risk tipi",
                "risk_tipi",
                "kontrollü reçete",
                "kontrollu recete",
                "kki",
                "reçete uyarısı",
                "recete uyarisi",
            ],
        ),
    }


def calculate_patient_metrics(
    sales_df: pd.DataFrame,
    product_df: pd.DataFrame | None = None,
) -> dict[str, Any]:
    if sales_df is None or sales_df.empty:
        return empty_patient_metrics(
            message="Satış dosyasında analiz edilebilir kayıt bulunamadı."
        )

    sales = normalize_columns(sales_df)
    products = (
        normalize_columns(product_df)
        if product_df is not None and not product_df.empty
        else pd.DataFrame()
    )

    columns = detect_columns(sales)

    patient_column = columns["patient"] or columns["patient_id"]
    doctor_column = columns["doctor"]
    institution_column = columns["institution"]
    prescription_type_column = columns["prescription_type"]
    prescription_no_column = columns["prescription_no"]
    transaction_no_column = columns["transaction_no"]
    date_column = columns["date"]
    turnover_column = columns["turnover"]
    risk_type_column = columns["risk_type"]

    sales["_turnover"] = numeric_series(
        sales,
        turnover_column,
    )
    sales["_date"] = date_series(
        sales,
        date_column,
    )
    sales["_patient"] = text_series(
        sales,
        patient_column,
    )
    sales["_doctor"] = text_series(
        sales,
        doctor_column,
    )
    sales["_institution"] = text_series(
        sales,
        institution_column,
    )
    sales["_prescription_type"] = text_series(
        sales,
        prescription_type_column,
        "Normal Reçete",
    )
    sales["_prescription_no"] = text_series(
        sales,
        prescription_no_column,
    )
    sales["_transaction_no"] = text_series(
        sales,
        transaction_no_column,
    )
    sales["_risk_type"] = text_series(
        sales,
        risk_type_column,
    )

    doctors = build_doctor_metrics(
        sales,
        doctor_column=doctor_column,
        prescription_no_column=prescription_no_column,
        transaction_no_column=transaction_no_column,
    )

    patients = build_patient_metrics(
        sales,
        patient_column=patient_column,
        transaction_no_column=transaction_no_column,
    )

    institutions = build_institution_metrics(
        sales,
        institution_column=institution_column,
        prescription_no_column=prescription_no_column,
        transaction_no_column=transaction_no_column,
    )

    prescriptions = build_prescription_metrics(
        sales,
        products,
        prescription_type_column=prescription_type_column,
        prescription_no_column=prescription_no_column,
    )

    active_patient_count = len(patients)
    vip_patient_count = sum(
        1
        for patient in patients
        if str(patient.get("segment", "")).lower() == "vip"
    )
    lost_patient_risk_count = sum(
        1
        for patient in patients
        if str(patient.get("risk_level", "")).lower()
        in {"yüksek", "kritik"}
    )

    available_sections = sum(
        [
            bool(doctors),
            bool(patients),
            bool(institutions),
            bool(prescriptions),
        ]
    )

    data_completeness_score = available_sections * 15

    loyalty_score = 0
    if active_patient_count:
        loyalty_score = min(
            25,
            round(
                (
                    vip_patient_count
                    / max(active_patient_count, 1)
                )
                * 100
            ),
        )

    risk_penalty = min(
        25,
        lost_patient_risk_count * 2,
    )

    health_score = max(
        0,
        min(
            100,
            35
            + data_completeness_score
            + loyalty_score
            - risk_penalty,
        ),
    )

    detected_columns = {
        key: value
        for key, value in columns.items()
        if value is not None
    }

    missing_columns = []

    if not patient_column:
        missing_columns.append("hasta/müşteri")
    if not doctor_column:
        missing_columns.append("doktor/hekim")
    if not institution_column:
        missing_columns.append("kurum")
    if not prescription_type_column:
        missing_columns.append("reçete türü")
    if not date_column:
        missing_columns.append("tarih")
    if not turnover_column:
        missing_columns.append("ciro/tutar")

    return {
        "success": True,
        "health_score": health_score,
        "active_patient_count": active_patient_count,
        "vip_patient_count": vip_patient_count,
        "lost_patient_risk_count": lost_patient_risk_count,
        "doctors": doctors,
        "patients": patients,
        "institutions": institutions,
        "prescriptions": prescriptions,
        "detected_columns": detected_columns,
        "missing_columns": missing_columns,
        "message": (
            "Hasta ve reçete analizi tamamlandı."
            if available_sections
            else "Hasta, doktor, kurum veya reçete alanı bulunamadı."
        ),
    }


def build_doctor_metrics(
    sales: pd.DataFrame,
    doctor_column: str | None,
    prescription_no_column: str | None,
    transaction_no_column: str | None,
) -> list[dict[str, Any]]:
    if not doctor_column:
        return []

    valid = sales[
        sales["_doctor"].ne("")
        & ~sales["_doctor"].str.lower().isin(
            {"nan", "none", "belirtilmemiş", "belirtilmemis"}
        )
    ].copy()

    if valid.empty:
        return []

    records: list[dict[str, Any]] = []

    for doctor_name, group in valid.groupby("_doctor"):
        prescription_count = (
            group["_prescription_no"]
            .replace("", pd.NA)
            .nunique()
            if prescription_no_column
            else len(group)
        )

        transaction_count = (
            group["_transaction_no"]
            .replace("", pd.NA)
            .nunique()
            if transaction_no_column
            else len(group)
        )

        turnover = safe_float(group["_turnover"].sum())

        records.append(
            {
                "doctor_name": str(doctor_name),
                "prescription_count": safe_int(prescription_count),
                "transaction_count": safe_int(transaction_count),
                "turnover": turnover,
                "average_prescription": safe_float(
                    turnover / max(safe_int(prescription_count), 1)
                ),
            }
        )

    return sorted(
        records,
        key=lambda item: item["turnover"],
        reverse=True,
    )[:50]


def build_patient_metrics(
    sales: pd.DataFrame,
    patient_column: str | None,
    transaction_no_column: str | None,
) -> list[dict[str, Any]]:
    if not patient_column:
        return []

    valid = sales[
        sales["_patient"].ne("")
        & ~sales["_patient"].str.lower().isin(
            {"nan", "none", "anonim", "belirtilmemiş", "belirtilmemis"}
        )
    ].copy()

    if valid.empty:
        return []

    reference_date = (
        valid["_date"].max()
        if valid["_date"].notna().any()
        else pd.Timestamp(datetime.now())
    )

    records: list[dict[str, Any]] = []

    for patient_name, group in valid.groupby("_patient"):
        visit_count = (
            group["_transaction_no"]
            .replace("", pd.NA)
            .nunique()
            if transaction_no_column
            else len(group)
        )

        turnover = safe_float(group["_turnover"].sum())

        last_visit_value = (
            group["_date"].max()
            if group["_date"].notna().any()
            else pd.NaT
        )

        days_since_visit = None

        if pd.notna(last_visit_value):
            days_since_visit = max(
                0,
                int((reference_date - last_visit_value).days),
            )

        if visit_count >= 8 or turnover >= 10000:
            segment = "VIP"
        elif visit_count >= 4:
            segment = "Sadık"
        elif visit_count >= 2:
            segment = "Aktif"
        else:
            segment = "Yeni"

        if days_since_visit is None:
            risk_level = "Bilinmiyor"
        elif days_since_visit >= 90:
            risk_level = "Kritik"
        elif days_since_visit >= 60:
            risk_level = "Yüksek"
        elif days_since_visit >= 30:
            risk_level = "Orta"
        else:
            risk_level = "Düşük"

        records.append(
            {
                # Ekranın varsayılan ve güvenli görünümünde kullanılır.
                "patient_name": mask_patient_name(patient_name),

                # Yalnızca kullanıcı açık onay verdiğinde frontend'de gösterilir.
                "patient_name_full": str(patient_name).strip(),

                "segment": segment,
                "visit_count": safe_int(visit_count),
                "turnover": turnover,
                "last_visit": (
                    last_visit_value.strftime("%d.%m.%Y")
                    if pd.notna(last_visit_value)
                    else "-"
                ),
                "risk_level": risk_level,
            }
        )

    return sorted(
        records,
        key=lambda item: (
            item["risk_level"] in {"Kritik", "Yüksek"},
            item["turnover"],
        ),
        reverse=True,
    )[:100]


def build_institution_metrics(
    sales: pd.DataFrame,
    institution_column: str | None,
    prescription_no_column: str | None,
    transaction_no_column: str | None,
) -> list[dict[str, Any]]:
    if not institution_column:
        return []

    valid = sales[
        sales["_institution"].ne("")
        & ~sales["_institution"].str.lower().isin(
            {"nan", "none", "belirtilmemiş", "belirtilmemis"}
        )
    ].copy()

    if valid.empty:
        return []

    records: list[dict[str, Any]] = []

    for institution_name, group in valid.groupby("_institution"):
        prescription_count = (
            group["_prescription_no"]
            .replace("", pd.NA)
            .nunique()
            if prescription_no_column
            else len(group)
        )

        transaction_count = (
            group["_transaction_no"]
            .replace("", pd.NA)
            .nunique()
            if transaction_no_column
            else len(group)
        )

        turnover = safe_float(group["_turnover"].sum())

        records.append(
            {
                "institution_name": str(institution_name),
                "prescription_count": safe_int(prescription_count),
                "transaction_count": safe_int(transaction_count),
                "turnover": turnover,
                "average_sale": safe_float(
                    turnover / max(safe_int(transaction_count), 1)
                ),
            }
        )

    return sorted(
        records,
        key=lambda item: item["turnover"],
        reverse=True,
    )[:50]


def normalize_prescription_type(value: Any) -> str:
    text = normalize_text(value)

    if "kirmizi" in text:
        return "Kırmızı Reçete"
    if "yesil" in text:
        return "Yeşil Reçete"
    if "mor" in text:
        return "Mor Reçete"
    if "turuncu" in text:
        return "Turuncu Reçete"
    if "kontrollu" in text:
        return "Kontrollü Reçete"
    if "kki" in text:
        return "KKİ Uyarısı"
    if "normal" in text:
        return "Normal Reçete"

    original = str(value or "").strip()
    return original if original else "Normal Reçete"


def build_prescription_metrics(
    sales: pd.DataFrame,
    products: pd.DataFrame,
    prescription_type_column: str | None,
    prescription_no_column: str | None,
) -> list[dict[str, Any]]:
    working = sales.copy()

    working["_prescription_label"] = working[
        "_prescription_type"
    ].apply(normalize_prescription_type)

    if working["_risk_type"].ne("").any():
        risk_mask = working["_risk_type"].ne("")

        working.loc[
            risk_mask,
            "_prescription_label",
        ] = working.loc[
            risk_mask,
            "_risk_type",
        ].apply(normalize_prescription_type)

    records: list[dict[str, Any]] = []

    for prescription_type, group in working.groupby(
        "_prescription_label"
    ):
        count = (
            group["_prescription_no"]
            .replace("", pd.NA)
            .nunique()
            if prescription_no_column
            else len(group)
        )

        normalized_type = normalize_text(prescription_type)

        alert_count = (
            safe_int(count)
            if any(
                signal in normalized_type
                for signal in [
                    "kirmizi",
                    "yesil",
                    "mor",
                    "turuncu",
                    "kontrollu",
                    "kki",
                ]
            )
            else 0
        )

        records.append(
            {
                "prescription_type": str(prescription_type),
                "count": safe_int(count),
                "turnover": safe_float(group["_turnover"].sum()),
                "alert_count": alert_count,
            }
        )

    return sorted(
        records,
        key=lambda item: item["count"],
        reverse=True,
    )


def empty_patient_metrics(
    message: str,
) -> dict[str, Any]:
    return {
        "success": False,
        "health_score": 0,
        "active_patient_count": 0,
        "vip_patient_count": 0,
        "lost_patient_risk_count": 0,
        "doctors": [],
        "patients": [],
        "institutions": [],
        "prescriptions": [],
        "detected_columns": {},
        "missing_columns": [],
        "message": message,
    }