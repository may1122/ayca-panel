from io import BytesIO

import pandas as pd

from app.services.supabase_client import supabase


def get_latest_file_upload(company_id: str, file_type: str):
    """
    İlgili şirkete ait en son yüklenen dosyayı getirir.
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


def read_excel_from_storage(storage_path: str):
    """
    Supabase Storage içerisindeki Excel dosyasını indirir
    ve temel bilgilerini döndürür.
    """

    file_bytes = (
        supabase
        .storage
        .from_("pharmacy-files")
        .download(storage_path)
    )

    df = pd.read_excel(BytesIO(file_bytes))

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
    }
def read_excel_dataframe_from_storage(storage_path: str):
    file_bytes = (
        supabase
        .storage
        .from_("pharmacy-files")
        .download(storage_path)
    )

    return pd.read_excel(BytesIO(file_bytes))    