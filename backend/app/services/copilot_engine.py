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
    "Selamlaşma ve nasılsın gibi temel sohbet mesajlarına kısa ve doğal cevap verebilirsin.",
    "Operasyonel, finansal, ürün, hasta veya doktor sorularında yalnızca sağlanan context içindeki doğrulanmış verilere dayan.",
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



SMALL_TALK_RESPONSES = {
    "nasilsin": "İyiyim, teşekkür ederim. Eczanenizin verileriyle ilgili neye bakalım?",
    "naber": "İyiyim 🙂 Hazırım. İsterseniz stok, finans, hasta veya sipariş tarafına bakalım.",
    "selam": "Merhaba 👋 Nasıl yardımcı olabilirim?",
    "merhaba": "Merhaba 👋 Nasıl yardımcı olabilirim?",
    "gunaydin": "Günaydın 👋 Bugün eczanenizde neye bakalım?",
    "iyi aksamlar": "İyi akşamlar 👋 Nasıl yardımcı olabilirim?",
    "tesekkur": "Rica ederim 🙂",
    "sag ol": "Rica ederim 🙂",
}



def _strip_active_screen_prefix(question: str | None) -> str:
    """
    Frontend drawer, aktif ekran bilgisini sorunun başına ekleyebilir:
    [Aktif ekran: 🏠 Dashboard] Kaç VIP hastam var?

    Bu metadata kullanıcı sorusunun bir parçası değildir ve özellikle
    çoklu-soru algılamasını yanlış tetiklememelidir.
    """
    raw = str(question or "").strip()
    return re.sub(
        r"^\s*\[Aktif ekran:[^\]]+\]\s*",
        "",
        raw,
        flags=re.IGNORECASE,
    ).strip()

def _normalize_small_talk(value: str | None) -> str:
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
    raw = re.sub(r"[^a-z0-9\s]+", " ", raw)
    return " ".join(raw.split())


def _small_talk_answer(question: str | None) -> str | None:
    q = _normalize_small_talk(_strip_active_screen_prefix(question))
    if not q:
        return None

    # Do not treat a long operational question containing "selam" as small talk.
    if len(q.split()) > 8:
        return None

    for key, answer in SMALL_TALK_RESPONSES.items():
        if q == key or q.startswith(f"{key} ") or key in q:
            return answer

    return None

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
        ) or patient_rows

        context["patient"] = {
            "total_patient_count": patient.get(
                "total_patient_count",
                patient.get(
                    "active_patient_count",
                    len(patient_lookup_rows),
                ),
            ),
            # Geriye uyumluluk
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

    # Hasta devam sorularında genel product/doctor intent'ine kaymayı engelle.
    if _looks_like_patient_followup(question):
        intent = "patient"

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

        if score:
            matches.append((score, len(name_key), patient))

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

    return [item[2] for item in matches]



PATIENT_FOLLOWUP_PHRASES = [
    "en son ne zaman",
    "son ne zaman",
    "son ziyaret",
    "kaç kere",
    "kac kere",
    "kaç kez",
    "kac kez",
    "kaç defa",
    "kac defa",
    "toplam ne kadar",
    "ne kadar alışveriş",
    "ne kadar alisveris",
    "cirosu",
    "harcama",
    "risk neden",
    "kayıp riski neden",
    "kayip riski neden",
    "hangi doktor",
    "hangi hekim",
    "doktorlardan",
    "hekimlerden",
    "hangi ilaç",
    "hangi ilac",
    "hangi ürün",
    "hangi urun",
    "son aldığı",
    "son aldigi",
    "geri kazan",
    "geri get",
    "yeniden gelsin",
]


def _looks_like_patient_followup(question: str | None) -> bool:
    q = normalize_question(question)
    return any(phrase in q for phrase in PATIENT_FOLLOWUP_PHRASES)


def _split_multi_question(question: str | None) -> list[str]:
    """
    Bir mesaj içindeki birden fazla kısa soruyu güvenli biçimde ayırır.
    Noktalı virgül, soru işareti ve ardışık hasta-soru kalıplarını destekler.
    """
    raw = _strip_active_screen_prefix(question)
    if not raw:
        return []

    # Önce klasik ayraçlar.
    parts = re.split(r"\?+|;+\s*|\n+", raw)
    parts = [" ".join(part.strip().split()) for part in parts if part.strip()]

    # Tek parça kaldıysa aynı mesaj içinde arka arkaya gelen soru başlangıçlarını böl.
    if len(parts) == 1:
        markers = [
            " en son ",
            " kaç ",
            " kac ",
            " toplam ",
            " kayıp riski ",
            " kayip riski ",
            " hangi doktor",
            " hangi hekim",
            " hangi ilaç",
            " hangi ilac",
            " hangi ürün",
            " hangi urun",
            " geri kazan",
            " ne yapmalıyım",
            " ne yapmaliyim",
        ]

        lowered = f" {normalize_question(raw)} "
        split_points: list[int] = []

        for marker in markers:
            start = 0
            while True:
                index = lowered.find(marker, start)
                if index < 0:
                    break
                if index > 1:
                    split_points.append(index - 1)
                start = index + len(marker)

        split_points = sorted(set(split_points))
        if split_points:
            raw_parts = []
            last = 0
            for point in split_points:
                candidate = raw[last:point].strip(" ,.-")
                if candidate:
                    raw_parts.append(candidate)
                last = point
            candidate = raw[last:].strip(" ,.-")
            if candidate:
                raw_parts.append(candidate)

            if len(raw_parts) > 1:
                parts = raw_parts

    return parts[:6]


def _contains_multiple_questions(question: str | None) -> bool:
    """
    MVP güvenlik kuralı.

    Çoklu soru algısını bilinçli olarak muhafazakâr tutuyoruz:
    - 2+ soru işareti
    - veya noktalı virgül / satır sonuyla ayrılmış 2+ soru cümlesi

    "Sümeyra Yılmaz en son ne zaman geldi?" gibi tek hasta soruları,
    içlerinde "en son", "kaç", "hangi" geçtiği için yanlışlıkla çoklu
    soru sayılmaz.
    """
    raw = _strip_active_screen_prefix(question)
    if not raw:
        return False

    if raw.count("?") >= 2:
        return True

    if ";" in raw or "\n" in raw:
        parts = [
            part.strip()
            for part in re.split(r";+|\n+", raw)
            if part.strip()
        ]
        question_like_parts = [
            part
            for part in parts
            if (
                "?" in part
                or any(
                    token in normalize_question(part)
                    for token in [
                        " ne ",
                        " nasıl ",
                        " nasil ",
                        " kaç ",
                        " kac ",
                        " hangi ",
                        " neden ",
                        " kim ",
                    ]
                )
            )
        ]
        return len(question_like_parts) >= 2

    return False

def _patient_question_kind(question: str | None) -> str:
    q = normalize_question(question)

    if any(
        phrase in q
        for phrase in [
            "en son ne zaman",
            "son ne zaman",
            "son ziyaret",
            "en son geldi",
            "ne zaman geldi",
        ]
    ):
        return "last_visit"

    if any(
        phrase in q
        for phrase in [
            "kaç kere",
            "kac kere",
            "kaç kez",
            "kac kez",
            "kaç defa",
            "kac defa",
            "ziyaret say",
        ]
    ):
        return "visit_count"

    if any(
        phrase in q
        for phrase in [
            "ne kadar alışveriş",
            "ne kadar alisveris",
            "toplam ne kadar",
            "toplam ciro",
            "cirosu",
            "harcama",
        ]
    ):
        return "turnover"

    if any(
        phrase in q
        for phrase in [
            "neden orta",
            "neden yüksek",
            "neden yuksek",
            "neden kritik",
            "risk neden",
            "kayıp riski neden",
            "kayip riski neden",
        ]
    ):
        return "risk_reason"

    if any(
        phrase in q
        for phrase in [
            "hangi doktor",
            "hangi hekim",
            "doktorlardan",
            "hekimlerden",
        ]
    ):
        return "doctor_history"

    if any(
        phrase in q
        for phrase in [
            "son aldığı ilaç",
            "son aldigi ilac",
            "son aldığı ürün",
            "son aldigi urun",
            "hangi ilaçları",
            "hangi ilaclari",
            "hangi ürünleri",
            "hangi urunleri",
        ]
    ):
        return "recent_products"

    if any(
        phrase in q
        for phrase in [
            "geri kazan",
            "geri get",
            "yeniden gelsin",
            "ne yapmalıyım",
            "ne yapmaliyim",
        ]
    ):
        return "recovery_action"

    return "unknown"



def _patient_display_name(patient: dict) -> str:
    return str(
        patient.get("patient_name_full")
        or patient.get("patient_name")
        or "Hasta"
    ).strip()


def _patient_compact_fact_line(patient: dict) -> str:
    name = _patient_display_name(patient)
    visit_count = int(round(_numeric_value(
        patient,
        ["visit_count", "transaction_count"],
    )))
    turnover = _numeric_value(
        patient,
        ["turnover", "total_turnover", "total_spend", "revenue"],
    )
    last_visit = str(patient.get("last_visit") or "-")
    segment = str(patient.get("segment") or "Belirlenemedi")
    risk_level = str(patient.get("risk_level") or "Belirlenemedi")

    return (
        f"{name}: {visit_count} ziyaret, "
        f"{_format_number(turnover, 2)} TL ciro, "
        f"son ziyaret {last_visit}, "
        f"{segment} segmenti, {risk_level} risk."
    )

def _patient_lookup_answer(
    question: str,
    context: dict,
) -> tuple[str, list[dict], str | None, bool]:
    patient_context = _safe_dict(context.get("patient"))

    patients = _safe_list(
        patient_context.get("patient_lookup")
    ) or _safe_list(
        patient_context.get("patients")
    )

    matches = _find_patient_matches(question, patients)
    if not matches:
        return "", [], None, False

    patient = matches[0]
    full_name = _patient_display_name(patient)

    # Tek bir doğal hasta sorusunu ("Sümeyra Yılmaz en son ne zaman geldi?")
    # isim + soru diye parçalama. Parçalama yalnızca gerçekten çoklu soruysa yapılır.
    if _contains_multiple_questions(question):
        question_parts = _split_multi_question(question) or [question]
    else:
        question_parts = [_strip_active_screen_prefix(question)]

    normalized_question = _normalize_lookup_text(
        _strip_active_screen_prefix(question)
    )
    normalized_name = _normalize_lookup_text(full_name)

    # Sadece hasta adı yazıldıysa genel hasta özeti güvenlidir.
    if (
        len(question_parts) == 1
        and normalized_question == normalized_name
    ):
        return (
            _patient_compact_fact_line(patient),
            [patient],
            None,
            True,
        )

    # Aynı mesajda çok soru varsa hepsini aynı hasta üzerinden cevapla.
    if len(question_parts) > 1:
        answers: list[str] = []
        combined_items: list[dict] = []
        combined_action = None

        for part in question_parts:
            kind = _patient_question_kind(part)

            if kind == "unknown":
                answers.append(
                    f"“{part.strip()}” sorusunu mevcut hasta verisinden "
                    "güvenilir şekilde cevaplayamıyorum."
                )
                continue

            part_answer, part_items, part_action = _answer_patient_kind(
                patient=patient,
                kind=kind,
            )

            if part_answer:
                answers.append(part_answer)

            for item in part_items:
                if item not in combined_items:
                    combined_items.append(item)

            if part_action:
                combined_action = part_action

        if answers:
            return (
                f"{full_name} için:\n- " + "\n- ".join(answers),
                combined_items[:20] or [patient],
                combined_action,
                True,
            )

    kind = _patient_question_kind(question)

    if kind == "unknown":
        return (
            f"{full_name} için bu soruyu mevcut hasta verisinden "
            "güvenilir şekilde cevaplayamıyorum.",
            [patient],
            None,
            True,
        )

    answer, items, action = _answer_patient_kind(
        patient=patient,
        kind=kind,
    )

    return answer, items, action, True


def _answer_patient_kind(
    patient: dict,
    kind: str,
) -> tuple[str, list[dict], str | None]:
    full_name = _patient_display_name(patient)

    visit_count = int(round(_numeric_value(
        patient,
        ["visit_count", "transaction_count"],
    )))
    turnover = _numeric_value(
        patient,
        [
            "turnover",
            "total_turnover",
            "total_spend",
            "revenue",
        ],
    )
    last_visit = str(patient.get("last_visit") or "-")
    segment = str(patient.get("segment") or "Belirlenemedi")
    risk_level = str(patient.get("risk_level") or "Belirlenemedi")
    risk_reason = str(patient.get("risk_reason") or "").strip()

    if kind == "last_visit":
        return (
            f"En son {last_visit} tarihinde gelmiş.",
            [patient],
            None,
        )

    if kind == "visit_count":
        return (
            f"Analiz döneminde {visit_count} kez gelmiş.",
            [patient],
            None,
        )

    if kind == "turnover":
        return (
            f"Toplam alışveriş/ciro katkısı {_format_number(turnover, 2)} TL.",
            [patient],
            None,
        )

    if kind == "risk_reason":
        if risk_reason:
            return (
                f"Kayıp riski {risk_level}. {risk_reason}",
                [patient],
                None,
            )

        return (
            f"Kayıp riski {risk_level}; ancak kaynak veride daha ayrıntılı "
            "bir risk gerekçesi bulunmuyor.",
            [patient],
            None,
        )

    if kind == "doctor_history":
        doctors = _safe_list(patient.get("doctor_history"))
        if not doctors:
            return (
                "Bu hasta için doğrulanmış doktor geçmişi kaynak veride bulunmuyor.",
                [patient],
                None,
            )

        doctor_names = [
            str(item.get("doctor_name") or "Bilinmeyen doktor")
            for item in doctors[:5]
        ]

        return (
            "İlişkili doktorlar: " + ", ".join(doctor_names) + ".",
            doctors[:10],
            None,
        )

    if kind == "recent_products":
        products = _safe_list(patient.get("recent_products"))
        if not products:
            return (
                "Son aldığı ürün/ilaç bilgisi kaynak veride bulunmuyor.",
                [patient],
                None,
            )

        product_names = [
            str(item.get("product_name") or "Bilinmeyen ürün")
            for item in products[:5]
        ]

        return (
            "Son aldığı ürünlerden öne çıkanlar: "
            + ", ".join(product_names)
            + ".",
            products[:10],
            None,
        )

    if kind == "recovery_action":
        if risk_level.casefold() in {"kritik", "yüksek", "high", "critical"}:
            action = (
                "Son ziyaret aralığını ve geçmiş alışveriş düzenini kontrol et; "
                "uygun bir hatırlatma veya ihtiyaç kontrolü planla."
            )
        elif risk_level.casefold() in {"orta", "medium"}:
            action = (
                "Hasta normal ziyaret ritmini aşmaya başladıysa nazik bir "
                "hatırlatma veya ihtiyaç kontrolü planla."
            )
        else:
            action = (
                "Şu an güçlü bir kayıp sinyali yok; ziyaret düzenini takip etmeye devam et."
            )

        prefix = f"{risk_reason} " if risk_reason else ""
        return (
            f"{prefix}Önerim: {action}",
            [patient],
            action,
        )

    return (
        f"{full_name} için bu soruyu mevcut hasta verisinden "
        "güvenilir şekilde cevaplayamıyorum.",
        [patient],
        None,
    )


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



def _is_supported_domain_question(question: str | None) -> bool:
    """
    AYÇA'nın deterministik olarak cevaplaması güvenli olan alanları ayırır.
    Bilinmeyen/domain-dışı bir soru general_summary'ye düşüp stok/finans
    cevabı üretmemelidir.
    """
    q = _strip_active_screen_prefix(question)
    normalized = normalize_question(q)
    if not normalized:
        return False

    detected = detect_intent(q)
    if detected.get("score", 0) > 0:
        return True

    operational_phrases = [
        "bugün ne yapmalıyım",
        "bugun ne yapmaliyim",
        "önceliğim ne",
        "onceligim ne",
        "öncelik ne",
        "oncelik ne",
        "eczane durumu",
        "genel durum",
        "özet",
        "ozet",
        "analiz",
        "aksiyon",
    ]
    return any(phrase in normalized for phrase in operational_phrases)


def _out_of_domain_answer(question: str | None) -> dict:
    return {
        "success": True,
        "intent": "out_of_domain",
        "sub_intent": "out_of_domain",
        "answer": (
            "Bu konu AYÇA Insight'ın eczane analiz kapsamının dışında. "
            "Stok, finans, sipariş, ürün, hasta, doktor veya risk verileriyle "
            "ilgili yardımcı olabilirim."
        ),
        "items": [],
        "recommended_action": None,
        "context": {
            "question": question,
            "intent": "out_of_domain",
        },
        "validation": {
            "valid": True,
            "warnings": [],
            "analysis_confidence_score": 100,
            "available_fact_count": 0,
        },
    }


def create_deterministic_answer(
    question: str,
    analysis_result: dict | None,
) -> dict:
    small_talk = _small_talk_answer(question)
    if small_talk:
        return {
            "success": True,
            "intent": "small_talk",
            "sub_intent": "small_talk",
            "answer": small_talk,
            "items": [],
            "recommended_action": None,
            "context": {
                "question": question,
                "intent": "small_talk",
            },
            "validation": {
                "valid": True,
                "warnings": [],
                "analysis_confidence_score": 100,
                "available_fact_count": 0,
            },
        }

    if _contains_multiple_questions(question):
        return {
            "success": True,
            "intent": "general",
            "sub_intent": "multi_question_guard",
            "answer": (
                "Aynı mesajda birden fazla soru var. "
                "Yanlış veya karışık cevap vermemek için soruları tek tek sorabilir misiniz?"
            ),
            "items": [],
            "recommended_action": None,
            "context": {
                "question": question,
                "intent": "general",
            },
            "validation": {
                "valid": True,
                "warnings": [],
                "analysis_confidence_score": 100,
                "available_fact_count": 0,
            },
        }

    # Domain dışı sorular general_summary'ye düşmemeli.
    # Hasta adı/follow-up eşleşmesi aşağıdaki patient routing tarafından ele alınır;
    # burada yalnızca açıkça desteklenmeyen soruları kesiyoruz.
    analysis_for_domain = _safe_dict(analysis_result)
    patient_for_domain = _safe_dict(analysis_for_domain.get("patient_metrics"))
    patient_rows_for_domain = (
        _safe_list(patient_for_domain.get("patient_lookup"))
        or _safe_list(patient_for_domain.get("patients"))
    )
    has_patient_match = bool(
        _find_patient_matches(question, patient_rows_for_domain)
    )

    # Aktif hasta adı frontend tarafından soruya/context'e eklenmiş olsa bile
    # "hava nasıl" gibi domain dışı bir mesaj hasta sorusuna dönüşmemeli.
    # Hasta eşleşmesi tek başına domain desteği değildir; hasta adı tek başına
    # yazılmışsa veya gerçek bir hasta follow-up kalıbı varsa izin verilir.
    clean_question_for_domain = _strip_active_screen_prefix(question)
    clean_lookup_for_domain = _normalize_lookup_text(clean_question_for_domain)
    matched_name_keys_for_domain = {
        _normalize_lookup_text(_patient_display_name(row))
        for row in patient_rows_for_domain
        if _patient_display_name(row)
    }
    is_patient_name_only = clean_lookup_for_domain in matched_name_keys_for_domain

    if (
        not _is_supported_domain_question(clean_question_for_domain)
        and not _looks_like_patient_followup(clean_question_for_domain)
        and not is_patient_name_only
    ):
        return _out_of_domain_answer(clean_question_for_domain)

    context = build_copilot_context(
        question,
        analysis_result,
    )

    intent = context.get(
        "intent",
        "general",
    )

    # Hasta lookup / follow-up varsa intent routing'den önce hasta alanını önceliklendir.
    # Frontend aktif hastayı soruya eklediği için isim eşleşmesi burada deterministik olur.
    patient_context_for_routing = _safe_dict(context.get("patient"))
    patient_lookup_for_routing = _safe_list(
        patient_context_for_routing.get("patient_lookup")
    ) or _safe_list(
        patient_context_for_routing.get("patients")
    )
    patient_matches_for_routing = _find_patient_matches(
        question,
        patient_lookup_for_routing,
    )

    if patient_matches_for_routing and (
        _looks_like_patient_followup(question)
        or "hasta" in normalize_question(question)
        or intent in {"patient", "doctor", "product", "general"}
    ):
        intent = "patient"
        context["intent"] = "patient"
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
        sub_intent = f"patient_lookup_{_patient_question_kind(question)}"
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
            f"Analizde {total_patient_count} benzersiz hasta bulunuyor. "
            f"Bunların {patient.get('vip_patient_count', 0)} tanesi VIP segmentinde; "
            f"{patient.get('churn_risk_count', 0)} hastada kayıp riski sinyali var."
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