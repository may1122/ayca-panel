import json
import re
import unicodedata
from typing import Any


COPILOT_INTENTS = {
    "stock": [
        "stok",
        "kritik",
        "bitecek",
        "biter",
        "stokta",
        "stoklar",
    ],
    "order": [
        "sipariş",
        "siparis",
        "satın al",
        "almalıyım",
        "almalıyiz",
        "bütçe",
    ],
    "product": [
        "ürün",
        "ürünüm",
        "ürünler",
        "ilaç",
        "ilac",
        "barkod",
    ],
    "finance": [
        "ciro",
        "kâr",
        "kar",
        "finans",
        "finansal",
        "kazanç",
        "gelir",
        "satış tutarı",
    ],
    "patient": [
        "hasta",
        "vip",
        "müşteri",
        "kayip riski",
        "kayıp riski",
    ],
    "doctor": [
        "doktor",
        "hekim",
        "reçete",
        "recete",
    ],
    "risk": [
        "risk",
        "ölü stok",
        "fazla stok",
        "miad",
        "miadı",
        "skt",
    ],
}


SYSTEM_RULES = [
    "Yalnızca sağlanan context içindeki doğrulanmış verilere dayan.",
    "Context içinde olmayan sayı, isim, ürün, hasta, doktor veya finansal değer üretme.",
    "Eksik veri varsa bunu açıkça belirt.",
    "Yeni matematiksel varsayım üretme; motorların hesapladığı değerleri kullan.",
    "Cevapları kısa, yönetici odaklı ve aksiyon alınabilir biçimde ver.",
    "Bir öneri verirken mümkünse gerekçesini de context içinden belirt.",
    "Sağlık, reçete veya hasta verilerini teşhis veya tedavi önerisine dönüştürme.",
    "Hasta ve doktor verilerinde yalnızca context içinde verilen alanları kullan.",
    "Güven skoru düşükse kesinlik dili kullanma.",
]


INTENT_GUIDANCE = {
    "stock": (
        "Stok sorularında kritik stok, sıfır stok, stok bitiş süresi "
        "ve ürün bazlı stok sinyallerine odaklan."
    ),
    "order": (
        "Sipariş sorularında toplam öneri sayısı, tahmini bütçe, "
        "öncelik ve top_suggestions verilerini kullan."
    ),
    "product": (
        "Ürün sorularında Product Intelligence içindeki ürün bazlı stok, satış, "
        "ciro, kâr, marj, stok günü, bağlı sermaye ve sipariş sinyallerini kullan."
    ),
    "finance": (
        "Finans sorularında ciro, kâr, kâr marjı, ortalama satış "
        "ve işlem sayısını birlikte değerlendir."
    ),
    "patient": (
        "Hasta sorularında toplam hasta, VIP hasta, kayıp riski ve "
        "context içindeki hasta listelerini kullan."
    ),
    "doctor": (
        "Doktor sorularında doktor listesi, reçete sayısı, ciro ve "
        "context içindeki doktor performansını kullan."
    ),
    "risk": (
        "Risk sorularında risk skoru, kritik/sıfır/fazla/ölü stok "
        "ve miad sinyallerini birlikte değerlendir."
    ),
    "general": (
        "Genel yönetim sorularında Decision Engine önceliğini, "
        "Sabah Brifingi aksiyonlarını ve ilgili operasyon metriklerini kullan."
    ),
}


def _safe_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def normalize_question(question: str | None) -> str:
    if not question:
        return ""

    return " ".join(
        str(question)
        .strip()
        .casefold()
        .split()
    )


def detect_intent(question: str | None) -> dict:
    normalized = normalize_question(question)

    scores = {
        intent: 0
        for intent in COPILOT_INTENTS
    }

    matched_keywords: dict[str, list[str]] = {
        intent: []
        for intent in COPILOT_INTENTS
    }

    for intent, keywords in COPILOT_INTENTS.items():
        for keyword in keywords:
            if keyword.casefold() in normalized:
                scores[intent] += 1
                matched_keywords[intent].append(keyword)

    if any(
        word in normalized
        for word in [
            "ürün",
            "ürünüm",
            "ürünler",
            "ilaç",
            "ilac",
        ]
    ):
        scores["product"] += 2

    best_intent = "general"
    best_score = 0

    for intent, score in scores.items():
        if score > best_score:
            best_intent = intent
            best_score = score

    return {
        "intent": best_intent,
        "score": best_score,
        "matched_keywords": matched_keywords.get(
            best_intent,
            [],
        ),
        "normalized_question": normalized,
    }


def build_copilot_context(
    question: str,
    analysis_result: dict | None,
) -> dict:
    analysis = _safe_dict(analysis_result)

    intent_result = detect_intent(question)
    intent = intent_result["intent"]

    inventory = _safe_dict(
        analysis.get("inventory_metrics")
    )
    finance = _safe_dict(
        analysis.get("finance_metrics")
    )
    orders = _safe_dict(
        analysis.get("order_suggestions")
    )
    risk = _safe_dict(
        analysis.get("risk_metrics")
    )
    expiry = _safe_dict(
        analysis.get("expiry_metrics")
    )
    patient = _safe_dict(
        analysis.get("patient_metrics")
    )
    product_intelligence = _safe_dict(
        analysis.get("product_intelligence")
    )
    decision = _safe_dict(
        analysis.get("decision_summary")
    )
    briefing = _safe_dict(
        analysis.get("morning_briefing")
    )

    context: dict[str, Any] = {
        "question": question,
        "intent": intent,
        "intent_score": intent_result["score"],
        "matched_keywords": intent_result[
            "matched_keywords"
        ],
        "analysis_status": analysis.get(
            "analysis_status"
        ),
        "analysis_confidence_score": analysis.get(
            "analysis_confidence_score",
            decision.get(
                "confidence_score",
                briefing.get("confidence_score", 0),
            ),
        ),
    }

    if decision:
        context["decision"] = {
            "priority": decision.get("priority"),
            "priority_score": decision.get(
                "priority_score"
            ),
            "recommended_action": decision.get(
                "recommended_action"
            ),
            "reason_codes": _safe_list(
                decision.get("reason_codes")
            ),
            "confidence_score": decision.get(
                "confidence_score"
            ),
        }

    if intent in {"stock", "general"}:
        context["inventory"] = {
            "total_products": inventory.get(
                "total_products"
            ),
            "critical_stock_count": risk.get(
                "critical_stock_count",
                inventory.get(
                    "critical_stock_count"
                ),
            ),
            "zero_stock_count": risk.get(
                "zero_stock_count",
                inventory.get("zero_stock_count"),
            ),
            "over_stock_count": risk.get(
                "over_stock_count",
                inventory.get("over_stock_count"),
            ),
            "dead_stock_count": risk.get(
                "dead_stock_count"
            ),
            "stock_runout_products": _safe_list(
                risk.get("stock_runout_products")
            )[:50],
        }

    if intent in {"order", "general"}:
        context["orders"] = {
            "suggestion_count": orders.get(
                "suggestion_count"
            ),
            "estimated_order_budget": orders.get(
                "estimated_order_budget"
            ),
            "target_stock_days": orders.get(
                "target_stock_days"
            ),
            "top_suggestions": _safe_list(
                orders.get("top_suggestions")
            )[:50],
        }

    if intent in {"finance", "general"}:
        context["finance"] = {
            "total_turnover": finance.get(
                "total_turnover"
            ),
            "total_profit": finance.get(
                "total_profit"
            ),
            "profit_margin": finance.get(
                "profit_margin"
            ),
            "average_sale": finance.get(
                "average_sale"
            ),
            "transaction_count": finance.get(
                "transaction_count"
            ),
            "profit_source": finance.get(
                "profit_source"
            ),
        }

    if intent in {"risk", "general"}:
        context["risk"] = {
            "risk_score": risk.get("risk_score"),
            "zero_stock_count": risk.get(
                "zero_stock_count"
            ),
            "critical_stock_count": risk.get(
                "critical_stock_count"
            ),
            "warning_stock_count": risk.get(
                "warning_stock_count"
            ),
            "over_stock_count": risk.get(
                "over_stock_count"
            ),
            "dead_stock_count": risk.get(
                "dead_stock_count"
            ),
            "dead_stock_value": risk.get(
                "dead_stock_value"
            ),
            "risk_alerts": _safe_list(
                risk.get("risk_alerts")
            ),
            "risk_products": _safe_list(
                risk.get("risk_products")
            )[:50],
        }

        context["expiry"] = {
            "warning_count": expiry.get(
                "warning_count"
            ),
            "expired_count": expiry.get(
                "expired_count"
            ),
            "risk_stock_value": expiry.get(
                "risk_stock_value"
            ),
            "nearest_expiry_days": expiry.get(
                "nearest_expiry_days"
            ),
            "products": _safe_list(
                expiry.get("products")
            )[:50],
        }

    if intent in {"product", "general"}:
        context["product"] = {
            "product_count": product_intelligence.get(
                "product_count",
                0,
            ),
            "analysis_period_days": product_intelligence.get(
                "analysis_period_days"
            ),
            "products": _safe_list(
                product_intelligence.get("products")
            )[:500],
            "top_selling_products": _safe_list(
                product_intelligence.get("top_selling_products")
            )[:50],
            "top_turnover_products": _safe_list(
                product_intelligence.get("top_turnover_products")
            )[:50],
            "top_profit_products": _safe_list(
                product_intelligence.get("top_profit_products")
            )[:50],
            "critical_high_demand_products": _safe_list(
                product_intelligence.get(
                    "critical_high_demand_products"
                )
            )[:50],
            "capital_locked_products": _safe_list(
                product_intelligence.get("capital_locked_products")
            )[:50],
            "low_margin_products": _safe_list(
                product_intelligence.get("low_margin_products")
            )[:50],
            "dead_products": _safe_list(
                product_intelligence.get("dead_products")
            )[:50],
        }

    if intent in {"patient", "general"}:
        patient_rows = _safe_list(
            patient.get("patients")
        )

        vip_patients = _safe_list(
            patient.get("vip_patients")
        )
        if not vip_patients:
            vip_patients = [
                row
                for row in patient_rows
                if "vip" in str(
                    row.get("segment", "")
                ).casefold()
            ]

        churn_risk_patients = _safe_list(
            patient.get("churn_risk_patients")
        )
        if not churn_risk_patients:
            churn_risk_patients = [
                row
                for row in patient_rows
                if any(
                    label in str(
                        row.get("risk_level", "")
                    ).casefold()
                    for label in [
                        "yüksek",
                        "kritik",
                        "high",
                        "critical",
                    ]
                )
            ]

        patient_lookup_rows = _safe_list(
            patient.get("patient_lookup")
        ) or _safe_list(
            patient.get("all_patients")
        ) or patient_rows

        context["patient"] = {
            "total_patient_count": patient.get(
                "total_patient_count",
                patient.get(
                    "active_patient_count",
                    len(patient_lookup_rows),
                ),
            ),
            # Geriye uyumluluk için eski alanı context'te tutuyoruz.
            "active_patient_count": patient.get(
                "active_patient_count",
                patient.get(
                    "total_patient_count",
                    len(patient_lookup_rows),
                ),
            ),
            "vip_patient_count": patient.get(
                "vip_patient_count",
                len(vip_patients),
            ),
            "churn_risk_count": patient.get(
                "churn_risk_count",
                patient.get(
                    "lost_patient_risk_count",
                    len(churn_risk_patients),
                ),
            ),
            "patients": patient_rows[:100],
            "patient_lookup": patient_lookup_rows,
            "vip_patients": vip_patients[:100],
            "churn_risk_patients": churn_risk_patients[:100],
        }

    if intent in {"doctor", "general"}:
        doctor_rows = _safe_list(
            patient.get("doctors")
        )

        top_doctors = _safe_list(
            patient.get("top_doctors")
        )
        if not top_doctors:
            top_doctors = sorted(
                doctor_rows,
                key=lambda row: (
                    float(row.get("turnover") or 0),
                    float(
                        row.get("prescription_count")
                        or row.get("transaction_count")
                        or 0
                    ),
                ),
                reverse=True,
            )

        context["doctor"] = {
            "doctor_count": patient.get(
                "doctor_count",
                len(doctor_rows),
            ),
            "doctors": doctor_rows[:100],
            "top_doctors": top_doctors[:50],
        }

    if briefing:
        context["briefing"] = {
            "score": briefing.get("score"),
            "status": briefing.get("status"),
            "result": briefing.get("result"),
            "top_actions": _safe_list(
                briefing.get("top_actions")
            )[:5],
        }

    return context


def build_copilot_system_prompt() -> str:
    rules = "\n".join(
        f"- {rule}"
        for rule in SYSTEM_RULES
    )

    return (
        "Sen AYÇA Copilot'sun. "
        "Bir eczanenin doğrulanmış analiz sonuçlarını yorumlayan "
        "yönetim ve karar destek asistanısın.\n\n"
        "TEMEL KURALLAR:\n"
        f"{rules}\n\n"
        "Cevap biçimi:\n"
        "- Önce soruya doğrudan cevap ver.\n"
        "- Gerekiyorsa en fazla 3 kısa gerekçe ekle.\n"
        "- Uygun olduğunda 1 net aksiyon öner.\n"
        "- Context yetersizse bunu açıkça söyle.\n"
        "- Sayısal verileri değiştirme veya tahmin etme."
    )


def build_copilot_user_prompt(
    question: str,
    analysis_result: dict | None,
) -> dict:
    context = build_copilot_context(
        question=question,
        analysis_result=analysis_result,
    )

    intent = context.get(
        "intent",
        "general",
    )

    guidance = INTENT_GUIDANCE.get(
        intent,
        INTENT_GUIDANCE["general"],
    )

    context_json = json.dumps(
        context,
        ensure_ascii=False,
        indent=2,
        default=str,
    )

    user_prompt = (
        f"Kullanıcı sorusu:\n{question}\n\n"
        f"Niyet:\n{intent}\n\n"
        f"Yorumlama yönlendirmesi:\n{guidance}\n\n"
        "Doğrulanmış context:\n"
        f"{context_json}\n\n"
        "Bu context dışına çıkmadan cevap ver."
    )

    return {
        "system_prompt": build_copilot_system_prompt(),
        "user_prompt": user_prompt,
        "context": context,
        "intent": intent,
    }


def extract_context_facts(
    context: dict | None,
) -> dict:
    context = _safe_dict(context)

    facts: dict[str, Any] = {}

    for section_name, section_value in context.items():
        if not isinstance(section_value, dict):
            continue

        for key, value in section_value.items():
            if isinstance(
                value,
                (str, int, float, bool),
            ) or value is None:
                facts[
                    f"{section_name}.{key}"
                ] = value

    return facts


def validate_answer_against_context(
    answer: str | None,
    context: dict | None,
) -> dict:
    """
    İlk doğrulama katmanı.

    Bu fonksiyon bilinçli olarak katı bir halüsinasyon dedektörü değildir.
    Şimdilik cevap/context bağının izlenebilir olmasını sağlar.
    LLM entegrasyonundan sonra sayısal claim doğrulaması genişletilebilir.
    """

    answer_text = str(
        answer or ""
    ).strip()

    context_dict = _safe_dict(
        context
    )

    facts = extract_context_facts(
        context_dict
    )

    warnings: list[str] = []

    if not answer_text:
        warnings.append(
            "Model boş cevap üretti."
        )

    if not context_dict:
        warnings.append(
            "Doğrulama için context bulunamadı."
        )

    confidence = context_dict.get(
        "analysis_confidence_score"
    )

    try:
        confidence_value = float(
            confidence
        )
    except (TypeError, ValueError):
        confidence_value = 0.0

    if confidence_value < 70:
        warnings.append(
            "Analiz güveni düşük; cevap kesinlik içermemelidir."
        )

    return {
        "valid": len(warnings) == 0,
        "warnings": warnings,
        "analysis_confidence_score": confidence_value,
        "available_fact_count": len(facts),
    }

# ---------------------------------------------------------------------------
# CODE INTELLIGENCE LAYER
# ---------------------------------------------------------------------------

def detect_sub_intent(
    question: str | None,
    intent: str,
) -> str:
    q = normalize_question(question)

    if intent == "patient":
        if "vip" in q and any(
            word in q
            for word in [
                "kim",
                "liste",
                "hangileri",
                "göster",
            ]
        ):
            return "list_vip_patients"

        if any(
            phrase in q
            for phrase in [
                "kayıp riski",
                "kayip riski",
                "gelmeyen",
                "kaybet",
            ]
        ):
            return "list_churn_patients"

        if any(
            phrase in q
            for phrase in [
                "en iyi",
                "en güçlü",
                "en guclu",
                "en çok kazandıran",
                "en cok kazandiran",
                "en çok ciro",
                "en cok ciro",
                "en yüksek ciro",
                "en yuksek ciro",
                "top",
                "ilk ",
            ]
        ) and any(
            word in q
            for word in [
                "kim",
                "hasta",
                "müşteri",
                "musteri",
                "liste",
                "göster",
                "goster",
            ]
        ):
            return "top_patients"

        return "patient_summary"

    if intent == "stock":
        if "sıfır" in q or "stokta yok" in q:
            return "zero_stock"

        if any(
            phrase in q
            for phrase in [
                "kritik",
                "önce bitecek",
                "en önce bitecek",
                "bitecek",
                "biter",
            ]
        ):
            return "critical_products"

        return "stock_summary"

    if intent == "order":
        if _extract_budget_limit(q) is not None and any(
            word in q
            for word in [
                "hangi",
                "hangileri",
                "almalıyım",
                "alabilir",
                "öncelik",
                "seç",
            ]
        ):
            return "budget_order_plan"

        if "bütçe" in q or "tutar" in q:
            return "order_budget"

        if any(
            word in q
            for word in [
                "hangi",
                "hangileri",
                "öneri",
                "liste",
                "almalıyım",
            ]
        ):
            return "order_list"

        return "order_summary"

    if intent == "product":
        if any(
            phrase in q
            for phrase in [
                "en çok kâr",
                "en cok kar",
                "en çok kar",
                "en fazla kâr",
                "en fazla kar",
                "kâr bırakan",
                "kar bırakan",
                "kazandıran",
            ]
        ):
            return "product_top_profit"

        if any(
            phrase in q
            for phrase in [
                "en çok ciro",
                "en cok ciro",
                "en yüksek ciro",
                "en yuksek ciro",
                "satış tutarı",
                "satis tutari",
            ]
        ):
            return "product_top_turnover"

        if any(
            phrase in q
            for phrase in [
                "en çok satan",
                "en cok satan",
                "en fazla satan",
                "çok satan",
                "cok satan",
            ]
        ):
            return "product_top_selling"

        if any(
            phrase in q
            for phrase in [
                "satışı yüksek ama stoğu kritik",
                "satışı yüksek ama stoku kritik",
                "çok satıyor ama stok",
                "cok satiyor ama stok",
                "yüksek talep",
                "kritik talep",
            ]
        ):
            return "product_critical_high_demand"

        if any(
            phrase in q
            for phrase in [
                "ölü stokta en fazla",
                "olu stokta en fazla",
                "ölü stokta para",
                "olu stokta para",
                "en fazla para bağ",
                "en fazla para bag",
                "bağlı sermaye",
                "bagli sermaye",
                "stokta para",
            ]
        ):
            return "product_capital_locked"

        if any(
            phrase in q
            for phrase in [
                "düşük marj",
                "dusuk marj",
                "az kâr",
                "az kar",
                "kâr bırakmayan",
                "kar birakmayan",
                "satıyor ama kâr",
                "satiyor ama kar",
            ]
        ):
            return "product_low_margin"

        if any(
            phrase in q
            for phrase in [
                "ölü stok",
                "olu stok",
                "hareketsiz",
            ]
        ):
            return "product_dead"

        return "product_summary"

    if intent == "finance":
        if "ciro" in q:
            return "turnover"

        if "kâr" in q or "kar" in q:
            return "profit"

        return "finance_summary"

    if intent == "doctor":
        if any(
            phrase in q
            for phrase in [
                "en güçlü",
                "en iyi",
                "en yüksek",
                "top",
                "kim",
                "hangisi",
            ]
        ):
            return "top_doctors"

        return "doctor_summary"

    if intent == "risk":
        if "ölü stok" in q:
            return "dead_stock"

        if "fazla stok" in q:
            return "over_stock"

        if "miad" in q or "skt" in q:
            return "expiry_risk"

        return "risk_summary"

    return "general_summary"


def _format_number(
    value: Any,
    decimals: int = 0,
) -> str:
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        number = 0

    return f"{number:,.{decimals}f}".replace(
        ",",
        "_",
    ).replace(
        ".",
        ",",
    ).replace(
        "_",
        ".",
    )


def _extract_budget_limit(
    question: str | None,
) -> float | None:
    """
    Türkçe doğal dilde verilen basit bütçe ifadelerini yakalar.

    Örnek:
    - 100 bin TL
    - 100.000 TL
    - 100000 tl
    - 1,5 milyon TL
    """
    q = normalize_question(question)

    million_match = re.search(
        r"(\d+(?:[.,]\d+)?)\s*milyon",
        q,
    )
    if million_match:
        raw = million_match.group(1).replace(",", ".")
        try:
            return float(raw) * 1_000_000
        except ValueError:
            return None

    thousand_match = re.search(
        r"(\d+(?:[.,]\d+)?)\s*bin",
        q,
    )
    if thousand_match:
        raw = thousand_match.group(1).replace(",", ".")
        try:
            return float(raw) * 1_000
        except ValueError:
            return None

    money_match = re.search(
        r"(\d[\d.\s]*(?:,\d+)?)\s*(?:tl|₺)",
        q,
    )
    if money_match:
        raw = (
            money_match.group(1)
            .replace(" ", "")
            .replace(".", "")
            .replace(",", ".")
        )
        try:
            return float(raw)
        except ValueError:
            return None

    return None


def _priority_rank(value: Any) -> int:
    priority = str(value or "").casefold()

    if "acil" in priority or "yüksek" in priority:
        return 3
    if "orta" in priority:
        return 2
    if "normal" in priority:
        return 1

    return 0


def _order_value(item: dict) -> float:
    try:
        return float(
            item.get("Tahmini Sipariş Tutarı")
            or item.get("estimated_order_value")
            or 0
        )
    except (TypeError, ValueError):
        return 0.0


def _sort_order_suggestions(
    suggestions: list[dict],
) -> list[dict]:
    return sorted(
        suggestions,
        key=lambda item: (
            _priority_rank(
                item.get("Öncelik")
                or item.get("priority")
            ),
            float(
                item.get("Stok Gün Karşılığı")
                or item.get("stock_days")
                or 999999
            ),
            float(
                item.get("Satılan Adet")
                or item.get("sold_quantity")
                or 0
            ),
        ),
        reverse=True,
    )


def _build_budget_order_plan(
    suggestions: list[dict],
    budget_limit: float,
) -> tuple[list[dict], float]:
    selected: list[dict] = []
    used_budget = 0.0

    for item in _sort_order_suggestions(
        suggestions
    ):
        item_value = _order_value(item)

        if item_value <= 0:
            continue

        if used_budget + item_value <= budget_limit:
            selected.append(item)
            used_budget += item_value

    return selected, used_budget


def _extract_requested_limit(
    question: str | None,
    default: int = 10,
    maximum: int = 50,
) -> int:
    q = normalize_question(question)

    match = re.search(
        r"(?:ilk|top|en iyi|en güçlü|en guclu)\s+(\d{1,2})",
        q,
    )
    if not match:
        match = re.search(
            r"\b(\d{1,2})\s+(?:hasta|müşteri|musteri|doktor|hekim|ürün|ürünüm|ürünler|ilaç|ilac)\b",
            q,
        )

    if not match:
        match = re.search(r"\b(\d{1,2})\b", q)

    if not match:
        return default

    try:
        return max(1, min(int(match.group(1)), maximum))
    except (TypeError, ValueError):
        return default


def _numeric_value(item: dict, keys: list[str]) -> float:
    for key in keys:
        value = item.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return 0.0


def _sort_patients_for_value(patients: list[dict]) -> list[dict]:
    """
    Hasta kayıtlarını yalnızca analiz context'inde mevcut doğrulanmış
    sayısal alanlara göre sıralar. Öncelik ciro/harcama katkısıdır;
    eşitlikte işlem/reçete sıklığı kullanılır.
    """
    return sorted(
        patients,
        key=lambda item: (
            _numeric_value(
                item,
                [
                    "turnover",
                    "total_turnover",
                    "total_spend",
                    "total_sales",
                    "revenue",
                    "ciro",
                    "toplam_ciro",
                    "Toplam Ciro",
                ],
            ),
            _numeric_value(
                item,
                [
                    "transaction_count",
                    "prescription_count",
                    "purchase_count",
                    "visit_count",
                    "sales_count",
                    "işlem_sayısı",
                    "islem_sayisi",
                ],
            ),
        ),
        reverse=True,
    )



def _normalize_lookup_text(value: Any) -> str:
    """
    Hasta adı ve kullanıcı sorusunu karşılaştırmak için Türkçe karakter,
    noktalama ve boşluk farklarını normalize eder.
    """
    raw = str(value or "").strip().casefold()
    raw = unicodedata.normalize("NFKD", raw)
    raw = "".join(
        char
        for char in raw
        if not unicodedata.combining(char)
    )
    raw = raw.translate(
        str.maketrans(
            {
                "ı": "i",
                "ş": "s",
                "ğ": "g",
                "ü": "u",
                "ö": "o",
                "ç": "c",
            }
        )
    )
    raw = re.sub(r"[^a-z0-9]+", " ", raw)
    return " ".join(raw.split())


def _find_patient_matches(
    question: str | None,
    patients: list[dict],
) -> list[dict]:
    """
    Soru içinde geçen tam hasta adını arar.

    Öncelik:
    1) Tam adın sorunun içinde geçmesi
    2) Sorunun doğrudan hasta adına eşit olması
    3) En az iki kelimelik ad-soyad tokenlarının tamamının soruda bulunması

    Tek kelimelik kısmi eşleşme özellikle yapılmaz; yanlış hasta
    döndürme riskini azaltır.
    """
    q = _normalize_lookup_text(question)

    if not q:
        return []

    matches: list[tuple[int, int, dict]] = []

    for patient in patients:
        full_name = str(
            patient.get("patient_name_full")
            or patient.get("patient_name")
            or patient.get("customer_name")
            or patient.get("name")
            or ""
        ).strip()

        name_key = _normalize_lookup_text(full_name)

        if not name_key:
            continue

        name_tokens = [
            token
            for token in name_key.split()
            if len(token) >= 2
        ]

        score = 0

        if q == name_key:
            score = 100
        elif name_key in q:
            score = 90
        elif len(name_tokens) >= 2 and all(
            re.search(
                rf"(?<![a-z0-9]){re.escape(token)}(?![a-z0-9])",
                q,
            )
            for token in name_tokens
        ):
            score = 70 + min(len(name_tokens), 5)

        if score > 0:
            matches.append(
                (
                    score,
                    len(name_key),
                    patient,
                )
            )

    matches.sort(
        key=lambda item: (
            item[0],
            item[1],
            _numeric_value(
                item[2],
                ["visit_count", "transaction_count"],
            ),
        ),
        reverse=True,
    )

    return [
        item[2]
        for item in matches
    ]


def _patient_lookup_answer(
    question: str,
    context: dict,
) -> tuple[str, list[dict], str | None, bool]:
    """
    Hasta adı soruda geçiyorsa doğrulanmış hasta özetini döndürür.

    Returns:
        answer, items, action, handled
    """
    patient_context = _safe_dict(
        context.get("patient")
    )

    patients = _safe_list(
        patient_context.get("patient_lookup")
    ) or _safe_list(
        patient_context.get("patients")
    )

    matches = _find_patient_matches(
        question,
        patients,
    )

    if not matches:
        return "", [], None, False

    # Aynı normalize isimle birden fazla kayıt varsa yanlış kişiyi
    # seçmek yerine kullanıcıya birden fazla eşleşme olduğunu bildir.
    first_key = _normalize_lookup_text(
        matches[0].get("patient_name_full")
        or matches[0].get("patient_name")
    )

    same_name_matches = [
        row
        for row in matches
        if _normalize_lookup_text(
            row.get("patient_name_full")
            or row.get("patient_name")
        )
        == first_key
    ]

    if len(same_name_matches) > 1:
        display_name = (
            matches[0].get("patient_name_full")
            or matches[0].get("patient_name")
            or "Bu isim"
        )
        return (
            f"{display_name} adına birden fazla hasta kaydı eşleşiyor. "
            "Yanlış kişiyi göstermemek için daha ayırt edici bilgiyle arama yap.",
            same_name_matches[:10],
            None,
            True,
        )

    patient = matches[0]

    full_name = str(
        patient.get("patient_name_full")
        or patient.get("patient_name")
        or "Hasta"
    )

    visit_count = _numeric_value(
        patient,
        ["visit_count", "transaction_count"],
    )
    turnover = _numeric_value(
        patient,
        [
            "turnover",
            "total_turnover",
            "total_spend",
            "revenue",
        ],
    )
    last_visit = str(
        patient.get("last_visit")
        or "-"
    )
    segment = str(
        patient.get("segment")
        or "Belirlenemedi"
    )
    risk_level = str(
        patient.get("risk_level")
        or "Belirlenemedi"
    )

    answer = (
        f"{full_name} için doğrulanmış hasta özeti: "
        f"{int(round(visit_count))} ziyaret, "
        f"{_format_number(turnover, 2)} TL ciro, "
        f"son ziyaret {last_visit}, "
        f"segment {segment}, "
        f"kayıp riski {risk_level}."
    )

    action = None
    if risk_level.casefold() in {
        "yüksek",
        "kritik",
        "high",
        "critical",
    }:
        action = (
            "Bu hastanın son ziyaret tarihini ve geçmiş alışveriş "
            "örüntüsünü takip et."
        )

    return answer, [patient], action, True

def _product_list_answer(
    *,
    question: str,
    context: dict,
    source_key: str,
    intro: str,
    metric_key: str | None = None,
    metric_label: str | None = None,
    action: str | None = None,
) -> tuple[str, list[dict], str | None]:
    product = _safe_dict(
        context.get("product")
    )
    requested_limit = _extract_requested_limit(
        question,
        default=10,
        maximum=50,
    )
    rows = _safe_list(
        product.get(source_key)
    )
    items = rows[:requested_limit]

    if not items:
        return (
            "Bu ürün sıralaması için yeterli doğrulanmış ürün verisi bulunmuyor.",
            [],
            action,
        )

    answer = (
        f"Tabii, ürün verilerinizi inceledim. {intro} "
        f"İlk {len(items)} ürün listelendi."
    )

    first = items[0]
    first_name = str(
        first.get("product_name")
        or "Bilinmeyen ürün"
    )

    if metric_key and metric_label:
        metric_value = _numeric_value(
            first,
            [metric_key],
        )
        answer += (
            f" İlk sırada {first_name} var; "
            f"{metric_label} {_format_number(metric_value, 2)}."
        )
    else:
        answer += (
            f" İlk sırada {first_name} bulunuyor."
        )

    return answer, items, action


def create_deterministic_answer(
    question: str,
    analysis_result: dict | None,
) -> dict:
    context = build_copilot_context(
        question,
        analysis_result,
    )

    intent = context.get(
        "intent",
        "general",
    )
    sub_intent = detect_sub_intent(
        question,
        intent,
    )

    answer = ""
    items: list[dict] = []
    action = None

    patient_lookup_answer = ""
    patient_lookup_items: list[dict] = []
    patient_lookup_action = None
    patient_lookup_handled = False

    if intent in {"patient", "general"}:
        (
            patient_lookup_answer,
            patient_lookup_items,
            patient_lookup_action,
            patient_lookup_handled,
        ) = _patient_lookup_answer(
            question=question,
            context=context,
        )

    if patient_lookup_handled:
        intent = "patient"
        sub_intent = "patient_lookup"
        answer = patient_lookup_answer
        items = patient_lookup_items
        action = patient_lookup_action

    elif sub_intent == "list_vip_patients":
        patient = _safe_dict(
            context.get("patient")
        )
        patients = _safe_list(
            patient.get("vip_patients")
        )
        vip_count = patient.get(
            "vip_patient_count",
            len(patients),
        )

        if patients:
            items = patients[:20]
            answer = (
                f"Analizde {vip_count} VIP hasta bulunuyor. "
                f"İlk {min(len(patients), 20)} VIP hasta listelendi."
            )
        else:
            answer = (
                f"Analizde {vip_count or 0} VIP hasta görünüyor; "
                "ancak hasta bazlı VIP listesi analiz verisinde bulunmuyor."
            )

    elif sub_intent == "list_churn_patients":
        patient = _safe_dict(
            context.get("patient")
        )
        patients = _safe_list(
            patient.get("churn_risk_patients")
        )
        count = patient.get(
            "churn_risk_count",
            len(patients),
        )

        items = patients[:20]

        if patients:
            answer = (
                f"Kayıp riski taşıyan {count or len(patients)} hasta bulunuyor. "
                f"İlk {min(len(patients), 20)} kayıt listelendi."
            )
        else:
            answer = (
                f"Kayıp riski sayısı {count or 0}; "
                "hasta bazlı doğrulanmış risk listesi bulunmuyor."
            )

    elif sub_intent == "top_patients":
        patient = _safe_dict(
            context.get("patient")
        )
        patients = _safe_list(
            patient.get("patients")
        )
        requested_limit = _extract_requested_limit(
            question,
            default=10,
            maximum=50,
        )

        ranked_patients = _sort_patients_for_value(
            patients
        )
        items = ranked_patients[:requested_limit]

        if items:
            first = items[0]
            name = (
                first.get("patient_name")
                or first.get("customer_name")
                or first.get("name")
                or "Bilinmeyen hasta"
            )
            first_turnover = _numeric_value(
                first,
                [
                    "turnover",
                    "total_turnover",
                    "total_spend",
                    "total_sales",
                    "revenue",
                    "ciro",
                    "toplam_ciro",
                    "Toplam Ciro",
                ],
            )

            answer = (
                f"Tabii, hasta verilerinizi ciro katkısı ve işlem sıklığına göre "
                f"inceledim. İlk {len(items)} hasta listelendi. "
                f"Bu sıralamada ilk sırada {name} bulunuyor."
            )

            if first_turnover > 0:
                answer += (
                    f" Doğrulanmış ciro katkısı "
                    f"{_format_number(first_turnover, 2)} TL."
                )

            action = (
                "Bu hastaların son dönem alışveriş hareketlerini ve "
                "kayıp riskini birlikte takip et."
            )
        else:
            answer = (
                "En iyi hastaları sıralayabilmek için hasta bazlı "
                "doğrulanmış kayıt bulunmuyor."
            )

    elif sub_intent == "patient_summary":
        patient = _safe_dict(
            context.get("patient")
        )
        total_patient_count = patient.get(
            "total_patient_count",
            patient.get("active_patient_count", 0),
        )

        answer = (
            f"{total_patient_count} toplam hasta, "
            f"{patient.get('vip_patient_count', 0)} VIP hasta ve "
            f"{patient.get('churn_risk_count', 0)} kayıp riski taşıyan "
            "hasta bulunuyor."
        )

    elif sub_intent == "critical_products":
        inventory = _safe_dict(
            context.get("inventory")
        )
        products = _safe_list(
            inventory.get("stock_runout_products")
        )

        products = sorted(
            products,
            key=lambda item: (
                item.get("estimated_runout_days")
                if item.get("estimated_runout_days") is not None
                else float("inf")
            ),
        )

        items = products[:10]

        answer = (
            f"{inventory.get('critical_stock_count', 0)} ürün "
            "kritik stok seviyesinde."
        )

        if items:
            answer += (
                f" En hızlı bitecek ilk {len(items)} ürün listelendi."
            )

        action = (
            "En düşük stok günü olan ürünlerden başlayarak "
            "sipariş kontrolü yap."
        )

    elif sub_intent == "zero_stock":
        inventory = _safe_dict(
            context.get("inventory")
        )

        count = inventory.get(
            "zero_stock_count",
            0,
        )

        answer = (
            f"Analizde {count} ürünün stoğu sıfır görünüyor."
        )

        action = (
            "Satışı devam eden sıfır stok ürünlerini önce kontrol et."
        )

    elif sub_intent == "stock_summary":
        inventory = _safe_dict(
            context.get("inventory")
        )

        answer = (
            f"{inventory.get('critical_stock_count', 0)} kritik stok, "
            f"{inventory.get('zero_stock_count', 0)} sıfır stok, "
            f"{inventory.get('over_stock_count', 0)} fazla stok ve "
            f"{inventory.get('dead_stock_count', 0)} ölü stok ürünü bulunuyor."
        )

    elif sub_intent == "budget_order_plan":
        orders = _safe_dict(
            context.get("orders")
        )
        suggestions = _safe_list(
            orders.get("top_suggestions")
        )
        budget_limit = _extract_budget_limit(
            question
        ) or 0

        selected, used_budget = _build_budget_order_plan(
            suggestions,
            budget_limit,
        )
        items = selected[:50]

        answer = (
            f"{_format_number(budget_limit, 2)} TL bütçe sınırında "
            f"{len(selected)} sipariş önerisi seçilebiliyor. "
            f"Planlanan toplam harcama {_format_number(used_budget, 2)} TL."
        )

        if len(suggestions) >= 50:
            answer += (
                " Bu plan analizde dönen ilk 50 öncelikli öneri üzerinden "
                "hesaplandı."
            )

        action = (
            "Önce yüksek öncelikli ve stok günü düşük ürünleri sipariş et."
        )

    elif sub_intent == "order_budget":
        orders = _safe_dict(
            context.get("orders")
        )

        budget = orders.get(
            "estimated_order_budget",
            0,
        )
        count = orders.get(
            "suggestion_count",
            0,
        )

        answer = (
            f"Tahmini sipariş bütçesi "
            f"{_format_number(budget, 2)} TL. "
            f"{count} ürün için sipariş önerisi bulunuyor."
        )

        action = (
            "Siparişleri kritik stok ve satış hızına göre önceliklendir."
        )

    elif sub_intent in {
        "order_list",
        "order_summary",
    }:
        orders = _safe_dict(
            context.get("orders")
        )

        suggestions = _sort_order_suggestions(
            _safe_list(
                orders.get("top_suggestions")
            )
        )

        items = suggestions[:20]

        answer = (
            f"{orders.get('suggestion_count', len(suggestions))} "
            "ürün için sipariş önerisi bulunuyor."
        )

        if items:
            answer += (
                f" İlk {len(items)} öncelikli öneri listelendi."
            )

    elif sub_intent == "product_top_profit":
        answer, items, action = _product_list_answer(
            question=question,
            context=context,
            source_key="top_profit_products",
            intro="En çok kâr bırakan ürünleri kâr tutarına göre sıraladım.",
            metric_key="profit",
            metric_label="kârı",
            action=(
                "Yüksek kârlı ürünlerin stok seviyesini koru; "
                "kritik stok sinyali olanları siparişte öne al."
            ),
        )

    elif sub_intent == "product_top_turnover":
        answer, items, action = _product_list_answer(
            question=question,
            context=context,
            source_key="top_turnover_products",
            intro="En yüksek ciro üreten ürünleri sıraladım.",
            metric_key="turnover",
            metric_label="cirosu",
            action=(
                "Yüksek ciro üreten ürünlerin stok sürekliliğini yakından takip et."
            ),
        )

    elif sub_intent == "product_top_selling":
        answer, items, action = _product_list_answer(
            question=question,
            context=context,
            source_key="top_selling_products",
            intro="En çok satan ürünleri satış adedine göre sıraladım.",
            metric_key="quantity_sold",
            metric_label="satış adedi",
            action=(
                "Yüksek satış hızlı ürünlerde stok günü düşük olanları siparişte öne al."
            ),
        )

    elif sub_intent == "product_critical_high_demand":
        answer, items, action = _product_list_answer(
            question=question,
            context=context,
            source_key="critical_high_demand_products",
            intro="Satışı yüksek olup stok riski taşıyan ürünleri öne çıkardım.",
            metric_key="stock_days",
            metric_label="stok günü",
            action=(
                "Bu ürünleri satış hızı ve stok gününe göre öncelikli sipariş listesine al."
            ),
        )

    elif sub_intent == "product_capital_locked":
        product = _safe_dict(
            context.get("product")
        )
        requested_limit = _extract_requested_limit(
            question,
            default=10,
            maximum=50,
        )
        rows = _safe_list(
            product.get("dead_products")
        ) or _safe_list(
            product.get("capital_locked_products")
        )
        items = rows[:requested_limit]

        if items:
            first = items[0]
            answer = (
                "Ölü/hareketsiz stokta en fazla sermaye bağlayan ürünleri "
                f"stok değerine göre sıraladım. İlk {len(items)} ürün listelendi. "
                f"İlk sırada {first.get('product_name', 'Bilinmeyen ürün')} var; "
                f"stok değeri {_format_number(first.get('stock_value'), 2)} TL."
            )
        else:
            answer = (
                "Ölü/hareketsiz stokta bağlı sermayeyi sıralayacak "
                "yeterli doğrulanmış ürün verisi bulunmuyor."
            )

        action = (
            "Bu ürünlerde yeni siparişi durdur; iade, transfer veya stok eritme seçeneklerini değerlendir."
        )

    elif sub_intent == "product_low_margin":
        answer, items, action = _product_list_answer(
            question=question,
            context=context,
            source_key="low_margin_products",
            intro="Satış yapmasına rağmen marjı düşük ürünleri sıraladım.",
            metric_key="profit_margin",
            metric_label="kâr marjı %",
            action=(
                "Düşük marjlı ürünlerde alış maliyeti ve satış fiyatını gözden geçir."
            ),
        )

    elif sub_intent == "product_dead":
        answer, items, action = _product_list_answer(
            question=question,
            context=context,
            source_key="dead_products",
            intro="Ölü veya hareketsiz ürünleri bağlı stok değerine göre sıraladım.",
            metric_key="stock_value",
            metric_label="stok değeri",
            action=(
                "Bu ürünlerde yeni siparişi durdur ve stok eritme seçeneklerini değerlendir."
            ),
        )

    elif sub_intent == "product_summary":
        product = _safe_dict(
            context.get("product")
        )
        answer = (
            f"Product Intelligence kapsamında "
            f"{product.get('product_count', 0)} ürün analiz edildi. "
            "Satış, ciro, kâr, stok ve sipariş sinyalleri birlikte değerlendirilebilir."
        )

    elif sub_intent in {
        "finance_summary",
        "turnover",
        "profit",
    }:
        finance = _safe_dict(
            context.get("finance")
        )

        turnover = finance.get(
            "total_turnover",
            0,
        )
        profit = finance.get(
            "total_profit",
            0,
        )
        margin = finance.get(
            "profit_margin",
            0,
        )
        average_sale = finance.get(
            "average_sale",
            0,
        )
        transactions = finance.get(
            "transaction_count",
            0,
        )

        if sub_intent == "turnover":
            answer = (
                f"Analiz dönemindeki toplam ciro "
                f"{_format_number(turnover, 2)} TL."
            )

        elif sub_intent == "profit":
            answer = (
                f"Doğrulanmış toplam kâr "
                f"{_format_number(profit, 2)} TL, "
                f"kâr marjı %{_format_number(margin, 2)}."
            )

        else:
            answer = (
                f"Toplam ciro {_format_number(turnover, 2)} TL, "
                f"toplam kâr {_format_number(profit, 2)} TL ve "
                f"kâr marjı %{_format_number(margin, 2)}. "
                f"{transactions} işlemde ortalama satış "
                f"{_format_number(average_sale, 2)} TL."
            )

    elif sub_intent == "top_doctors":
        doctor = _safe_dict(
            context.get("doctor")
        )

        doctors = (
            _safe_list(
                doctor.get("top_doctors")
            )
            or _safe_list(
                doctor.get("doctors")
            )
        )

        requested_limit = _extract_requested_limit(
            question,
            default=10,
            maximum=50,
        )
        items = doctors[:requested_limit]

        if items:
            first = items[0]
            name = first.get(
                "doctor_name",
                "Bilinmeyen doktor",
            )
            turnover = first.get(
                "turnover"
            )

            answer = (
                f"Analiz verisine göre en güçlü doktor {name}."
            )

            if turnover is not None:
                answer += (
                    f" Ciro katkısı {_format_number(turnover, 2)} TL."
                )

            answer += (
                f" İlk {len(items)} doktor listelendi."
            )
        else:
            answer = (
                "Doktor bazlı sıralama yapacak yeterli "
                "doğrulanmış veri bulunmuyor."
            )

    elif sub_intent == "doctor_summary":
        doctor = _safe_dict(
            context.get("doctor")
        )

        answer = (
            f"Analizde {doctor.get('doctor_count', 0)} doktor kaydı bulunuyor."
        )

    elif sub_intent == "dead_stock":
        risk = _safe_dict(
            context.get("risk")
        )

        answer = (
            f"{risk.get('dead_stock_count', 0)} üründe "
            f"ölü stok tespit edildi. "
            f"Bu stoklarda yaklaşık "
            f"{_format_number(risk.get('dead_stock_value'), 2)} TL "
            "sermaye bağlı."
        )

        items = [
            item
            for item in _safe_list(
                risk.get("risk_products")
            )
            if item.get("risk_type") == "Ölü Stok"
        ][:20]

    elif sub_intent == "over_stock":
        risk = _safe_dict(
            context.get("risk")
        )

        answer = (
            f"{risk.get('over_stock_count', 0)} üründe "
            "fazla stok sinyali bulunuyor."
        )

        items = [
            item
            for item in _safe_list(
                risk.get("risk_products")
            )
            if item.get("risk_type") == "Fazla Stok"
        ][:20]

    elif sub_intent == "expiry_risk":
        expiry = _safe_dict(
            context.get("expiry")
        )

        answer = (
            f"{expiry.get('expired_count', 0)} ürünün miadı geçmiş, "
            f"{expiry.get('warning_count', 0)} ürün ise "
            "miad uyarı penceresinde."
        )

        items = _safe_list(
            expiry.get("products")
        )[:20]

    elif sub_intent == "risk_summary":
        risk = _safe_dict(
            context.get("risk")
        )

        answer = (
            f"Risk skoru %{_format_number(risk.get('risk_score'), 2)}. "
            f"{risk.get('zero_stock_count', 0)} sıfır stok, "
            f"{risk.get('critical_stock_count', 0)} kritik stok, "
            f"{risk.get('dead_stock_count', 0)} ölü stok ve "
            f"{risk.get('over_stock_count', 0)} fazla stok ürünü bulunuyor."
        )

    else:
        decision = _safe_dict(
            context.get("decision")
        )
        briefing = _safe_dict(
            context.get("briefing")
        )

        if decision:
            answer = (
                f"Bugünün önceliği: "
                f"{decision.get('priority', 'Belirlenemedi')}. "
                f"{decision.get('recommended_action', '')}"
            ).strip()

            action = decision.get(
                "recommended_action"
            )

        elif briefing:
            answer = str(
                briefing.get(
                    "result",
                    "Analiz sonucu mevcut.",
                )
            )

            actions = _safe_list(
                briefing.get("top_actions")
            )

            if actions:
                action = actions[0]

        else:
            answer = (
                "Bu soruyu yanıtlamak için yeterli "
                "doğrulanmış analiz verisi bulunmuyor."
            )

    return {
        "success": True,
        "intent": intent,
        "sub_intent": sub_intent,
        "answer": answer,
        "items": items,
        "recommended_action": action,
        "source": "code_intelligence",
        "llm_used": False,
        "confidence_score": context.get(
            "analysis_confidence_score",
            0,
        ),
    }