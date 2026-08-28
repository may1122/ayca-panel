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
  created_at: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

export default function AdminPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [packageName, setPackageName] = useState("Insight");
  const [status, setStatus] = useState("demo");

  async function loadCompanies() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profile?.role !== "admin") {
      window.location.href = "/dashboard";
      return;
    }

    setAuthorized(true);

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Companies load error:", error);
    }

    setCompanies(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  async function createCustomer() {
    if (
      !companyName.trim() ||
      !fullName.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      alert("Eczane, yetkili, e-posta ve şifre alanlarını doldurunuz.");
      return;
    }

    if (password.length < 6) {
      alert("Geçici şifre en az 6 karakter olmalıdır.");
      return;
    }

    try {
      setCreating(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        alert("Admin oturumu bulunamadı. Tekrar giriş yapınız.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/admin/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          company_name: companyName.trim(),
          city: city.trim() || null,
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          package_name: packageName,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const message =
          result?.detail || "Müşteri oluşturulurken hata oluştu.";

        alert(message);
        return;
      }

      alert("Müşteri başarıyla oluşturuldu.");

      setCompanyName("");
      setCity("");
      setFullName("");
      setEmail("");
      setPassword("");
      setPackageName("Insight");
      setStatus("demo");
      setShowCreateForm(false);

      await loadCompanies();
    } catch (error) {
      console.error("Create customer error:", error);
      alert("Müşteri oluşturulurken bağlantı hatası oluştu.");
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(companyId: string, newStatus: string) {
    const { error } = await supabase
      .from("companies")
      .update({ status: newStatus })
      .eq("id", companyId);

    if (error) {
      console.error("Status update error:", error);
      alert("Müşteri durumu güncellenemedi.");
      return;
    }

    await loadCompanies();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const activeCount = companies.filter(
    (company) => company.status === "active",
  ).length;

  const demoCount = companies.filter(
    (company) => company.status === "demo",
  ).length;

  const passiveCount = companies.filter(
    (company) => company.status === "passive",
  ).length;

  if (loading) {
    return <main className="loading-page">AYÇA Panel yükleniyor...</main>;
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="panel-page">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/ayca-logo.png" alt="AYÇA Yazılım" className="sidebar-logo-img" />
        </div>

        <nav className="sidebar-nav">
          <a className="nav-item active">
            <span className="nav-icon">◉</span>
            <span>Yönetici Paneli</span>
          </a>

          <a className="nav-item" href="/dashboard">
            <span className="nav-icon">◎</span>
            <span>Müşteri Paneli</span>
          </a>

          <button className="nav-item logout-item" type="button" onClick={logout}>
            <span className="nav-icon">↪</span>
            <span>Çıkış Yap</span>
          </button>
        </nav>

        <div className="sidebar-foot">
          <span className="shield-dot">✓</span>
          <div>
            <strong>AYÇA Yönetim</strong>
            <small>Güvenli yönetici oturumu</small>
          </div>
        </div>
      </aside>

      <section className="panel-content">
        <header className="panel-header">
          <div className="header-copy">
            <span className="muted">AYÇA YÖNETİM</span>
            <h1>Yönetici Dashboard</h1>
            <p>Müşteri, paket ve demo erişimlerini tek ekrandan yönetin.</p>
          </div>

          <button
            className={showCreateForm ? "primary-button is-open" : "primary-button"}
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <span className="button-icon">{showCreateForm ? "×" : "+"}</span>
            <span>{showCreateForm ? "Formu Kapat" : "Yeni Müşteri"}</span>
          </button>
        </header>

        <div className="metric-grid">
          <article className="metric-card">
            <div className="metric-icon metric-purple">◎</div>
            <div>
              <span>Toplam Müşteri</span>
              <strong>{companies.length}</strong>
              <small>Tüm müşteriler</small>
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-icon metric-green">●</div>
            <div>
              <span>Aktif</span>
              <strong>{activeCount}</strong>
              <small>Aktif müşteriler</small>
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-icon metric-blue">▣</div>
            <div>
              <span>Demo</span>
              <strong>{demoCount}</strong>
              <small>Demo müşteriler</small>
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-icon metric-orange">Ⅱ</div>
            <div>
              <span>Pasif</span>
              <strong>{passiveCount}</strong>
              <small>Pasif müşteriler</small>
            </div>
          </article>
        </div>

        {showCreateForm && (
          <section className="create-card">
            <div className="table-title">
              <div>
                <span className="section-kicker">YENİ KAYIT</span>
                <h2>Yeni Müşteri Oluştur</h2>
                <p>Eczane ve giriş hesabı birlikte oluşturulacaktır.</p>
              </div>
            </div>

            <div className="create-grid">
              <label>
                <span>Eczane / Firma Adı</span>
                <input
                  type="text"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Örn. Test Eczanesi"
                />
              </label>

              <label>
                <span>Şehir</span>
                <input
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Örn. Kahramanmaraş"
                />
              </label>

              <label>
                <span>Yetkili Adı</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ad Soyad"
                />
              </label>

              <label>
                <span>E-posta</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="musteri@example.com"
                />
              </label>

              <label>
                <span>Geçici Şifre</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="En az 6 karakter"
                />
              </label>

              <label>
                <span>Paket</span>
                <select value={packageName} onChange={(event) => setPackageName(event.target.value)}>
                  <option value="Insight">Insight</option>
                  <option value="Insight Pro">Insight Pro</option>
                  <option value="Demo">Demo</option>
                </select>
              </label>

              <label>
                <span>Durum</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="demo">Demo</option>
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>
            </div>

            <div className="create-actions">
              <button
                className="create-submit"
                type="button"
                onClick={createCustomer}
                disabled={creating}
              >
                <span className="button-icon">+</span>
                {creating ? "Müşteri Oluşturuluyor..." : "Müşteriyi Oluştur"}
              </button>
            </div>
          </section>
        )}

        <section className="table-card">
          <div className="table-title">
            <div>
              <span className="section-kicker">MÜŞTERİ YÖNETİMİ</span>
              <h2>Müşteriler</h2>
            </div>
            <span className="record-badge">{companies.length} kayıt</span>
          </div>

          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Müşteri</th>
                  <th>Şehir</th>
                  <th>Paket</th>
                  <th>Durum</th>
                  <th>Bitiş</th>
                  <th>İşlem</th>
                </tr>
              </thead>

              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-icon">✚</span>
                        <strong>{company.name}</strong>
                      </div>
                    </td>
                    <td>{company.city ?? "-"}</td>
                    <td>{company.package_name ?? "Demo"}</td>
                    <td>
                      <span className={"status " + company.status}>
                        {company.status}
                      </span>
                    </td>
                    <td>{company.subscription_ends_at ?? "-"}</td>
                    <td className="table-actions">
                      <button className="action-btn active-btn" onClick={() => updateStatus(company.id, "active")}>Aktif</button>
                      <button className="action-btn demo-btn" onClick={() => updateStatus(company.id, "demo")}>Demo</button>
                      <button className="action-btn passive-btn" onClick={() => updateStatus(company.id, "passive")}>Pasif</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <style jsx>{`
        * { box-sizing: border-box; }

        .panel-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 255px minmax(0, 1fr);
          background:
            radial-gradient(circle at 86% 8%, rgba(66, 214, 195, .14), transparent 26%),
            linear-gradient(180deg, #eef7fb 0%, #f6f9fc 100%);
          color: #0c1e45;
        }

        .sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 26px 18px 22px;
          background:
            radial-gradient(circle at 40% 8%, rgba(36, 115, 212, .18), transparent 24%),
            linear-gradient(180deg, #09234f 0%, #082c58 100%);
          color: #fff;
          box-shadow: inset -1px 0 0 rgba(255,255,255,.05);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 0 4px 28px;
        }

        .sidebar-logo-img {
          width: 205px;
          max-height: 72px;
          object-fit: contain;
          object-position: left center;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .nav-item {
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          background: rgba(255,255,255,.07);
          color: rgba(255,255,255,.94);
          text-decoration: none;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
          font-weight: 850;
          transition: .18s ease;
        }

        .nav-item:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,.11);
        }

        .nav-item.active {
          border-color: rgba(69, 214, 223, .18);
          background: linear-gradient(105deg, rgba(20,127,183,.65), rgba(31,94,167,.55));
          box-shadow: 0 10px 26px rgba(0, 15, 40, .18);
        }

        .nav-icon {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(255,255,255,.08);
          color: #75e7dd;
          font-size: 15px;
        }

        .logout-item { margin-top: 2px; }

        .sidebar-foot {
          margin-top: auto;
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 14px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          background: rgba(255,255,255,.04);
        }

        .shield-dot {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(39, 215, 202, .11);
          color: #43e0d2;
          font-weight: 900;
        }

        .sidebar-foot strong,
        .sidebar-foot small { display: block; }

        .sidebar-foot strong { font-size: 12px; }
        .sidebar-foot small { margin-top: 3px; font-size: 9px; color: rgba(255,255,255,.56); }

        .panel-content {
          min-width: 0;
          padding: 26px 28px 34px;
        }

        .panel-header {
          min-height: 182px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 30px 34px;
          border: 1px solid rgba(215,226,239,.92);
          border-radius: 26px;
          background: rgba(255,255,255,.88);
          box-shadow: 0 18px 52px rgba(15,31,68,.06);
        }

        .header-copy .muted,
        .section-kicker {
          display: block;
          margin-bottom: 8px;
          color: #2f8fd3;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .14em;
        }

        .header-copy h1 {
          margin: 0;
          font-size: clamp(34px, 3vw, 50px);
          line-height: 1.02;
          letter-spacing: -.045em;
        }

        .header-copy p {
          margin: 14px 0 0;
          color: #74839a;
          font-size: 14px;
        }

        .primary-button,
        .create-submit {
          min-height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 0 18px;
          border: 0;
          border-radius: 15px;
          background: linear-gradient(105deg, #0ea18f 0%, #189db0 48%, #6848dc 100%);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(37, 115, 163, .18);
          font-size: 14px;
          font-weight: 900;
          transition: .18s ease;
        }

        .primary-button {
          min-width: 168px;
          margin-top: 4px;
        }

        .primary-button:hover,
        .create-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 34px rgba(37,115,163,.24);
        }

        .primary-button.is-open {
          background: linear-gradient(105deg, #475569, #334155);
        }

        .button-icon {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(255,255,255,.14);
          font-size: 18px;
          line-height: 1;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 16px;
          margin: 20px 0;
        }

        .metric-card {
          min-height: 118px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: rgba(255,255,255,.94);
          box-shadow: 0 10px 30px rgba(15,31,68,.045);
        }

        .metric-icon {
          width: 50px;
          height: 50px;
          flex: 0 0 50px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          font-weight: 900;
        }

        .metric-purple { background:#f0edff; color:#6d4bdb; }
        .metric-green { background:#e7f7f2; color:#159c89; }
        .metric-blue { background:#e8f3ff; color:#3288d9; }
        .metric-orange { background:#fff1e8; color:#f97316; }

        .metric-card span,
        .metric-card small,
        .metric-card strong { display:block; }

        .metric-card span { color:#5f6f86; font-size:13px; font-weight:850; }
        .metric-card strong { margin-top:3px; font-size:30px; line-height:1; color:#0d2049; }
        .metric-card small { margin-top:6px; color:#9aa6b5; font-size:10px; }

        .create-card,
        .table-card {
          border: 1px solid #e0e7ef;
          border-radius: 24px;
          background: rgba(255,255,255,.96);
          box-shadow: 0 14px 42px rgba(15,31,68,.05);
        }

        .create-card {
          margin-bottom: 20px;
          padding: 26px;
        }

        .table-card { padding: 24px 26px 18px; }

        .table-title {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:18px;
          margin-bottom:18px;
        }

        .table-title h2 {
          margin:0;
          font-size:23px;
          letter-spacing:-.02em;
        }

        .table-title p {
          margin:6px 0 0;
          color:#8592a5;
          font-size:12px;
        }

        .record-badge {
          padding:8px 12px;
          border-radius:999px;
          background:#f3f6fa;
          color:#596a81;
          font-size:11px;
          font-weight:850;
        }

        .create-grid {
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
          gap:16px;
        }

        .create-grid label > span {
          display:block;
          margin-bottom:7px;
          color:#475569;
          font-size:11px;
          font-weight:850;
        }

        .create-grid input,
        .create-grid select {
          width:100%;
          height:48px;
          padding:0 13px;
          border:1px solid #dce4ec;
          border-radius:12px;
          outline:none;
          background:#fbfdff;
          color:#0f1f44;
          font:inherit;
          font-size:13px;
        }

        .create-grid input:focus,
        .create-grid select:focus {
          border-color:#25a99f;
          box-shadow:0 0 0 3px rgba(37,169,159,.08);
        }

        .create-actions { margin-top:22px; }

        .create-submit { min-width:190px; }
        .create-submit:disabled { opacity:.65; cursor:wait; }

        .responsive-table { overflow-x:auto; }

        table {
          width:100%;
          min-width:900px;
          border-collapse:collapse;
        }

        th {
          padding:14px 10px;
          border-bottom:1px solid #dfe7ef;
          color:#14264b;
          text-align:left;
          font-size:11px;
          font-weight:900;
        }

        td {
          padding:14px 10px;
          border-bottom:1px solid #e7edf3;
          color:#40516c;
          font-size:12px;
          vertical-align:middle;
        }

        tbody tr:hover { background:#fbfdff; }

        .customer-cell {
          display:flex;
          align-items:center;
          gap:10px;
        }

        .customer-cell strong { color:#14264b; }

        .customer-icon {
          width:34px;
          height:34px;
          display:grid;
          place-items:center;
          border-radius:10px;
          background:#eef4ff;
          color:#5b5ce2;
          font-weight:900;
        }

        .status {
          display:inline-flex;
          align-items:center;
          padding:6px 10px;
          border-radius:999px;
          font-size:10px;
          font-weight:900;
          text-transform:capitalize;
        }

        .status.demo { background:#fff7ed; color:#c55a11; border:1px solid #fed7aa; }
        .status.active { background:#ecfdf5; color:#087f6d; border:1px solid #a7f3d0; }
        .status.passive { background:#fff1f2; color:#c93a45; border:1px solid #fecdd3; }

        .table-actions {
          display:flex;
          gap:7px;
          white-space:nowrap;
        }

        .action-btn {
          height:34px;
          padding:0 11px;
          border-radius:10px;
          background:#fff;
          cursor:pointer;
          font:inherit;
          font-size:11px;
          font-weight:850;
        }

        .active-btn { border:1px solid #cde8e3; color:#0b7d72; }
        .demo-btn { border:1px solid #d9e6f7; color:#286fc5; }
        .passive-btn { border:1px solid #f6cfd3; color:#c92f3b; }

        .loading-page {
          min-height:100vh;
          display:grid;
          place-items:center;
          background:#f5f8fc;
          color:#0d2049;
          font-weight:850;
        }

        @media (max-width: 1100px) {
          .panel-page { grid-template-columns:220px minmax(0,1fr); }
          .metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .sidebar-logo-img { width:180px; }
        }

        @media (max-width: 760px) {
          .panel-page { display:block; }
          .sidebar {
            position:relative;
            height:auto;
            padding:16px;
          }
          .sidebar-nav { display:grid; grid-template-columns:1fr 1fr; }
          .logout-item { grid-column:1 / -1; }
          .sidebar-foot { display:none; }
          .panel-content { padding:16px; }
          .panel-header { min-height:0; flex-direction:column; padding:24px; }
          .primary-button { width:100%; }
          .metric-grid { grid-template-columns:1fr; }
          .table-card,.create-card { padding:18px; }
        }
      `}</style>
    </main>
  );
}
