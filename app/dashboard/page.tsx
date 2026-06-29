"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Company = { id:string; name:string; city:string|null; status:string; package_name:string|null; subscription_ends_at:string|null };
const NOBET_URL = "https://eczane-nobet-dashboard-6kfr2ubyh7zjijb5nfbxkf.streamlit.app/";
const INSIGHT_URL = "https://insight-yducubgke3krxns3467h4t.streamlit.app/";

export default function DashboardPage() {
  const [company,setCompany]=useState<Company|null>(null); const [email,setEmail]=useState("");
  useEffect(()=>{ async function load(){
    const {data:userData}=await supabase.auth.getUser();
    if(!userData.user){ window.location.href="/login"; return; }
    setEmail(userData.user.email ?? "");
    const {data:profile}=await supabase.from("profiles").select("company_id").eq("id",userData.user.id).single();
    if(!profile?.company_id) return;
    const {data:companyData}=await supabase.from("companies").select("*").eq("id",profile.company_id).single();
    setCompany(companyData);
  } load(); },[]);
  async function logout(){ await supabase.auth.signOut(); window.location.href="/login"; }
  return <main className="panel-page"><aside className="sidebar"><div className="sidebar-logo">AYÇA</div><a className="active">Müşteri Paneli</a><a href={NOBET_URL} target="_blank">AYÇA Nöbet</a><a href={INSIGHT_URL} target="_blank">AYÇA Insight</a><button onClick={logout}>Çıkış Yap</button></aside><section className="panel-content"><div className="panel-header"><div><span className="muted">Hoş geldiniz</span><h1>{company?.name ?? "Müşteri Paneli"}</h1><p>{email}</p></div><span className={"status "+(company?.status==="active"?"active":"passive")}>{company?.status ?? "yükleniyor"}</span></div><div className="metric-grid"><div className="metric-card"><span>Paket</span><strong>{company?.package_name ?? "Demo"}</strong></div><div className="metric-card"><span>Şehir</span><strong>{company?.city ?? "-"}</strong></div><div className="metric-card"><span>Bitiş Tarihi</span><strong>{company?.subscription_ends_at ?? "Tanımsız"}</strong></div></div><div className="product-grid"><article className="panel-product-card"><span className="brand-pill">Nöbet Planlama</span><h2>AYÇA Nöbet</h2><p>Grup dengesi, bayram adaleti ve nöbet yükü analizlerini inceleyin.</p><a className="btn primary" href={NOBET_URL} target="_blank">Canlı Demoyu Aç</a></article><article className="panel-product-card"><span className="brand-pill green">Analitik</span><h2>AYÇA Insight</h2><p>Finans, stok, risk ve yapay zekâ destekli analiz ekranlarını inceleyin.</p><a className="btn primary green" href={INSIGHT_URL} target="_blank">Canlı Demoyu Aç</a></article></div></section></main>;
}
