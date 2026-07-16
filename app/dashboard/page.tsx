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

type MorningBriefing = {
  success: boolean;
  score: number;
  status: string;
  score_items: Record<string, number>;
  top_actions: string[];
  strong: string[];
  watch: string[];
  urgent: string[];
  result: string;
  summary: {
    zero_stock_count: number;
    critical_stock_count: number;
    over_stock_count: number;
    suggestion_count: number;
    estimated_order_budget: number;
    total_turnover: number;
    average_sale: number;
    transaction_count: number;
  };
};

type FinanceDailyRevenue = {
  day: string;
  label: string;
  revenue: number;
  profit?: number;
};

type FinanceProduct = {
  product_name: string;
  quantity_sold: number;
  turnover: number;
  profit: number;
};

type CapitalProduct = {
  product_name: string;
  stock: number;
  sold_quantity: number;
  stock_value: number;
  status: string;
};

type RiskProduct = {
  product_name: string;
  risk_type: string;
  stock: number;
  sold_quantity: number;
  level: string;
  recommended_action: string;
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
  finance_metrics?: {
    success?: boolean;
    total_turnover?: number;
    average_sale?: number;
    transaction_count?: number;
    total_profit?: number;
    total_cost?: number;
    profit_margin?: number;
    daily_revenue?: FinanceDailyRevenue[];
    top_products?: FinanceProduct[];
  };
  risk_metrics?: {
    over_stock_count?: number;
    zero_stock_count?: number;
    critical_stock_count?: number;
    risk_score?: number;
    risk_products?: RiskProduct[];
    capital_products?: CapitalProduct[];
  };
  morning_briefing?: MorningBriefing | null;
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
  ): Promise<string | null> {
    if (!file || !companyId || !userId) {
      alert("Dosya veya kullanıcı bilgisi eksik.");
      return null;
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
      return null;
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
      return null;
    }

    return filePath;
  }

  async function startAnalysis() {
    if (!companyId || !userId) {
      alert("Şirket veya kullanıcı bilgisi henüz yüklenmedi.");
      return;
    }

    if (!inventoryFile || !salesFile || !productFile) {
      alert(
        "Analiz için Envanter, Satış ve Ürün Satış dosyalarının üçünü de seçiniz."
      );
      return;
    }

    try {
      setIsAnalyzing(true);

      const inventoryPath = await uploadFile(
        inventoryFile,
        "inventory"
      );

      if (!inventoryPath) {
        return;
      }

      const salesPath = await uploadFile(
        salesFile,
        "sales"
      );

      if (!salesPath) {
        return;
      }

      const productPath = await uploadFile(
        productFile,
        "product"
      );

      if (!productPath) {
        return;
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: companyId,
          inventory_path: inventoryPath,
          sales_path: salesPath,
          product_path: productPath,
        }),
      });

      const result: AnalyzeResult = await response.json();

      console.log("Analyze result:", result);

      if (!response.ok || !result.success) {
        const errorMessage =
          typeof result === "object" &&
          result !== null &&
          "detail" in result
            ? String(result.detail)
            : "Analiz sırasında hata oluştu.";

        alert(errorMessage);
        return;
      }

      setAnalyzeResult(result);

      const latestMetrics = Array.isArray(
        result.dashboard_metrics
      )
        ? result.dashboard_metrics[0]
        : result.dashboard_metrics;

      if (latestMetrics) {
        setMetrics(latestMetrics);
      }

      alert(
        "Analiz tamamlandı. Seçtiğiniz üç yeni dosya kullanıldı."
      );
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

  const morningBriefing = analyzeResult?.morning_briefing ?? null;

  const financeDailyRevenue = (
    analyzeResult?.finance_metrics?.daily_revenue ?? []
  )
    .slice(-7)
    .map((item) => ({
      day: item.label,
      value: item.revenue,
    }));

  const financeTopProducts = (
    analyzeResult?.finance_metrics?.top_products ?? []
  ).map((product) => ({
    name: product.product_name,
    sales: product.quantity_sold,
    profit: product.profit,
    turnover: product.turnover,
  }));

  const financeCapitalProducts = (
    analyzeResult?.risk_metrics?.capital_products ?? []
  ).map((product) => ({
    name: product.product_name,
    stock: product.stock,
    soldQuantity: product.sold_quantity,
    value: product.stock_value,
    status: product.status,
  }));

  const riskProducts = (
    analyzeResult?.risk_metrics?.risk_products ?? []
  ).map((product) => ({
    name: product.product_name,
    category: product.risk_type,
    stock: product.stock,
    sales: product.sold_quantity,
    level: product.level,
    action: product.recommended_action,
  }));

  const overStockCount =
    analyzeResult?.risk_metrics?.over_stock_count ?? null;

  const financeHealthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          (metrics?.risk_score ?? 0) * 5 -
          (metrics?.critical_stock_count ?? 0) * 2 -
          (overStockCount ?? 0)
      )
    )
  );

  const maximumFinanceRevenue = Math.max(
    ...financeDailyRevenue.map((item) => item.value),
    1
  );

  const zeroStockCount =
    analyzeResult?.risk_metrics?.zero_stock_count ??
    morningBriefing?.summary.zero_stock_count ??
    0;

  const criticalStockCount =
    analyzeResult?.risk_metrics?.critical_stock_count ??
    metrics?.critical_stock_count ??
    morningBriefing?.summary.critical_stock_count ??
    0;

  const rawRiskScore =
    analyzeResult?.risk_metrics?.risk_score ?? metrics?.risk_score ?? 0;

  const riskHealthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          rawRiskScore * 12 -
          criticalStockCount * 2 -
          zeroStockCount * 3 -
          (overStockCount ?? 0)
      )
    )
  );

  const riskStatus =
    riskHealthScore >= 85
      ? "🟢 Kontrollü"
      : riskHealthScore >= 70
      ? "🟡 Dikkat"
      : "🔴 Yüksek Risk";

  const totalRiskItems =
    criticalStockCount + zeroStockCount + (overStockCount ?? 0);

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
              : activeModule === "📦 Operasyon Merkezi"
              ? "Stok durumunu ve sipariş önerilerini tek ekranda inceleyin."
              : activeModule === "💰 Finans Merkezi"
              ? "Ciro, işlem hacmi, ortalama sepet ve finansal performansı tek ekranda inceleyin."
              : activeModule === "🚨 Risk Merkezi"
              ? "Kritik stok, sıfır stok, fazla stok ve kayıp kâr risklerini tek ekranda yönetin."
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
            <p>Bugünkü eczane durumunuzun hızlı ve aksiyon odaklı özeti.</p>

            {morningBriefing ? (
              <>
                <section className="insight-kpi-grid">
                  <div className="insight-kpi">
                    <span>Eczane Sağlık Skoru</span>
                    <strong>{morningBriefing.score}/100</strong>
                    <p>{morningBriefing.status}</p>
                  </div>

                  <div className="insight-kpi">
                    <span>Kritik Stok</span>
                    <strong>{morningBriefing.summary.critical_stock_count}</strong>
                    <p>Kontrol edilmesi gereken ürün</p>
                  </div>

                  <div className="insight-kpi">
                    <span>Fazla Stok</span>
                    <strong>{morningBriefing.summary.over_stock_count}</strong>
                    <p>Bağlı sermaye sinyali</p>
                  </div>

                  <div className="insight-kpi">
                    <span>Sipariş Önerisi</span>
                    <strong>{morningBriefing.summary.suggestion_count}</strong>
                    <p>
                      {morningBriefing.summary.estimated_order_budget.toLocaleString("tr-TR")} ₺
                    </p>
                  </div>
                </section>

                <section className="insight-card">
                  <h2>🩺 Sağlık Skoru Detayı</h2>
                  <h1
                    style={{
                      fontSize: 56,
                      marginBottom: 10,
                      color: "#0f766e",
                    }}
                  >
                    {morningBriefing.score}/100
                  </h1>

                  <progress
                    value={morningBriefing.score}
                    max={100}
                    style={{
                      width: "100%",
                      height: 14,
                      marginBottom: 20,
                    }}
                  />

                  <div className="analysis-summary">
                    {Object.entries(morningBriefing.score_items).map(
                      ([label, value]) => (
                        <p key={label}>
                          {label}: <strong>{value}/100</strong>
                        </p>
                      )
                    )}
                  </div>
                </section>

                <section className="insight-main-grid">
                  <div className="insight-card">
                    <h2>🤖 AYÇA Bugün Ne Diyor?</h2>
                    <div className="analysis-summary">
                      {morningBriefing.top_actions.map((item, index) => (
                        <p key={index}>☑ {item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="insight-card">
                    <h2>✅ Güçlü Yönler</h2>
                    <div className="analysis-summary">
                      {morningBriefing.strong.length > 0 ? (
                        morningBriefing.strong.map((item, index) => (
                          <p key={index}>🟢 {item}</p>
                        ))
                      ) : (
                        <p>Henüz güçlü yön verisi oluşmadı.</p>
                      )}
                    </div>
                  </div>

                  <div className="insight-card">
                    <h2>🟡 Takip Edilecekler</h2>
                    <div className="analysis-summary">
                      {morningBriefing.watch.length > 0 ? (
                        morningBriefing.watch.map((item, index) => (
                          <p key={index}>🟡 {item}</p>
                        ))
                      ) : (
                        <p>Takip gerektiren ek konu görünmüyor.</p>
                      )}
                    </div>
                  </div>

                  <div className="insight-card">
                    <h2>🔴 Acil Konular</h2>
                    <div className="analysis-summary">
                      {morningBriefing.urgent.length > 0 ? (
                        morningBriefing.urgent.map((item, index) => (
                          <p key={index}>🔴 {item}</p>
                        ))
                      ) : (
                        <p>Acil müdahale gerektiren konu görünmüyor.</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="insight-card">
                  <h2>📌 Yönetici Sonucu</h2>
                  <p>{morningBriefing.result}</p>
                </section>
              </>
            ) : (
              <div className="analysis-summary">
                <p>
                  Analiz yapıldıktan sonra sağlık skoru, aksiyonlar ve AYÇA
                  yorumu burada görünecek.
                </p>
              </div>
            )}
          </section>
        )}


        {activeModule === "📦 Operasyon Merkezi" && (
          <section className="insight-card">
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

        {activeModule === "💰 Finans Merkezi" && (
          <>
            <section className="insight-kpi-grid">
              <div className="insight-kpi finance-kpi">
                <span>💰 Toplam Ciro</span>
                <strong>
                  {morningBriefing
                    ? `${morningBriefing.summary.total_turnover.toLocaleString(
                        "tr-TR"
                      )} ₺`
                    : "-"}
                </strong>
                <p>Analiz dönemindeki toplam satış</p>
              </div>

              <div className="insight-kpi finance-kpi">
                <span>🧾 İşlem Sayısı</span>
                <strong>
                  {morningBriefing
                    ? morningBriefing.summary.transaction_count.toLocaleString(
                        "tr-TR"
                      )
                    : "-"}
                </strong>
                <p>Toplam satış işlemi</p>
              </div>

              <div className="insight-kpi finance-kpi">
                <span>🛒 Ortalama Sepet</span>
                <strong>
                  {morningBriefing
                    ? `${morningBriefing.summary.average_sale.toLocaleString(
                        "tr-TR"
                      )} ₺`
                    : "-"}
                </strong>
                <p>İşlem başına ortalama satış</p>
              </div>

              <div className="insight-kpi finance-kpi">
                <span>📈 Sipariş Bütçesi</span>
                <strong>
                  {estimatedOrderAmount
                    ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
                <p>Önerilen sipariş sermayesi</p>
              </div>
            </section>

            <section className="insight-main-grid">
              <div className="insight-card">
                <h2>💚 Finansal Sağlık</h2>

                <h1 className="finance-score">{financeHealthScore}/100</h1>

                <progress
                  value={financeHealthScore}
                  max={100}
                  className="finance-progress"
                />

                <p>
                  {financeHealthScore >= 85
                    ? "🟢 Güçlü finansal görünüm"
                    : financeHealthScore >= 70
                    ? "🟡 Takip edilmesi gereken finansal alanlar var"
                    : "🔴 Finansal riskler için aksiyon gerekli"}
                </p>
              </div>

              <div className="insight-card">
                <h2>💸 Sermaye Durumu</h2>

                <div className="analysis-summary">
                  <p>
                    Fazla stoklu ürün:{" "}
                    <strong>{overStockCount ?? "-"}</strong>
                  </p>

                  <p>
                    Kritik stoklu ürün:{" "}
                    <strong>{metrics?.critical_stock_count ?? "-"}</strong>
                  </p>

                  <p>
                    Tahmini kayıp kâr:{" "}
                    <strong>
                      {metrics?.estimated_lost_profit
                        ? `${metrics.estimated_lost_profit.toLocaleString(
                            "tr-TR"
                          )} ₺`
                        : "-"}
                    </strong>
                  </p>

                  <p>
                    Sipariş bütçesi:{" "}
                    <strong>
                      {estimatedOrderAmount
                        ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                        : "-"}
                    </strong>
                  </p>
                </div>
              </div>
            </section>

            <section className="insight-card">
              <h2>📊 Günlük Ciro Dağılımı</h2>
              <p>Son 7 günlük gerçek satış performansı</p>

              <div className="finance-chart">
                {financeDailyRevenue.map((item) => {
                  const height = Math.max(
                    (item.value / maximumFinanceRevenue) * 100,
                    8
                  );

                  return (
                    <div className="finance-chart-item" key={item.day}>
                      <span className="finance-chart-value">
                        {Math.round(item.value / 1000)}K
                      </span>

                      <div className="finance-chart-track">
                        <div
                          className="finance-chart-bar"
                          style={{ height: `${height}%` }}
                        />
                      </div>

                      <strong>{item.day}</strong>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="insight-main-grid">
              <div className="insight-card">
                <h2>🏆 En Karlı Ürünler</h2>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Ürün</th>
                        <th>Satış</th>
                        <th>Gerçek Kâr</th>
                      </tr>
                    </thead>

                    <tbody>
                      {financeTopProducts.length > 0 ? (
                        financeTopProducts.map((product) => (
                          <tr key={product.name}>
                            <td>{product.name}</td>
                            <td>{product.sales}</td>
                            <td>
                              {product.profit.toLocaleString("tr-TR")} ₺
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3}>
                            Analiz sonrası gerçek ürün verileri burada görünecek.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="insight-card">
                <h2>💸 Sermaye Bağlayan Ürünler</h2>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Ürün</th>
                        <th>Stok</th>
                        <th>Stok Değeri</th>
                      </tr>
                    </thead>

                    <tbody>
                      {financeCapitalProducts.length > 0 ? (
                        financeCapitalProducts.map((product) => (
                          <tr key={product.name}>
                            <td>{product.name}</td>
                            <td>{product.stock}</td>
                            <td>{product.value.toLocaleString("tr-TR")} ₺</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3}>
                            Sermaye bağlayan gerçek ürün bulunamadı.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="insight-card finance-ai-card">
              <h2>🤖 AYÇA Finans Yorumu</h2>

              {morningBriefing ? (
                <div className="analysis-summary">
                  <p>
                    Son analiz döneminde eczanenizin toplam cirosu{" "}
                    <strong>
                      {morningBriefing.summary.total_turnover.toLocaleString(
                        "tr-TR"
                      )}{" "}
                      ₺
                    </strong>{" "}
                    olarak gerçekleşti.
                  </p>

                  <p>
                    Ortalama sepet tutarı{" "}
                    <strong>
                      {morningBriefing.summary.average_sale.toLocaleString(
                        "tr-TR"
                      )}{" "}
                      ₺
                    </strong>{" "}
                    seviyesinde.
                  </p>

                  <p>
                    Toplam{" "}
                    <strong>
                      {morningBriefing.summary.transaction_count.toLocaleString(
                        "tr-TR"
                      )}
                    </strong>{" "}
                    satış işlemi gerçekleşti.
                  </p>

                  <p>
                    {overStockCount && overStockCount > 0
                      ? `${overStockCount} ürün fazla stok nedeniyle sermaye bağlıyor. Bu ürünlerin sipariş önceliği düşürülmelidir.`
                      : "Fazla stok kaynaklı ciddi bir sermaye riski görünmüyor."}
                  </p>

                  <p>
                    Mevcut finansal sağlık skoru{" "}
                    <strong>{financeHealthScore}/100</strong>. Sipariş
                    bütçesinin kritik stoklara yönlendirilmesi finansal
                    verimliliği artıracaktır.
                  </p>
                </div>
              ) : (
                <p>
                  Analiz tamamlandığında AYÇA finans değerlendirmesi burada
                  gösterilecek.
                </p>
              )}
            </section>

            <section className="finance-alert-grid">
              <div className="finance-alert-card finance-alert-success">
                <strong>🟢 Finansal Sağlık</strong>
                <span>{financeHealthScore}/100</span>
                <p>Genel finansal performans skoru</p>
              </div>

              <div className="finance-alert-card finance-alert-warning">
                <strong>🟡 Fazla Stok</strong>
                <span>{overStockCount ?? "-"}</span>
                <p>Sermaye bağlama riski bulunan ürün</p>
              </div>

              <div className="finance-alert-card finance-alert-danger">
                <strong>🔴 Kritik Stok</strong>
                <span>{metrics?.critical_stock_count ?? "-"}</span>
                <p>Kayıp satış riski bulunan ürün</p>
              </div>
            </section>
          </>
        )}

        {activeModule === "🚨 Risk Merkezi" && (
          <>
            <section className="insight-kpi-grid">
              <div className="insight-kpi risk-kpi risk-kpi-score">
                <span>🚨 Risk Skoru</span>
                <strong>{rawRiskScore}</strong>
                <p>Analiz motorunun ürettiği risk seviyesi</p>
              </div>

              <div className="insight-kpi risk-kpi risk-kpi-danger">
                <span>🔴 Kritik Stok</span>
                <strong>{criticalStockCount}</strong>
                <p>Kayıp satış riski bulunan ürün</p>
              </div>

              <div className="insight-kpi risk-kpi risk-kpi-warning">
                <span>🟡 Sıfır Stok</span>
                <strong>{zeroStockCount}</strong>
                <p>Stokta bulunmayan ürün</p>
              </div>

              <div className="insight-kpi risk-kpi risk-kpi-overstock">
                <span>📦 Fazla Stok</span>
                <strong>{overStockCount ?? "-"}</strong>
                <p>Sermaye bağlama riski bulunan ürün</p>
              </div>

              <div className="insight-kpi risk-kpi risk-kpi-loss">
                <span>💸 Tahmini Kayıp Kâr</span>
                <strong>
                  {metrics?.estimated_lost_profit
                    ? `${metrics.estimated_lost_profit.toLocaleString(
                        "tr-TR"
                      )} ₺`
                    : "-"}
                </strong>
                <p>Stok kaynaklı finansal risk</p>
              </div>
            </section>

            <section className="risk-summary-grid">
              <div className="insight-card risk-health-card">
                <div className="risk-card-heading">
                  <div>
                    <h2>🛡️ Risk Sağlık Skoru</h2>
                    <p>Stok ve finansal risklerin birleşik görünümü</p>
                  </div>
                  <span className="risk-status-badge">{riskStatus}</span>
                </div>

                <div className="risk-score-row">
                  <div>
                    <strong>{riskHealthScore}</strong>
                    <span>/100</span>
                  </div>

                  <div className="risk-score-copy">
                    <b>{riskStatus}</b>
                    <p>Toplam {totalRiskItems} risk sinyali takip ediliyor.</p>
                  </div>
                </div>

                <progress
                  value={riskHealthScore}
                  max={100}
                  className="risk-progress"
                />
              </div>

              <div className="insight-card risk-distribution-card">
                <h2>🥧 Risk Dağılımı</h2>
                <p>Risklerin türlerine göre dağılımı</p>

                <div className="risk-donut-layout">
                  <div
                    className="risk-donut"
                    style={{
                      background: `conic-gradient(
                        #ef4444 0deg ${
                          totalRiskItems > 0
                            ? (criticalStockCount / totalRiskItems) * 360
                            : 0
                        }deg,
                        #f59e0b ${
                          totalRiskItems > 0
                            ? (criticalStockCount / totalRiskItems) * 360
                            : 0
                        }deg ${
                          totalRiskItems > 0
                            ? ((criticalStockCount + zeroStockCount) /
                                totalRiskItems) *
                              360
                            : 0
                        }deg,
                        #6366f1 ${
                          totalRiskItems > 0
                            ? ((criticalStockCount + zeroStockCount) /
                                totalRiskItems) *
                              360
                            : 0
                        }deg 360deg
                      )`,
                    }}
                  >
                    <div className="risk-donut-center">
                      <strong>{totalRiskItems}</strong>
                      <span>Toplam risk</span>
                    </div>
                  </div>

                  <div className="risk-legend">
                    <div>
                      <span className="risk-dot risk-dot-danger"></span>
                      <p>Kritik stok</p>
                      <strong>{criticalStockCount}</strong>
                    </div>

                    <div>
                      <span className="risk-dot risk-dot-warning"></span>
                      <p>Sıfır stok</p>
                      <strong>{zeroStockCount}</strong>
                    </div>

                    <div>
                      <span className="risk-dot risk-dot-overstock"></span>
                      <p>Fazla stok</p>
                      <strong>{overStockCount ?? 0}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="insight-card">
              <div className="risk-section-heading">
                <div>
                  <h2>🚨 Öncelikli Riskler</h2>
                  <p>İlk aksiyon alınması gereken ürünler</p>
                </div>
                <span className="risk-live-badge">Canlı risk listesi</span>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th>Risk Türü</th>
                      <th>Stok</th>
                      <th>Satış</th>
                      <th>Seviye</th>
                      <th>Önerilen Aksiyon</th>
                    </tr>
                  </thead>

                  <tbody>
                    {riskProducts.length > 0 ? (
                      riskProducts.map((product) => (
                        <tr key={`${product.name}-${product.category}`}>
                          <td>{product.name}</td>
                          <td>{product.category}</td>
                          <td>{product.stock}</td>
                          <td>{product.sales}</td>
                          <td>
                            <span
                              className={`risk-level risk-level-${product.level
                                .toLowerCase()
                                .replace("ü", "u")
                                .replace("ı", "i")}`}
                            >
                              {product.level}
                            </span>
                          </td>
                          <td>
                            <span className="risk-action-pill">
                              {product.action}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          Analiz sonrası gerçek riskli ürünler burada görünecek.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="risk-insight-grid">
              <div className="insight-card risk-loss-card">
                <h2>💰 Kayıp Kâr Analizi</h2>
                <p>Stok kaynaklı tahmini finansal etki</p>

                <div className="risk-loss-value">
                  {metrics?.estimated_lost_profit
                    ? `${metrics.estimated_lost_profit.toLocaleString(
                        "tr-TR"
                      )} ₺`
                    : "-"}
                </div>

                <div className="analysis-summary">
                  <p>
                    Kritik stok: <strong>{criticalStockCount} ürün</strong>
                  </p>
                  <p>
                    Sıfır stok: <strong>{zeroStockCount} ürün</strong>
                  </p>
                  <p>
                    Fazla stok: <strong>{overStockCount ?? 0} ürün</strong>
                  </p>
                </div>
              </div>

              <div className="insight-card risk-ai-card">
                <h2>🤖 AYÇA Risk Analizi</h2>

                <div className="analysis-summary">
                  <p>
                    Eczanenizde şu anda{" "}
                    <strong>{criticalStockCount} kritik stoklu</strong> ve{" "}
                    <strong>{zeroStockCount} sıfır stoklu</strong> ürün
                    bulunuyor.
                  </p>

                  <p>
                    {criticalStockCount > 0 || zeroStockCount > 0
                      ? "Kayıp satış riskini azaltmak için kritik ürünlere öncelikli sipariş verilmelidir."
                      : "Kritik stok kaynaklı belirgin bir satış riski görünmüyor."}
                  </p>

                  <p>
                    {(overStockCount ?? 0) > 0
                      ? `${overStockCount} ürün fazla stok nedeniyle sermaye bağlıyor. Bu ürünlerin yeni siparişleri geçici olarak durdurulmalıdır.`
                      : "Fazla stok kaynaklı önemli bir sermaye riski görünmüyor."}
                  </p>

                  <p>
                    Genel risk sağlık skoru{" "}
                    <strong>{riskHealthScore}/100</strong>. Öncelikli
                    aksiyonların uygulanması stok dengesini ve nakit akışını
                    iyileştirecektir.
                  </p>
                </div>
              </div>
            </section>

            <section className="risk-action-grid">
              <div className="risk-action-card risk-action-danger">
                <span>01</span>
                <strong>Kritik stokları tamamla</strong>
                <p>
                  {criticalStockCount + zeroStockCount} ürün için acil sipariş
                  planı oluştur.
                </p>
              </div>

              <div className="risk-action-card risk-action-warning">
                <span>02</span>
                <strong>Fazla stoğu erit</strong>
                <p>
                  {overStockCount ?? 0} ürünün siparişini durdur ve satışını
                  hızlandır.
                </p>
              </div>

              <div className="risk-action-card risk-action-success">
                <span>03</span>
                <strong>Kayıp kârı azalt</strong>
                <p>
                  Hızlı satan kritik ürünleri günlük olarak takip listesine al.
                </p>
              </div>
            </section>
          </>
        )}

        {activeModule !== "🏠 Dashboard" &&
          activeModule !== "☀️ Sabah Brifingi" &&
          activeModule !== "📦 Operasyon Merkezi" &&
          activeModule !== "💰 Finans Merkezi" &&
          activeModule !== "🚨 Risk Merkezi" && (
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