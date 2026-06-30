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
  ai_suggestion_count: number | null;
};

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
    return;
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
    return;
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
    console.error("Database error:", dbError);
    alert("Dosya yüklendi ama kayıt oluşturulamadı.");
    return;
  }

  alert(`${file.name} başarıyla yüklendi.`);
}
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

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
              : "Bu modül Sprint 2 içinde adım adım aktif hale getirilecek."}
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
                  {metrics?.estimated_order_amount
                    ? `${metrics.estimated_order_amount.toLocaleString("tr-TR")} ₺`
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
      onChange={(e) => setInventoryFile(e.target.files?.[0] ?? null)}
    />
    <small>{inventoryFile ? inventoryFile.name : "Yüklenmedi"}</small>
  </label>

  <label>
    <span>Satış.xlsx</span>
    <input
      type="file"
      accept=".xlsx,.xls,.csv"
      onChange={(e) => setSalesFile(e.target.files?.[0] ?? null)}
    />
    <small>{salesFile ? salesFile.name : "Yüklenmedi"}</small>
  </label>

  <label>
    <span>Ürün.xlsx</span>
    <input
      type="file"
      accept=".xlsx,.xls,.csv"
      onChange={(e) => setProductFile(e.target.files?.[0] ?? null)}
    />
    <small>{productFile ? productFile.name : "Yüklenmedi"}</small>
  </label>
</div>

                <button
  className="analysis-btn"
  onClick={async () => {
    if (inventoryFile) {
      await uploadFile(inventoryFile, "inventory");
    }

    if (salesFile) {
      await uploadFile(salesFile, "sales");
    }

    if (productFile) {
      await uploadFile(productFile, "product");
    }

    alert("Seçilen dosyalar başarıyla yüklendi.");
  }}
>
  Analizi Başlat
</button>
              </div>

              <div className="insight-card">
                <h2>Son Analiz Özeti</h2>
                <p>
                  {metrics
                    ? `Risk skoru ${metrics.risk_score}, kritik stok ${metrics.critical_stock_count} ürün.`
                    : "Henüz analiz yapılmadı."}
                </p>
                <div className="empty-chart">Analiz sonuçlarınız burada görünecek.</div>
              </div>

              <div className="insight-card">
                <h2>Veri Kalitesi</h2>
                <p>Henüz analiz yapılmadı.</p>
                <div className="donut-placeholder"></div>
              </div>

              <div className="insight-card quick-card">
                <h2>Hızlı Erişim</h2>
                <button>AI Önerileri →</button>
                <button>Raporlar →</button>
                <button>Stok Analizi →</button>
                <button>Veri Geçmişi →</button>
              </div>
            </section>
          </>
        )}

        {activeModule !== "🏠 Dashboard" && (
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