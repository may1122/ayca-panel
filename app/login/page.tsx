"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("demo@aycayazilim.com");
  const [password, setPassword] = useState("demo123");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setLoading(true); setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage("Giriş başarısız: " + error.message); setLoading(false); return; }
    const userId = data.user?.id;
    if (!userId) { setMessage("Kullanıcı bilgisi alınamadı."); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    window.location.href = profile?.role === "admin" ? "/admin" : "/dashboard";
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-pill">AYÇA Panel</div>
        <h1>Giriş Yap</h1>
        <p>Demo müşteri veya yönetici hesabınızla panele giriş yapın.</p>
        <label>E-posta<input value={email} type="email" onChange={(e)=>setEmail(e.target.value)} placeholder="demo@aycayazilim.com" /></label>
        <label>Şifre<input value={password} type="password" onChange={(e)=>setPassword(e.target.value)} placeholder="demo123" /></label>
        <button className="btn primary full" onClick={handleLogin} disabled={loading}>{loading ? "Giriş yapılıyor..." : "Giriş Yap"}</button>
        {message && <div className="alert">{message}</div>}
        <div className="helper-box"><strong>Not</strong><span>Bu ekran gerçek Supabase Auth ile çalışır. Kullanıcıları Supabase Authentication bölümünden oluşturacağız.</span></div>
      </section>
    </main>
  );
}
