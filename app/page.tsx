export default function HomePage() {
  return (
    <main className="landing-page">
      <section className="landing-card">
        <div className="brand-pill">AYÇA Panel</div>
        <h1>Müşteri ve yönetici paneli</h1>
        <p>AYÇA Nöbet ve AYÇA Insight müşterileri için güvenli giriş, ürün erişimi ve abonelik yönetimi altyapısı.</p>
        <div className="action-row">
          <a className="btn primary" href="/login">Giriş Yap</a>
          <a className="btn secondary" href="https://ayca-yedek-website.vercel.app/">Tanıtım Sitesi</a>
        </div>
      </section>
    </main>
  );
}
