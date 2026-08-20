from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.services.supabase_client import supabase


router = APIRouter(prefix="/admin", tags=["Admin"])


class CreateCustomerRequest(BaseModel):
    company_name: str = Field(min_length=2)
    city: str | None = None
    full_name: str = Field(min_length=2)
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    package_name: str | None = "Insight"
    status: str = "demo"


def validate_admin(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Oturum doğrulanamadı.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        auth_result = supabase.auth.get_user(token)
        user = auth_result.user
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail="Geçersiz veya süresi dolmuş oturum.",
        ) from exc

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Kullanıcı doğrulanamadı.",
        )

    profile_result = (
        supabase.table("profiles")
        .select("role")
        .eq("id", user.id)
        .limit(1)
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            status_code=403,
            detail="Admin profili bulunamadı.",
        )

    if profile_result.data[0].get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin yetkisi gerekli.",
        )

    return user


@router.post("/customers")
def create_customer(
    payload: CreateCustomerRequest,
    authorization: str | None = Header(default=None),
):
    validate_admin(authorization)

    if payload.status not in {"demo", "active", "passive"}:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz müşteri durumu.",
        )

    # Basit MVP e-posta kontrolü.
    email = payload.email.strip().lower()

    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(
            status_code=400,
            detail="Geçerli bir e-posta adresi giriniz.",
        )

    # -----------------------------------------------------
    # 1. Şirketi oluştur
    # -----------------------------------------------------

    try:
        company_result = (
            supabase.table("companies")
            .insert(
                {
                    "name": payload.company_name.strip(),
                    "city": payload.city.strip() if payload.city else None,
                    "package_name": payload.package_name,
                    "status": payload.status,
                }
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Şirket oluşturulamadı: {exc}",
        ) from exc

    if not company_result.data:
        raise HTTPException(
            status_code=500,
            detail="Şirket oluşturulamadı.",
        )

    company = company_result.data[0]
    company_id = company["id"]

    new_user = None

    try:
        # -------------------------------------------------
        # 2. Supabase Auth kullanıcısını oluştur
        # -------------------------------------------------

        auth_result = supabase.auth.admin.create_user(
            {
                "email": email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": payload.full_name.strip(),
                },
            }
        )

        new_user = auth_result.user

        if not new_user:
            raise RuntimeError("Auth kullanıcısı oluşturulamadı.")

        # -------------------------------------------------
        # 3. Trigger tarafından oluşturulan profile kaydını
        #    yeni şirkete bağla
        # -------------------------------------------------

        profile_result = (
            supabase.table("profiles")
            .update(
                {
                    "company_id": company_id,
                    "full_name": payload.full_name.strip(),
                    "role": "customer",
                }
            )
            .eq("id", new_user.id)
            .execute()
        )

        if not profile_result.data:
            raise RuntimeError(
                "Kullanıcı profili şirkete bağlanamadı."
            )

    except Exception as exc:
        # -------------------------------------------------
        # Rollback
        # -------------------------------------------------

        if new_user:
            try:
                supabase.auth.admin.delete_user(new_user.id)
            except Exception:
                pass

        try:
            supabase.table("companies").delete().eq(
                "id",
                company_id,
            ).execute()
        except Exception:
            pass

        raise HTTPException(
            status_code=400,
            detail=f"Müşteri kullanıcısı oluşturulamadı: {exc}",
        ) from exc

    return {
        "success": True,
        "message": "Müşteri başarıyla oluşturuldu.",
        "company": company,
        "user": {
            "id": new_user.id,
            "email": new_user.email,
        },
    }