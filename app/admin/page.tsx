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
        <div className="sidebar-logo">AYÇA</div>

        <a className="active">Yönetici Paneli</a>
        <a href="/dashboard">Müşteri Paneli</a>

        <button onClick={logout}>Çıkış Yap</button>
      </aside>

      <section className="panel-content">
        <div className="panel-header">
          <div>
            <span className="muted">AYÇA Yönetim</span>
            <h1>Yönetici Dashboard</h1>
            <p>
              Müşteri, paket ve demo erişimlerini buradan yönetin.
            </p>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Formu Kapat" : "+ Yeni Müşteri"}
          </button>
        </div>

        <div className="metric-grid">
          <div className="metric-card">
            <span>Toplam Müşteri</span>
            <strong>{companies.length}</strong>
          </div>

          <div className="metric-card">
            <span>Aktif</span>
            <strong>{activeCount}</strong>
          </div>

          <div className="metric-card">
            <span>Demo</span>
            <strong>{demoCount}</strong>
          </div>

          <div className="metric-card">
            <span>Pasif</span>
            <strong>{passiveCount}</strong>
          </div>
        </div>

        {showCreateForm && (
          <div className="table-card" style={{ marginBottom: 24 }}>
            <div className="table-title">
              <div>
                <h2>Yeni Müşteri Oluştur</h2>
                <span>
                  Eczane ve giriş hesabı birlikte oluşturulacaktır.
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginTop: 20,
              }}
            >
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
                <select
                  value={packageName}
                  onChange={(event) => setPackageName(event.target.value)}
                >
                  <option value="Insight">Insight</option>
                  <option value="Insight Pro">Insight Pro</option>
                  <option value="Demo">Demo</option>
                </select>
              </label>

              <label>
                <span>Durum</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="demo">Demo</option>
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: 24 }}>
              <button
                className="primary-button"
                type="button"
                onClick={createCustomer}
                disabled={creating}
              >
                {creating
                  ? "Müşteri Oluşturuluyor..."
                  : "Müşteriyi Oluştur"}
              </button>
            </div>
          </div>
        )}

        <div className="table-card">
          <div className="table-title">
            <h2>Müşteriler</h2>
            <span>{companies.length} kayıt</span>
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
                    <td>{company.name}</td>
                    <td>{company.city ?? "-"}</td>
                    <td>{company.package_name ?? "Demo"}</td>

                    <td>
                      <span className={"status " + company.status}>
                        {company.status}
                      </span>
                    </td>

                    <td>{company.subscription_ends_at ?? "-"}</td>

                    <td className="table-actions">
                      <button
                        onClick={() =>
                          updateStatus(company.id, "active")
                        }
                      >
                        Aktif
                      </button>

                      <button
                        onClick={() =>
                          updateStatus(company.id, "demo")
                        }
                      >
                        Demo
                      </button>

                      <button
                        onClick={() =>
                          updateStatus(company.id, "passive")
                        }
                      >
                        Pasif
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}