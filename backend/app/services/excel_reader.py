from io import BytesIO

import pandas as pd

from app.services.supabase_client import supabase


BUCKET_NAME = "pharmacy-files"


def get_latest_file_upload(company_id: str, file_type: str):
    """
    İlgili şirkete ait en son yüklenen dosya kaydını getirir.

    Not:
    Yeni analiz akışı doğrudan storage_path kullanır.
    Bu fonksiyon eski ekranlar veya geçmiş dosya sorguları için korunmuştur.
    """

    result = (
        supabase
        .table("file_uploads")
        .select(
            "id, company_id, user_id, file_type, file_name, storage_path, created_at"
        )
        .eq("company_id", company_id)
        .eq("file_type", file_type)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        return None

    return result.data[0]


def download_file_bytes(storage_path: str) -> bytes:
    if not storage_path:
        raise ValueError("Storage dosya yolu boş olamaz.")

    file_bytes = (
        supabase
        .storage
        .from_(BUCKET_NAME)
        .download(storage_path)
    )

    if not file_bytes:
        raise ValueError("Dosya Supabase Storage üzerinden indirilemedi.")

    if isinstance(file_bytes, bytearray):
        return bytes(file_bytes)

    if not isinstance(file_bytes, bytes):
        raise TypeError("Storage cevabı geçerli bir dosya içeriği değil.")

    return file_bytes


def dataframe_from_bytes(file_bytes: bytes, storage_path: str):
    normalized_path = storage_path.lower()

    if normalized_path.endswith(".csv"):
        try:
            return pd.read_csv(BytesIO(file_bytes))
        except UnicodeDecodeError:
            return pd.read_csv(
                BytesIO(file_bytes),
                encoding="latin-1",
            )

    if normalized_path.endswith(".xls") or normalized_path.endswith(".xlsx"):
        return pd.read_excel(BytesIO(file_bytes))

    raise ValueError(
        "Desteklenmeyen dosya formatı. .xlsx, .xls veya .csv kullanınız."
    )


def read_excel_from_storage(storage_path: str):
    """
    Supabase Storage içindeki tablo dosyasını indirir
    ve temel bilgilerini döndürür.
    """

    df = read_excel_dataframe_from_storage(storage_path)

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
    }


def read_excel_dataframe_from_storage(storage_path: str):
    """
    Verilen storage_path üzerindeki Excel veya CSV dosyasını
    pandas DataFrame olarak döndürür.
    """

    file_bytes = download_file_bytes(storage_path)

    return dataframe_from_bytes(
        file_bytes=file_bytes,
        storage_path=storage_path,
    )