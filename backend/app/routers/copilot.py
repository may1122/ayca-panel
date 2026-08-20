from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.services.copilot_engine import create_deterministic_answer
from app.services.supabase_client import supabase


router = APIRouter(
    prefix="/copilot",
    tags=["Copilot"],
)


class CopilotRequest(BaseModel):
    company_id: str = Field(min_length=1)
    question: str = Field(min_length=1)
    analysis_result: dict


def validate_user_company(
    company_id: str,
    authorization: str | None,
):
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
        .select("company_id,role")
        .eq("id", user.id)
        .limit(1)
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            status_code=403,
            detail="Kullanıcı profili bulunamadı.",
        )

    profile = profile_result.data[0]

    if profile.get("role") == "admin":
        return user

    if str(profile.get("company_id")) != str(company_id):
        raise HTTPException(
            status_code=403,
            detail="Bu şirketin verilerine erişim yetkiniz bulunmuyor.",
        )

    return user


@router.post("/ask")
def copilot_ask(
    payload: CopilotRequest,
    authorization: str | None = Header(default=None),
):
    validate_user_company(
        payload.company_id,
        authorization,
    )

    result = create_deterministic_answer(
        question=payload.question,
        analysis_result=payload.analysis_result,
    )

    return {
        "success": True,
        "answer": result.get("answer"),
        "intent": result.get("intent"),
        "sub_intent": result.get("sub_intent"),
        "items": result.get("items", []),
        "recommended_action": result.get(
            "recommended_action"
        ),
        "confidence_score": result.get(
            "confidence_score",
            0,
        ),
        "source": result.get(
            "source",
            "code_intelligence",
        ),
        "llm_used": result.get(
            "llm_used",
            False,
        ),
    }
