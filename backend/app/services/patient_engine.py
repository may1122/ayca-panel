from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from typing import Any

import pandas as pd

from app.services.data_quality import deduplicate_sales_rows


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

    def parse_number(value: Any) -> float:
        if value is None or pd.isna(value):
            return float(default)

        # Excel/pandas hücresi zaten sayısalsa ondalık işaretine dokunma.
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)

        text = str(value).strip()
        if not text:
            return float(default)

        text = re.sub(r"[^0-9,\.\-]", "", text)

        if not text or text in {"-", ".", ","}:
            return float(default)

        # Hem nokta hem virgül varsa son görülen ayırıcıyı ondalık kabul et.
        # 1.234,56 -> 1234.56
        # 1,234.56 -> 1234.56
        if "." in text and "," in text:
            if text.rfind(",") > text.rfind("."):
                text = text.replace(".", "").replace(",", ".")
            else:
                text = text.replace(",", "")

        elif "," in text:
            # Türkçe ondalık: 481,17 -> 481.17
            # Çoklu virgül varsa sonuncuyu ondalık kabul et.
            if text.count(",") > 1:
                parts = text.split(",")
                text = "".join(parts[:-1]) + "." + parts[-1]
            else:
                text = text.replace(",", ".")

        elif "." in text:
            # Tek noktalı Excel/string değerini ondalık olarak koru:
            # 481.17 -> 481.17
            # Birden fazla nokta varsa sonuncuyu ondalık kabul et.
            if text.count(".") > 1:
                parts = text.split(".")
                text = "".join(parts[:-1]) + "." + parts[-1]

        try:
            return float(text)
        except (TypeError, ValueError):
            return float(default)

    return dataframe[column].apply(parse_number).astype("float64")


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

    cleaned_sales_df, duplicate_info = deduplicate_sales_rows(sales_df)
    sales = normalize_columns(cleaned_sales_df)
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
    quantity_column = columns["quantity"]
    product_column = columns["product"]
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
    # Reçete türü kolonu yoksa bütün satışları "Normal Reçete"
    # olarak işaretlemiyoruz. Kontrollü reçete sınıflaması ürün
    # referans motorundan ayrıca yapılır.
    sales["_prescription_type"] = text_series(
        sales,
        prescription_type_column,
        "",
    )
    sales["_prescription_no"] = text_series(
        sales,
        prescription_no_column,
    )
    sales["_transaction_no"] = text_series(
        sales,
        transaction_no_column,
    )
    sales["_product"] = text_series(
        sales,
        product_column,
    )
    sales["_quantity"] = numeric_series(
        sales,
        quantity_column,
        0,
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

    all_patients = build_patient_metrics(
        sales,
        patient_column=patient_column,
        transaction_no_column=transaction_no_column,
        doctor_column=doctor_column,
        product_column=product_column,
        quantity_column=quantity_column,
        limit=None,
    )
    patients = all_patients[:100]

    lapsed_patients = [
        patient
        for patient in all_patients
        if bool(patient.get("is_lapsed"))
    ][:100]

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

    total_patient_count = len(all_patients)

    # Geriye uyumluluk:
    # Eski frontend/Copilot sürümleri active_patient_count alanını
    # kullanmaya devam edebilir. Yeni ürün dili "Toplam Hasta"dır.
    active_patient_count = total_patient_count

    vip_patient_count = sum(
        1
        for patient in all_patients
        if str(patient.get("segment", "")).lower() == "vip"
    )
    lost_patient_risk_count = sum(
        1
        for patient in all_patients
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
        "total_patient_count": total_patient_count,
        "active_patient_count": active_patient_count,
        "vip_patient_count": vip_patient_count,
        "lost_patient_risk_count": lost_patient_risk_count,
        "lapsed_patient_count": sum(
            1
            for patient in all_patients
            if bool(patient.get("is_lapsed"))
        ),
        "doctors": doctors,
        "patients": patients,
        # AYÇA Asistan isim-soyisim sorgularında ilk 100 kayıtla
        # sınırlı kalmaması için tüm hasta özeti.
        "patient_lookup": all_patients,
        "lapsed_patients": lapsed_patients,
        "institutions": institutions,
        "prescriptions": prescriptions,
        "detected_columns": detected_columns,
        "missing_columns": missing_columns,
        "duplicate_info": duplicate_info,
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



def _format_patient_interval(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "0"

    if abs(number - round(number)) < 0.05:
        return str(int(round(number)))

    return f"{number:.1f}".replace(".", ",")


def build_patient_metrics(
    sales: pd.DataFrame,
    patient_column: str | None,
    transaction_no_column: str | None,
    doctor_column: str | None = None,
    product_column: str | None = None,
    quantity_column: str | None = None,
    limit: int | None = 100,
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

        visit_dates = (
            group["_date"]
            .dropna()
            .dt.normalize()
            .drop_duplicates()
            .sort_values()
        )

        average_visit_interval_days = None
        previous_visit_date = None

        if len(visit_dates) >= 2:
            date_diffs = visit_dates.diff().dropna().dt.days
            if not date_diffs.empty:
                average_visit_interval_days = safe_float(date_diffs.mean())
            previous_visit_date = visit_dates.iloc[-2]

        delay_ratio = None

        if (
            days_since_visit is not None
            and average_visit_interval_days is not None
            and average_visit_interval_days > 0
        ):
            delay_ratio = safe_float(
                days_since_visit / average_visit_interval_days
            )

        # Risk seviyesi:
        # Statik gün eşiklerini hastanın kendi ziyaret ritmiyle birlikte
        # değerlendiriyoruz. Böylece 100 günde bir düzenli gelen hastayı
        # 90. günde "kritik" saymak veya 15 günde bir gelen hastanın
        # ciddi gecikmesini gözden kaçırmak engellenir.
        if days_since_visit is None:
            risk_level = "Bilinmiyor"
            risk_reason = "Son ziyaret tarihi doğrulanamadı."
        else:
            cadence_escalation = None

            if delay_ratio is not None:
                if delay_ratio >= 3.0:
                    cadence_escalation = "Kritik"
                elif delay_ratio >= 2.0:
                    cadence_escalation = "Yüksek"
                elif delay_ratio >= 1.5:
                    cadence_escalation = "Orta"

            static_level = (
                "Kritik"
                if days_since_visit >= 90
                else "Yüksek"
                if days_since_visit >= 60
                else "Orta"
                if days_since_visit >= 30
                else "Düşük"
            )

            risk_rank = {
                "Düşük": 1,
                "Orta": 2,
                "Yüksek": 3,
                "Kritik": 4,
            }

            if cadence_escalation is not None:
                # Uzun doğal ziyaret aralığı olan hastalarda sadece statik 90 gün
                # nedeniyle gereksiz kritik işaretleme yapmamak için cadence'i
                # dengeleyici sinyal olarak kullan.
                if (
                    average_visit_interval_days is not None
                    and average_visit_interval_days >= 60
                    and delay_ratio < 1.5
                ):
                    risk_level = "Düşük"
                else:
                    risk_level = (
                        cadence_escalation
                        if risk_rank[cadence_escalation] >= risk_rank[static_level]
                        else static_level
                    )
            else:
                if (
                    average_visit_interval_days is not None
                    and average_visit_interval_days >= 60
                    and delay_ratio is not None
                    and delay_ratio < 1.5
                ):
                    risk_level = "Düşük"
                else:
                    risk_level = static_level

            if (
                average_visit_interval_days is not None
                and delay_ratio is not None
            ):
                risk_reason = (
                    f"Son ziyaretten bu yana {days_since_visit} gün geçti; "
                    f"ortalama ziyaret aralığı yaklaşık "
                    f"{_format_patient_interval(average_visit_interval_days)} gün. "
                    f"Gecikme oranı {delay_ratio:.1f}x."
                )
            else:
                risk_reason = (
                    f"Son ziyaretten bu yana {days_since_visit} gün geçti."
                )

        # Gerçek "gelmeyi bırakan" sinyali risk seviyesinden ayrıdır.
        # Hasta en az 2 ziyaretlik geçmişe sahip olmalı ve:
        # - ya son ziyaretinden 90+ gün geçmiş olmalı ve kendi ritminin
        #   en az 1.5 katını aşmış olmalı,
        # - ya da ritmin en az 3 katı gecikmiş olmalı.
        is_lapsed = False
        lapsed_reason = ""

        if (
            safe_int(visit_count) >= 2
            and days_since_visit is not None
        ):
            if (
                delay_ratio is not None
                and delay_ratio >= 3.0
            ):
                is_lapsed = True
                lapsed_reason = (
                    f"Hasta normal ziyaret ritminin {delay_ratio:.1f} katı "
                    "kadar gecikmiş."
                )
            elif (
                days_since_visit >= 90
                and (
                    delay_ratio is None
                    or delay_ratio >= 1.5
                )
            ):
                is_lapsed = True
                lapsed_reason = (
                    f"Son ziyaretten bu yana {days_since_visit} gün geçti"
                    + (
                        f" ve normal ritmin {delay_ratio:.1f} katı aşıldı."
                        if delay_ratio is not None
                        else "."
                    )
                )

        # VIP: hem düzenli hem ekonomik değeri yüksek hasta.
        if visit_count >= 8 and turnover >= 15000:
            segment = "VIP"
        elif visit_count >= 4:
            segment = "Sadık"
        elif visit_count >= 2:
            segment = "Aktif"
        else:
            segment = "Yeni"

        doctor_history: list[dict[str, Any]] = []
        if doctor_column:
            doctor_working = group[
                group["_doctor"].ne("")
                & ~group["_doctor"].str.lower().isin(
                    {"nan", "none", "belirtilmemiş", "belirtilmemis"}
                )
            ].copy()

            if not doctor_working.empty:
                for doctor_name, doctor_group in doctor_working.groupby("_doctor"):
                    doctor_history.append(
                        {
                            "doctor_name": str(doctor_name),
                            "visit_count": safe_int(
                                doctor_group["_transaction_no"]
                                .replace("", pd.NA)
                                .nunique()
                                if transaction_no_column
                                else len(doctor_group)
                            ),
                            "turnover": safe_float(
                                doctor_group["_turnover"].sum()
                            ),
                            "last_visit": (
                                doctor_group["_date"].max().strftime("%d.%m.%Y")
                                if doctor_group["_date"].notna().any()
                                else "-"
                            ),
                        }
                    )

                doctor_history = sorted(
                    doctor_history,
                    key=lambda item: (
                        item["visit_count"],
                        item["turnover"],
                    ),
                    reverse=True,
                )[:10]

        recent_products: list[dict[str, Any]] = []
        if product_column:
            product_working = group[
                group["_product"].ne("")
                & ~group["_product"].str.lower().isin(
                    {"nan", "none", "belirtilmemiş", "belirtilmemis"}
                )
            ].copy()

            if not product_working.empty:
                product_working = product_working.sort_values(
                    "_date",
                    ascending=False,
                    na_position="last",
                )
                seen_products: set[str] = set()

                for _, product_row in product_working.iterrows():
                    product_name = str(product_row["_product"]).strip()
                    product_key = normalize_text(product_name)

                    if not product_key or product_key in seen_products:
                        continue

                    seen_products.add(product_key)
                    product_date = product_row["_date"]

                    recent_products.append(
                        {
                            "product_name": product_name,
                            "quantity": (
                                safe_int(product_row["_quantity"])
                                if quantity_column
                                else None
                            ),
                            "date": (
                                product_date.strftime("%d.%m.%Y")
                                if pd.notna(product_date)
                                else "-"
                            ),
                        }
                    )

                    if len(recent_products) >= 10:
                        break

        recent_visits: list[dict[str, Any]] = []
        visit_working = group.copy()

        if transaction_no_column:
            visit_working["_visit_key"] = (
                visit_working["_transaction_no"].replace("", pd.NA)
            )
        else:
            visit_working["_visit_key"] = visit_working.index.astype(str)

        visit_working = visit_working.sort_values(
            "_date",
            ascending=False,
            na_position="last",
        )

        for _, visit_group in visit_working.groupby(
            "_visit_key",
            dropna=False,
            sort=False,
        ):
            visit_date = (
                visit_group["_date"].max()
                if visit_group["_date"].notna().any()
                else pd.NaT
            )

            recent_visits.append(
                {
                    "date": (
                        visit_date.strftime("%d.%m.%Y")
                        if pd.notna(visit_date)
                        else "-"
                    ),
                    "turnover": safe_float(
                        visit_group["_turnover"].sum()
                    ),
                    "doctor_name": (
                        next(
                            (
                                value
                                for value in visit_group["_doctor"].tolist()
                                if str(value).strip()
                            ),
                            "",
                        )
                        if doctor_column
                        else ""
                    ),
                }
            )

            if len(recent_visits) >= 10:
                break

        records.append(
            {
                "patient_name": mask_patient_name(patient_name),
                "patient_name_full": str(patient_name).strip(),
                "segment": segment,
                "visit_count": safe_int(visit_count),
                "turnover": turnover,
                "last_visit": (
                    last_visit_value.strftime("%d.%m.%Y")
                    if pd.notna(last_visit_value)
                    else "-"
                ),
                "previous_visit": (
                    previous_visit_date.strftime("%d.%m.%Y")
                    if previous_visit_date is not None
                    else "-"
                ),
                "days_since_visit": (
                    safe_int(days_since_visit)
                    if days_since_visit is not None
                    else None
                ),
                "average_visit_interval_days": (
                    safe_float(average_visit_interval_days)
                    if average_visit_interval_days is not None
                    else None
                ),
                "visit_delay_ratio": delay_ratio,
                "risk_level": risk_level,
                "risk_reason": risk_reason,
                "is_lapsed": is_lapsed,
                "lapsed_reason": lapsed_reason,
                "doctor_history": doctor_history,
                "recent_products": recent_products,
                "recent_visits": recent_visits,
            }
        )

    sorted_records = sorted(
        records,
        key=lambda item: (
            item["risk_level"] in {"Kritik", "Yüksek"},
            item["turnover"],
        ),
        reverse=True,
    )

    return sorted_records[:limit] if limit is not None else sorted_records


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


# -------------------------------------------------------------------
# KONTROLLÜ REÇETE REFERANS MOTORU
# -------------------------------------------------------------------
# Kırmızı / Yeşil listeleri önceki AYÇA demo referans motorundan;
# Mor / Turuncu listeleri kullanıcı tarafından sağlanan referanstan gelir.
#
# Bu liste reçete işleminin hukuki/klinik doğrulaması değildir.
# Ürün adı bazlı karar destek sınıflamasıdır. Canlı üründe barkodlu
# resmi master liste geldiğinde aynı katman barkodla güçlendirilebilir.

CONTROLLED_PRESCRIPTION_REFERENCE: dict[str, list[str]] = {
    "Kırmızı Reçete": [
        "ABSTRAL",
        "ACTIQ",
        "ALDINE",
        "ALDOLAN",
        "CEDEPTIN",
        "CONCERTA",
        "DUROGESIC",
        "EFFENTORA",
        "FENTANYL",
        "FENTANYL CITRATE",
        "FENTANEST",
        "FENTAVER",
        "JURNISTA",
        "KONSENIDAT",
        "MEDIKINET",
        "M ESLON",
        "M-ESLON",
        "MORFIA",
        "MORFIN",
        "MORPHINE",
        "OPIVA",
        "OXOPANE",
        "PETHIDINE",
        "PETHOLAN",
        "RAPIFEN",
        "RENTANIL",
        "RITALIN",
        "SPRAVATO",
        "SUBOXONE",
        "SUFENTA",
        "TALINAT",
        "ULTIVA",
        "XYREM",
    ],
    "Yeşil Reçete": [
        "AKINETON",
        "ALYSE",
        "ANSIOX",
        "APO ALPRAZ",
        "AS ALPRALAM",
        "ATIVAN",
        "CODEFEN",
        "CONTRAMAL",
        "DALIZOM",
        "DEMIZOLAM",
        "DIAPAM",
        "DIAZEM",
        "DIAZEPAM DESITIN",
        "DORMICUM",
        "DUAMOL",
        "EKIPENTAL",
        "FENOKODIN",
        "FIXDOL",
        "GALARA",
        "GERICA",
        "HYPNOMIDATE",
        "IMOVANE",
        "KETALAR",
        "KLIPAKS",
        "LIBKOL",
        "LIZAN",
        "LUMINAL",
        "LUMINALETTEN",
        "LYPRE",
        "LYRICA",
        "MADOL",
        "MIDOLAM",
        "MILOZ",
        "NEOGABA",
        "NERVIUM",
        "NEURICA",
        "PADEN",
        "PAGADIN",
        "PAGAMAX",
        "PENTAL",
        "PERGE",
        "PIREPSIL",
        "PRECOBAL",
        "PRELICA",
        "PREPLUS",
        "REGAPEN",
        "RIVOTRIL",
        "ROLADOL",
        "SEDOZOLAM",
        "SNAPLINE",
        "SPESICOR",
        "STABINA",
        "STABLON",
        "SYMRA",
        "TRADOLEX",
        "TRAMADOLOR",
        "TRAMOSEL",
        "TRANXILENE",
        "ULTRAMEX",
        "XANAX",
        "ZALDIAR",
        "ZENIXA",
        "ZOLAMID",
    ],
    "Mor Reçete": [
        "OCTAGAM",
        "TEGELINE",
        "GENIVIG",
        "KIOVIG",
        "PRIVIGEN",
        "GAMUNEX-C",
        "FLEBOGAMMA",
        "NANOGAM",
        "IG VENA",
        "CLAIRYG",
        "PENTAGLOBIN",
        "HYQVIA",
        "RHOPHYLAC",
        "HYPERRHO-D",
        "IMMUNORHO",
        "HEPATECT CP",
        "HEPBQUIN",
        "HEPAGAM B",
        "IVHEBEX",
        "HEPABULIN SN",
        "TETAQUIN",
        "HUMAN ALBUMIN",
        "UMAN ALBUMIN",
        "PLASBUMIN",
        "ALBUREX",
        "ALBUMAN",
        "ZENALB",
        "VIALEBEX",
        "HAEMOCOMPLETTAN P",
        "TISSEEL",
        "BERIPLAST-P",
        "CINRYZE",
        "HEMLIBRA",
        "EQUAGAM",
    ],
    "Turuncu Reçete": [
        "FANHDI",
        "HEMOFIL M",
        "IMMUNATE",
        "KOATE-DVI",
        "HAEMOCTIN SDH",
        "HAEMATE-P",
        "OCTANATE",
        "BERIATE",
        "EMOCLOT",
        "REFACTO AF",
        "ADVATE",
        "KOVALTRY",
        "FACTOR 8Y",
        "ELOCTA",
        "NOVOEIGHT",
        "ADYNOVATE",
        "ESPEROCT",
        "AIMAFIX",
        "IMMUNINE",
        "OCTANINE F",
        "REPLENINE-VF",
        "BENEFIX",
        "ALPROLIX",
        "FEIBA",
        "COFACT",
        "NOVOSEVEN RT",
        "ARYOSEVEN",
    ],
}


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
    return original


def _product_matches_reference(
    product_name: Any,
    reference_name: str,
) -> bool:
    """
    Ürün ticari adının referans marka/adını içerip içermediğini güvenli
    normalize edilmiş token sınırlarıyla kontrol eder.

    Örnek:
        "LYRICA 75 MG 14 KAPSÜL" -> LYRICA
        "HUMAN ALBUMIN %20"      -> HUMAN ALBUMIN
    """
    product_key = normalize_text(product_name)
    reference_key = normalize_text(reference_name)

    if not product_key or not reference_key:
        return False

    padded_product = f"_{product_key}_"
    padded_reference = f"_{reference_key}_"

    return (
        product_key == reference_key
        or padded_reference in padded_product
        or product_key.startswith(f"{reference_key}_")
    )


def classify_controlled_prescription_product(
    product_name: Any,
) -> str | None:
    for prescription_type, reference_names in (
        CONTROLLED_PRESCRIPTION_REFERENCE.items()
    ):
        for reference_name in reference_names:
            if _product_matches_reference(
                product_name,
                reference_name,
            ):
                return prescription_type

    return None


def _build_reference_prescription_metrics(
    products: pd.DataFrame,
) -> list[dict[str, Any]]:
    """
    Ürün Bazında Toplamlar dosyasını referans sözlükle eşleştirir.

    Buradaki count "eşleşen farklı ürün sayısıdır"; reçete adedi değildir.
    quantity ise varsa Satılan Adet toplamıdır.
    """
    controlled_types = [
        "Kırmızı Reçete",
        "Yeşil Reçete",
        "Mor Reçete",
        "Turuncu Reçete",
    ]

    empty_records = [
        {
            "prescription_type": prescription_type,
            "count": 0,
            "product_count": 0,
            "quantity": 0,
            "turnover": 0.0,
            "alert_count": 0,
            "metric_basis": "product_reference",
            "source": "AYÇA kontrollü reçete ürün referansı",
            "products": [],
        }
        for prescription_type in controlled_types
    ]

    if products is None or products.empty:
        return empty_records

    product_column = find_column(
        products,
        [
            "ürün adı",
            "urun adi",
            "ürün",
            "urun",
            "ilaç adı",
            "ilac adi",
            "malzeme adı",
            "malzeme adi",
        ],
    )

    if not product_column:
        return empty_records

    quantity_column = find_column(
        products,
        [
            "satılan adet",
            "satilan adet",
            "satış adedi",
            "satis adedi",
            "adet",
            "miktar",
        ],
    )

    turnover_column = find_column(
        products,
        [
            "satış tutarı",
            "satis tutari",
            "ciro",
            "toplam tutar",
            "net tutar",
            "tutar",
        ],
    )

    working = products.copy()
    working["_reference_product_name"] = text_series(
        working,
        product_column,
    )
    working["_reference_prescription_type"] = working[
        "_reference_product_name"
    ].apply(classify_controlled_prescription_product)

    working["_reference_quantity"] = numeric_series(
        working,
        quantity_column,
        0,
    )
    working["_reference_turnover"] = numeric_series(
        working,
        turnover_column,
        0,
    )

    records: list[dict[str, Any]] = []

    for prescription_type in controlled_types:
        subset = working[
            working["_reference_prescription_type"]
            == prescription_type
        ].copy()

        product_count = int(
            subset["_reference_product_name"]
            .replace("", pd.NA)
            .dropna()
            .map(normalize_text)
            .nunique()
        )

        quantity = safe_int(
            subset["_reference_quantity"].sum()
        )
        turnover = safe_float(
            subset["_reference_turnover"].sum()
        )

        product_details: list[dict[str, Any]] = []

        if not subset.empty:
            detail_working = subset[
                [
                    "_reference_product_name",
                    "_reference_quantity",
                    "_reference_turnover",
                ]
            ].copy()

            detail_working["_product_key"] = detail_working[
                "_reference_product_name"
            ].map(normalize_text)

            for _, product_group in detail_working.groupby(
                "_product_key",
                sort=False,
            ):
                product_names = (
                    product_group["_reference_product_name"]
                    .replace("", pd.NA)
                    .dropna()
                )

                if product_names.empty:
                    continue

                product_details.append(
                    {
                        "product_name": str(product_names.iloc[0]).strip(),
                        "quantity": safe_int(
                            product_group["_reference_quantity"].sum()
                        ),
                        "turnover": safe_float(
                            product_group["_reference_turnover"].sum()
                        ),
                    }
                )

        product_details = sorted(
            product_details,
            key=lambda item: (
                item["turnover"],
                item["quantity"],
                item["product_name"],
            ),
            reverse=True,
        )

        records.append(
            {
                "prescription_type": prescription_type,
                "count": product_count,
                "product_count": product_count,
                "quantity": quantity,
                "turnover": turnover,
                "alert_count": product_count,
                "metric_basis": "product_reference",
                "source": "AYÇA kontrollü reçete ürün referansı",
                "products": product_details,
            }
        )

    return records


def _build_direct_prescription_metrics(
    sales: pd.DataFrame,
    prescription_type_column: str | None,
    prescription_no_column: str | None,
) -> list[dict[str, Any]]:
    """
    Satış hareketlerinde doğrudan reçete türü / risk türü varsa onu kullanır.
    Tür kolonu yoksa bütün satışları Normal Reçete saymaz.
    """
    working = sales.copy()

    has_direct_type = bool(
        prescription_type_column
        and working["_prescription_type"]
        .replace("", pd.NA)
        .notna()
        .any()
    )

    has_risk_type = bool(
        working["_risk_type"]
        .replace("", pd.NA)
        .notna()
        .any()
    )

    if not has_direct_type and not has_risk_type:
        return []

    working["_prescription_label"] = ""

    if has_direct_type:
        working["_prescription_label"] = working[
            "_prescription_type"
        ].apply(normalize_prescription_type)

    if has_risk_type:
        risk_mask = working["_risk_type"].ne("")
        working.loc[
            risk_mask,
            "_prescription_label",
        ] = working.loc[
            risk_mask,
            "_risk_type",
        ].apply(normalize_prescription_type)

    working = working[
        working["_prescription_label"].ne("")
    ].copy()

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

        normalized_type = normalize_text(
            prescription_type
        )

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
                "prescription_type": str(
                    prescription_type
                ),
                "count": safe_int(count),
                "product_count": None,
                "quantity": None,
                "turnover": safe_float(
                    group["_turnover"].sum()
                ),
                "alert_count": alert_count,
                "metric_basis": "direct_prescription",
                "source": "Satış hareketleri reçete türü",
                "products": [],
            }
        )

    return records


def build_prescription_metrics(
    sales: pd.DataFrame,
    products: pd.DataFrame,
    prescription_type_column: str | None,
    prescription_no_column: str | None,
) -> list[dict[str, Any]]:
    """
    Öncelik:
      1) Satış hareketlerinde gerçek reçete türü varsa doğrudan kullan.
      2) Kontrollü renkler için ürün bazında referans eşleşmesini kullan.
      3) Reçete türü kolonu yoksa tüm satışları 'Normal Reçete' kabul etme.

    Böylece Kırmızı/Yeşil/Mor/Turuncu kartları 3 Excel'in birleşik
    bilgisinden üretilebilirken sahte Normal Reçete sayısı oluşmaz.
    """
    direct_records = _build_direct_prescription_metrics(
        sales=sales,
        prescription_type_column=prescription_type_column,
        prescription_no_column=prescription_no_column,
    )

    reference_records = (
        _build_reference_prescription_metrics(
            products=products,
        )
    )

    direct_by_type = {
        normalize_prescription_type(
            item["prescription_type"]
        ): item
        for item in direct_records
        if normalize_prescription_type(
            item["prescription_type"]
        )
    }

    reference_by_type = {
        item["prescription_type"]: item
        for item in reference_records
    }

    final_records: list[dict[str, Any]] = []

    # Normal reçete yalnızca kaynak dosyada doğrudan tür bilgisi
    # varsa güvenilir biçimde gösterilir.
    normal_record = direct_by_type.get(
        "Normal Reçete"
    )
    if normal_record is not None:
        final_records.append(normal_record)

    controlled_types = [
        "Kırmızı Reçete",
        "Yeşil Reçete",
        "Mor Reçete",
        "Turuncu Reçete",
    ]

    for prescription_type in controlled_types:
        direct_record = direct_by_type.get(
            prescription_type
        )

        # Doğrudan reçete türü verisi varsa en yüksek güvenilirlik odur.
        if (
            direct_record is not None
            and safe_int(direct_record.get("count")) > 0
        ):
            final_records.append(direct_record)
            continue

        final_records.append(
            reference_by_type.get(
                prescription_type,
                {
                    "prescription_type": prescription_type,
                    "count": 0,
                    "product_count": 0,
                    "quantity": 0,
                    "turnover": 0.0,
                    "alert_count": 0,
                    "metric_basis": "product_reference",
                    "source": (
                        "AYÇA kontrollü reçete ürün referansı"
                    ),
                    "products": [],
                },
            )
        )

    # Kontrollü/Kkİ gibi doğrudan gelen ve dört temel renkten biri
    # olmayan ek sinyalleri de kaybetme.
    known_types = {
        "Normal Reçete",
        *controlled_types,
    }

    for item in direct_records:
        item_type = normalize_prescription_type(
            item["prescription_type"]
        )
        if item_type not in known_types:
            final_records.append(item)

    return sorted(
        final_records,
        key=lambda item: (
            item["prescription_type"]
            != "Normal Reçete",
            item["count"],
        ),
        reverse=True,
    )

def empty_patient_metrics(
    message: str,
) -> dict[str, Any]:
    return {
        "success": False,
        "health_score": 0,
        "total_patient_count": 0,
        "active_patient_count": 0,
        "vip_patient_count": 0,
        "lost_patient_risk_count": 0,
        "lapsed_patient_count": 0,
        "doctors": [],
        "patients": [],
        "patient_lookup": [],
        "lapsed_patients": [],
        "institutions": [],
        "prescriptions": [],
        "detected_columns": {},
        "missing_columns": [],
        "message": message,
    }