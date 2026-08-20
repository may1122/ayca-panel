from io import BytesIO

import pandas as pd


def _records(value):
    return value if isinstance(value, list) else []


def create_analysis_report(
    inventory_metrics,
    finance_metrics,
    order_suggestions,
    risk_metrics,
    expiry_metrics,
    morning_briefing,
):
    output = BytesIO()

    summary_rows = [
        ["AYÇA Skoru", morning_briefing.get("score") if morning_briefing else None],
        ["Risk Skoru", risk_metrics.get("risk_score")],
        ["Kritik Stok", risk_metrics.get("critical_stock_count")],
        ["Sıfır Stok", risk_metrics.get("zero_stock_count")],
        ["Fazla Stok", risk_metrics.get("over_stock_count")],
        ["Ölü Stok", risk_metrics.get("dead_stock_count")],
        ["Ölü Stok Değeri", risk_metrics.get("dead_stock_value")],
        ["Miad Uyarısı", expiry_metrics.get("warning_count")],
        ["Miadı Geçmiş", expiry_metrics.get("expired_count")],
        ["Toplam Ciro", finance_metrics.get("total_turnover")],
        ["Toplam Kâr", finance_metrics.get("total_profit")],
        ["Kâr Marjı %", finance_metrics.get("profit_margin")],
        ["Sipariş Önerisi", order_suggestions.get("suggestion_count")],
        ["Sipariş Bütçesi", order_suggestions.get("estimated_order_budget")],
    ]

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame(summary_rows, columns=["Gösterge", "Değer"]).to_excel(
            writer, sheet_name="Yonetici_Ozeti", index=False
        )
        pd.DataFrame(_records(order_suggestions.get("top_suggestions"))).to_excel(
            writer, sheet_name="Siparis_Onerisi", index=False
        )
        pd.DataFrame(_records(risk_metrics.get("risk_products"))).to_excel(
            writer, sheet_name="Riskler", index=False
        )
        pd.DataFrame(_records(risk_metrics.get("stock_runout_products"))).to_excel(
            writer, sheet_name="Stok_Bitis", index=False
        )
        pd.DataFrame(_records(risk_metrics.get("dead_stock_products"))).to_excel(
            writer, sheet_name="Olu_Stok", index=False
        )
        pd.DataFrame(_records(expiry_metrics.get("products"))).to_excel(
            writer, sheet_name="Miad_Takibi", index=False
        )
        pd.DataFrame(_records(finance_metrics.get("daily_revenue"))).to_excel(
            writer, sheet_name="Gunluk_Ciro", index=False
        )
        pd.DataFrame(_records(finance_metrics.get("top_products"))).to_excel(
            writer, sheet_name="Urun_Performansi", index=False
        )

    output.seek(0)
    return output.getvalue()
