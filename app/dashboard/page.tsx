"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Company = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  package_name: string | null;
  subscription_ends_at: string | null;
};

type DashboardMetrics = {
  risk_score: number | null;
  critical_stock_count: number | null;
  estimated_lost_profit: number | null;
  estimated_order_amount: number | null;
  estimated_order_budget?: number | null;
  ai_suggestion_count: number | null;
};

type OrderSuggestion = {
  "Ürün Adı": string;
  Stok: number;
  "Satılan Adet": number;
  "Hedef Stok": number;
  "Önerilen Sipariş": number;
  "Tahmini Sipariş Tutarı": number;
  "Öncelik": string;
};

type AnalyzeResult = {
  success: boolean;
  dashboard_metrics?: DashboardMetrics[] | DashboardMetrics | null;
  order_suggestions?: {
    success: boolean;
    top_suggestions?: OrderSuggestion[];
    estimated_order_budget?: number;
    suggestion_count?: number;
  };
  risk_metrics?: {
    over_stock_count?: number;
    zero_stock_count?: number;
    critical_stock_count?: number;
    risk_score?: number;
  };
};

const API_URL =
  "https://congenial-trout-g7965j94493jwg-8000.app.github.dev/analyze/";

const modules = [
  "🏠 Dashboard",
  "☀️ Sabah Brifingi",
  "📦 Operasyon Merkezi",
  "💰 Finans Merkezi",
  "🚨 Risk Merkezi",
  "👥 Hasta & Reçete Merkezi",
  "🤖 AYÇA Copilot",
  "📊 Raporlar",
];

export default function DashboardPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [email, setEmail] = useState("");
  const [activeModule, setActiveModule] = useState("🏠 Dashboard");

  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setEmail(userData.user.email ?? "");
      setUserId(userData.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userData.user.id)
        .single();

      if (profile?.company_id) {
        setCompanyId(profile.company_id);

        const { data: companyData } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profile.company_id)
          .single();

        setCompany(companyData);

        const { data: metricsData } = await supabase
          .from("dashboard_metrics")
          .select("*")
          .eq("company_id", profile.company_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        setMetrics(metricsData);
      }
    }

    loadDashboard();
  }, []);

  async function uploadFile(
    file: File | null,
    fileType: "inventory" | "sales" | "product"
  ) {
    if (!file || !companyId || !userId) {
      alert("Dosya veya kullanıcı bilgisi eksik.");
      return false;
    }

    const safeFileName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const filePath = `${companyId}/${fileType}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("pharmacy-files")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      alert("Dosya yüklenirken hata oluştu.");
      return false;
    }

    const { error: dbError } = await supabase.from("file_uploads").insert({
      company_id: companyId,
      user_id: userId,
      file_type: fileType,
      file_name: file.name,
      storage_path: filePath,
      upload_status: "uploaded",
    });

    if (dbError) {
      console.error("Database error raw:", dbError);
      console.error("Database error json:", JSON.stringify(dbError, null, 2));
      alert("Dosya yüklendi ama kayıt oluşturulamadı.");
      return false;
    }

    return true;
  }

  async function startAnalysis() {
    try {
      setIsAnalyzing(true);

      if (inventoryFile) {
        const ok = await uploadFile(inventoryFile, "inventory");
        if (!ok) return;
      }

      if (salesFile) {
        const ok = await uploadFile(salesFile, "sales");
        if (!ok) return;
      }

      if (productFile) {
        const ok = await uploadFile(productFile, "product");
        if (!ok) return;
      }

      const response = await fetch(API_URL, {
        method: "POST",
      });

      const result: AnalyzeResult = await response.json();

      console.log("Analyze result:", result);

      if (!response.ok || !result.success) {
        alert("Analiz sırasında hata oluştu.");
        return;
      }

      setAnalyzeResult(result);

      const latestMetrics = Array.isArray(result.dashboard_metrics)
        ? result.dashboard_metrics[0]
        : result.dashboard_metrics;

      if (latestMetrics) {
        setMetrics(latestMetrics);
      }

      alert("Analiz tamamlandı.");
    } catch (error) {
      console.error("Analyze error:", error);
      alert("Analiz başlatılırken hata oluştu.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const estimatedOrderAmount =
    metrics?.estimated_order_budget ?? metrics?.estimated_order_amount;

  const orderSuggestions =
    analyzeResult?.order_suggestions?.top_suggestions ?? [];

  const overStockCount =
    analyzeResult?.risk_metrics?.over_stock_count ?? null;

  const healthScore = Math.max(
    0,
    Math.round(
      100 -
        (metrics?.risk_score ?? 0) * 15 -
        (metrics?.critical_stock_count ?? 0) * 2 -
        (overStockCount ?? 0) * 0.5
    )
  );

  const healthStatus =
    healthScore >= 90
      ? "🟢 Sağlıklı"
      : healthScore >= 75
      ? "🟡 Dikkat"
      : "🔴 Riskli";

  return (
    <main className="insight-page">
      <aside className="insight-sidebar">
        <div className="insight-logo">AYÇA Insight</div>
        <p className="sidebar-subtitle">Eczane Yönetim Zekâsı</p>

        <nav>
          {modules.map((item) => (
            <button
              key={item}
              className={activeModule === item ? "active" : ""}
              onClick={() => setActiveModule(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <button className="logout-btn" onClick={logout}>
          Çıkış Yap
        </button>
      </aside>

      <section className="insight-content">
        <header className="insight-header">
          <div>
            <span className="eyebrow">AYÇA Insight Platform</span>
            <h1>Günaydın, Abdullah 👋</h1>
            <p>
              {company?.name ?? "İdil Eczanesi"} · {email}
            </p>
          </div>

          <div className="header-actions">
            <select>
              <option>Son 30 Gün</option>
              <option>Son 90 Gün</option>
              <option>Bu Yıl</option>
            </select>
            <span className="avatar">A</span>
          </div>
        </header>

        <section className="module-tabs">
          {modules.map((item) => (
            <button
              key={item}
              className={activeModule === item ? "active" : ""}
              onClick={() => setActiveModule(item)}
            >
              {item}
            </button>
          ))}
        </section>

        <section className="active-module-title">
          <h2>{activeModule}</h2>
          <p>
            {activeModule === "🏠 Dashboard"
              ? "Eczanenizin genel sağlık durumu, veri yükleme ve son analiz özeti."
              : activeModule === "☀️ Sabah Brifingi"
              ? "Günün başlangıcında eczanenizin hızlı karar özetini görün."
              : "Bu modül Sprint 3 içinde adım adım aktif hale getirilecek."}
          </p>
        </section>

        {activeModule === "🏠 Dashboard" && (
          <>
            <section className="insight-kpi-grid">
              <div className="insight-kpi">
                <span>Risk Skoru</span>
                <strong>{metrics?.risk_score ?? "-"}</strong>
                <p>{metrics ? "Son analiz sonucu" : "Henüz analiz yapılmadı"}</p>
              </div>

              <div className="insight-kpi">
                <span>Kritik Stok</span>
                <strong>{metrics?.critical_stock_count ?? "-"}</strong>
                <p>{metrics ? "Kritik stoktaki ürün sayısı" : "Henüz analiz yapılmadı"}</p>
              </div>

              <div className="insight-kpi">
                <span>Tahmini Kayıp Kâr</span>
                <strong>
                  {metrics?.estimated_lost_profit
                    ? `${metrics.estimated_lost_profit.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
                <p>{metrics ? "Tahmini kayıp kâr" : "Henüz analiz yapılmadı"}</p>
              </div>

              <div className="insight-kpi">
                <span>Tahmini Sipariş Tutarı</span>
                <strong>
                  {estimatedOrderAmount
                    ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
                <p>{metrics ? "Önerilen sipariş bütçesi" : "Henüz analiz yapılmadı"}</p>
              </div>

              <div className="insight-kpi">
                <span>AI Öneri Sayısı</span>
                <strong>{metrics?.ai_suggestion_count ?? "-"}</strong>
                <p>{metrics ? "Üretilen öneri sayısı" : "Henüz analiz yapılmadı"}</p>
              </div>
            </section>

            <section className="insight-card">
              <h2>🩺 Eczane Sağlık Skoru</h2>

              <h1
                style={{
                  fontSize: 56,
                  marginBottom: 10,
                  color: "#0f766e",
                }}
              >
                {healthScore}/100
              </h1>

              <progress
                value={healthScore}
                max={100}
                style={{
                  width: "100%",
                  height: 14,
                  marginBottom: 20,
                }}
              />

              <div className="analysis-summary">
                <p>
                  Genel Durum : <strong>{healthStatus}</strong>
                </p>
                <p>
                  Risk : <strong>{metrics?.risk_score ?? "-"}</strong>
                </p>
                <p>
                  Kritik Stok : <strong>{metrics?.critical_stock_count ?? "-"}</strong>
                </p>
                <p>
                  Fazla Stok : <strong>{overStockCount ?? "-"}</strong>
                </p>
                <p>
                  AI Önerileri : <strong>{metrics?.ai_suggestion_count ?? "-"}</strong>
                </p>
              </div>
            </section>

            <section className="insight-main-grid">
              <div className="insight-card upload-card">
                <h2>Veri Yükleme</h2>
                <p>Analiz için gerekli 3 Excel dosyasını yükleyin.</p>

                <div className="file-list">
                  <label>
                    <span>Envanter.xlsx</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) =>
                        setInventoryFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <small>{inventoryFile ? inventoryFile.name : "Yüklenmedi"}</small>
                  </label>

                  <label>
                    <span>Satış.xlsx</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) =>
                        setSalesFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <small>{salesFile ? salesFile.name : "Yüklenmedi"}</small>
                  </label>

                  <label>
                    <span>Ürün Satış.xlsx</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) =>
                        setProductFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <small>{productFile ? productFile.name : "Yüklenmedi"}</small>
                  </label>
                </div>

                <button
                  className="analysis-btn"
                  onClick={startAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Analiz Yapılıyor..." : "Analizi Başlat"}
                </button>
              </div>

              <div className="insight-card">
                <h2>Son Analiz Özeti</h2>

                {metrics ? (
                  <div className="analysis-summary">
                    <p>✅ Risk skoru: <strong>{metrics.risk_score}</strong></p>
                    <p>📦 Kritik stok: <strong>{metrics.critical_stock_count}</strong> ürün</p>
                    <p>⚠️ Yüksek stok: <strong>{overStockCount ?? "-"}</strong> ürün</p>
                    <p>
                      💰 Tahmini sipariş:{" "}
                      <strong>
                        {estimatedOrderAmount
                          ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                          : "-"}
                      </strong>
                    </p>
                    <p>🤖 AI öneri sayısı: <strong>{metrics.ai_suggestion_count ?? "-"}</strong></p>
                  </div>
                ) : (
                  <p>Henüz analiz yapılmadı.</p>
                )}
              </div>

              <div className="insight-card">
                <h2>Veri Kalitesi</h2>
                <p>{metrics ? "Veriler başarıyla analiz edildi." : "Henüz analiz yapılmadı."}</p>
                <div className="donut-placeholder"></div>
              </div>

              <div className="insight-card quick-card">
                <h2>Hızlı Erişim</h2>
                <button onClick={() => setActiveModule("🤖 AYÇA Copilot")}>
                  AI Önerileri →
                </button>
                <button onClick={() => setActiveModule("📊 Raporlar")}>
                  Raporlar →
                </button>
                <button onClick={() => setActiveModule("📦 Operasyon Merkezi")}>
                  Stok Analizi →
                </button>
                <button>Veri Geçmişi →</button>
              </div>
            </section>

            {orderSuggestions.length > 0 && (
              <section className="insight-card">
                <h2>📦 Sipariş Önerileri</h2>
                <p>İlk 20 ürün önerisi aşağıdadır.</p>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Öncelik</th>
                        <th>Ürün</th>
                        <th>Stok</th>
                        <th>Satış</th>
                        <th>Önerilen Sipariş</th>
                        <th>Tahmini Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderSuggestions.map((item, index) => (
                        <tr key={index}>
                          <td>{item["Öncelik"]}</td>
                          <td>{item["Ürün Adı"]}</td>
                          <td>{item.Stok}</td>
                          <td>{item["Satılan Adet"]}</td>
                          <td>{item["Önerilen Sipariş"]}</td>
                          <td>
                            {item["Tahmini Sipariş Tutarı"].toLocaleString("tr-TR")} ₺
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {activeModule === "☀️ Sabah Brifingi" && (
          <section className="insight-card">
            <h2>☀️ Sabah Brifingi</h2>
            <p>Bugünkü eczane durumunuzun hızlı özeti.</p>

            <div className="analysis-summary">
              <p>
                ✅ Risk seviyesi:{" "}
                <strong>
                  {metrics?.risk_score !== null && metrics?.risk_score !== undefined
                    ? metrics.risk_score < 1
                      ? "Düşük"
                      : "Kontrol edilmeli"
                    : "-"}
                </strong>
              </p>

              <p>
                📦 Kritik stok:{" "}
                <strong>{metrics?.critical_stock_count ?? "-"}</strong> ürün
              </p>

              <p>
                ⚠️ Yüksek stok:{" "}
                <strong>{overStockCount ?? "-"}</strong> ürün
              </p>

              <p>
                💰 Önerilen sipariş bütçesi:{" "}
                <strong>
                  {estimatedOrderAmount
                    ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
              </p>

              <p>
                🤖 AI Yorumu:{" "}
                <strong>
                  {metrics
                    ? "Stok seviyeniz genel olarak sağlıklı görünüyor. Yüksek stoklu ürünleri ve önerilen sipariş listesini gözden geçirmeniz önerilir."
                    : "Analiz yapıldıktan sonra AI yorumu burada görünecek."}
                </strong>
              </p>
            </div>
          </section>
        )}


        {activeModule === "📦 Operasyon Merkezi" && (
          <section className="insight-card">
            <h2>📦 Operasyon Merkezi</h2>
            <p>Stok ve sipariş önerileriniz.</p>

            <section className="insight-kpi-grid">
              <div className="insight-kpi">
                <span>Öneri Sayısı</span>
                <strong>{orderSuggestions.length}</strong>
              </div>

              <div className="insight-kpi">
                <span>Sipariş Bütçesi</span>
                <strong>
                  {estimatedOrderAmount
                    ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
              </div>

              <div className="insight-kpi">
                <span>Kritik Stok</span>
                <strong>{metrics?.critical_stock_count ?? "-"}</strong>
              </div>

              <div className="insight-kpi">
                <span>Fazla Stok</span>
                <strong>{overStockCount ?? "-"}</strong>
              </div>
            </section>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Öncelik</th>
                    <th>Ürün</th>
                    <th>Stok</th>
                    <th>Satış</th>
                    <th>Sipariş</th>
                  </tr>
                </thead>
                <tbody>
                  {orderSuggestions.map((item, index) => (
                    <tr key={index}>
                      <td>{item["Öncelik"]}</td>
                      <td>{item["Ürün Adı"]}</td>
                      <td>{item.Stok}</td>
                      <td>{item["Satılan Adet"]}</td>
                      <td>{item["Önerilen Sipariş"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeModule !== "🏠 Dashboard" && activeModule !== "☀️ Sabah Brifingi" && activeModule !== "📦 Operasyon Merkezi" && (
          <section className="insight-card module-placeholder">
            <h2>{activeModule}</h2>
            <p>
              Bu alan, mevcut Streamlit AYÇA Insight modülünden Next.js platformuna taşınacak.
            </p>
            <div className="empty-chart">Modül iskeleti hazır.</div>
          </section>
        )}
      </section>
    </main>
  );
}