"use client";

export default function HomePage() {
  return (
    <main className="landing-page">
      <section className="landing-shell">
        <div className="hero-copy">
          <img
            src="/ayca-logo.png"
            alt="AYÇA Yazılım"
            className="brand-logo"
          />

          <span className="eyebrow">AYÇA INSIGHT</span>

          <h1>
            Yapay zekâ destekli
            <br />
            <strong>eczane asistanınız.</strong>
          </h1>

          <p className="hero-description">
            AYÇA Insight; satış, stok, finans ve hasta verilerinizi tek yerde
            analiz eder. Kritik riskleri, fırsatları ve öncelikli aksiyonları
            görünür hale getirerek eczanenizi daha hızlı ve daha doğru
            yönetmenize yardımcı olur.
          </p>

          <div className="hero-actions">
            <a className="primary-action" href="/login">
              <span className="login-symbol">↪</span>
              <span>Panele Giriş</span>
              <strong>→</strong>
            </a>

            <a
              className="secondary-action"
              href="https://ayca-yedek-website.vercel.app/"
              target="_blank"
              rel="noreferrer"
            >
              <span className="info-symbol">i</span>
              <span>Tanıtım Sitesi</span>
            </a>
          </div>

          <div className="security-line">
            <span className="security-icon">✓</span>
            <span>Güvenli giriş</span>
            <i />
            <span>Verileriniz koruma altında</span>
          </div>
        </div>

        <div className="visual-side" aria-label="AYÇA Insight ürün önizlemesi">
          <div className="glow glow-teal" />
          <div className="glow glow-purple" />

          <div className="dashboard-preview">
            <aside className="preview-sidebar">
              <div className="preview-logo-wrap">
                <img
                  src="/ayca-logo.png"
                  alt=""
                  className="preview-logo-img"
                />
              </div>

              <div className="preview-product-name">
                Eczane Yönetim Zekâsı
              </div>

              <nav className="preview-nav-list">
                <span className="preview-nav active">⌂ Dashboard</span>
                <span className="preview-nav">✦ AYÇA Asistan</span>
                <span className="preview-nav">◇ Operasyon</span>
                <span className="preview-nav">₺ Finans</span>
                <span className="preview-nav">◎ Hasta & Reçete</span>
              </nav>

              <div className="preview-trust">
                <div className="preview-trust-row">
                  <span>Veri Güveni</span>
                  <strong>%83</strong>
                </div>
                <div className="trust-bar">
                  <span />
                </div>
                <small>Analiz motorlarının doğrulama oranı</small>
              </div>
            </aside>

            <section className="preview-main">
              <div className="preview-hero">
                <div>
                  <span>CANLI YÖNETİCİ ÖZETİ</span>
                  <h2>Eczanenizin bugünkü nabzı tek ekranda</h2>
                  <p>
                    Stok, sipariş, risk ve aksiyonları birlikte okuyun. AYÇA
                    yalnızca veriyi göstermez; bugün ne yapmanız gerektiğini öne
                    çıkarır.
                  </p>
                </div>

                <div className="health-card">
                  <small>Eczane Sağlık Skoru</small>
                  <strong>89</strong>
                  <span>/100 · Dikkat</span>
                  <div className="health-bar">
                    <i />
                  </div>
                </div>
              </div>

              <div className="preview-kpis">
                <article>
                  <small>Risk Skoru</small>
                  <strong>25.71</strong>
                  <span>Genel operasyon riski</span>
                </article>

                <article>
                  <small>Kritik Stok</small>
                  <strong>4</strong>
                  <span>Acil kontrol gereken ürün</span>
                </article>

                <article>
                  <small>Sipariş Bütçesi</small>
                  <strong>126.925 ₺</strong>
                  <span>Önerilen toplam yatırım</span>
                </article>

                <article>
                  <small>AYÇA Önerileri</small>
                  <strong>130</strong>
                  <span>Karar destek aksiyonu</span>
                </article>
              </div>

              <div className="preview-finance-row">
                <article className="finance-card">
                  <small>💵 Ciro</small>
                  <strong>303.103 ₺</strong>
                  <span>Bu ay toplam satış</span>
                </article>

                <article className="finance-card">
                  <small>📈 Net Kâr</small>
                  <strong>74.169 ₺</strong>
                  <span>Bu ay doğrulanmış kâr</span>
                </article>

                <article className="risk-card">
                  <div>
                    <small>📦 Stok Risk Görünümü</small>
                    <strong>823</strong>
                    <span>Öne çıkan risk sinyalleri</span>
                  </div>
                  <div className="risk-bars">
                    <i className="b1" />
                    <i className="b2" />
                    <i className="b3" />
                    <i className="b4" />
                  </div>
                </article>

                <article className="patient-card">
                  <small>👥 Hasta Segmentleri</small>
                  <strong>3.435</strong>
                  <span>Toplam hasta</span>
                  <div className="donut" />
                </article>
              </div>

              <div className="trend-card">
                <div className="trend-head">
                  <div>
                    <span>FİNANSAL PERFORMANS</span>
                    <h3>Ciro & Kâr Trendi</h3>
                  </div>
                  <small>Son 7 gün</small>
                </div>

                <svg viewBox="0 0 820 190" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="landingLine" x1="0" x2="1">
                      <stop offset="0%" stopColor="#0e6c6f" />
                      <stop offset="100%" stopColor="#13b8ad" />
                    </linearGradient>
                    <linearGradient id="landingArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2dcabf" stopOpacity=".2" />
                      <stop offset="100%" stopColor="#2dcabf" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,132 C85,130 110,120 175,125 C245,130 275,92 345,106 C415,120 460,70 528,87 C605,105 664,63 820,48 L820,190 L0,190 Z"
                    fill="url(#landingArea)"
                  />
                  <path
                    d="M0,132 C85,130 110,120 175,125 C245,130 275,92 345,106 C415,120 460,70 528,87 C605,105 664,63 820,48"
                    fill="none"
                    stroke="url(#landingLine)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </section>
          </div>
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .landing-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
          background:
            radial-gradient(circle at 8% 8%, rgba(52, 178, 238, 0.12), transparent 27%),
            radial-gradient(circle at 92% 8%, rgba(49, 212, 190, 0.13), transparent 28%),
            radial-gradient(circle at 84% 90%, rgba(111, 81, 236, 0.08), transparent 27%),
            linear-gradient(180deg, #f9fcfe 0%, #f3f8fc 100%);
          color: #0b1d43;
        }

        .landing-shell {
          width: min(1500px, 100%);
          min-height: min(860px, calc(100vh - 56px));
          display: grid;
          grid-template-columns: minmax(390px, 0.78fr) minmax(760px, 1.22fr);
          align-items: center;
          gap: clamp(42px, 5vw, 76px);
          margin: 0 auto;
          padding: clamp(44px, 4vw, 68px);
          border: 1px solid rgba(218, 228, 238, 0.88);
          border-radius: 34px;
          background: rgba(255, 255, 255, 0.86);
          box-shadow:
            0 30px 90px rgba(24, 44, 78, 0.07),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(8px);
          overflow: hidden;
        }

        .hero-copy {
          position: relative;
          z-index: 3;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }

        .brand-logo {
          width: 230px;
          max-height: 84px;
          object-fit: contain;
          object-position: left center;
          margin-bottom: 52px;
        }

        .eyebrow {
          display: block;
          margin-bottom: 18px;
          color: #129a94;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: 0.23em;
        }

        h1 {
          margin: 0;
          color: #0b1d43;
          font-size: clamp(54px, 4.8vw, 80px);
          font-weight: 900;
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        h1 strong {
          display: inline-block;
          margin: 8px 0 0;
          font-weight: 950;
          background: linear-gradient(90deg, #4da8ef 0%, #696be9 60%, #8a69ee 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-description {
          max-width: 560px;
          margin: 30px 0 0;
          color: #63748c;
          font-size: 17px;
          line-height: 1.74;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 36px;
        }

        .primary-action,
        .secondary-action {
          min-height: 58px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          border-radius: 14px;
          text-decoration: none;
          font-size: 15px;
          font-weight: 900;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .primary-action {
          min-width: 205px;
          padding: 0 18px;
          color: white;
          background: linear-gradient(105deg, #0a315e 0%, #0c4770 100%);
          box-shadow: 0 14px 28px rgba(12, 49, 94, 0.18);
        }

        .primary-action strong {
          margin-left: auto;
          font-size: 19px;
        }

        .secondary-action {
          min-width: 175px;
          padding: 0 18px;
          border: 1px solid #d7e2ed;
          background: rgba(255, 255, 255, 0.78);
          color: #173158;
        }

        .primary-action:hover,
        .secondary-action:hover {
          transform: translateY(-2px);
        }

        .login-symbol,
        .info-symbol,
        .security-icon {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          font-size: 12px;
        }

        .login-symbol {
          background: rgba(255, 255, 255, 0.1);
        }

        .info-symbol {
          border: 1px solid #8da0b8;
          border-radius: 50%;
          color: #395675;
          font-weight: 950;
        }

        .security-line {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 27px;
          color: #708097;
          font-size: 12px;
        }

        .security-icon {
          background: #e8faf7;
          color: #0da795;
          font-weight: 950;
        }

        .security-line i {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #8091a6;
        }

        .visual-side {
          position: relative;
          z-index: 2;
          min-width: 0;
        }

        .glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(18px);
          pointer-events: none;
        }

        .glow-teal {
          width: 320px;
          height: 320px;
          right: 0;
          top: -50px;
          background: rgba(42, 217, 201, 0.17);
        }

        .glow-purple {
          width: 330px;
          height: 330px;
          right: -60px;
          bottom: -50px;
          background: rgba(112, 80, 239, 0.11);
        }

        .dashboard-preview {
          position: relative;
          z-index: 3;
          width: 100%;
          min-height: 620px;
          display: grid;
          grid-template-columns: 175px minmax(0, 1fr);
          overflow: hidden;
          border: 1px solid #dfe8f1;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 28px 70px rgba(22, 44, 82, 0.14);
        }

        .preview-sidebar {
          display: flex;
          flex-direction: column;
          padding: 22px 14px;
          background:
            radial-gradient(circle at 30% 10%, rgba(31, 165, 142, .14), transparent 25%),
            linear-gradient(180deg, #073f3d 0%, #0b4960 100%);
          color: #fff;
        }

        .preview-logo-wrap {
          padding: 0 0 14px;
        }

        .preview-logo-img {
          width: 142px;
          height: 54px;
          object-fit: contain;
          object-position: left center;
          border-radius: 10px;
          background: #fff;
        }

        .preview-product-name {
          margin: 0 0 20px;
          color: rgba(255,255,255,.78);
          text-align: center;
          font-size: 10px;
          font-weight: 850;
        }

        .preview-nav-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .preview-nav {
          min-height: 42px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 11px;
          background: rgba(255,255,255,.055);
          color: rgba(255,255,255,.92);
          font-size: 10px;
          font-weight: 850;
        }

        .preview-nav.active {
          background: linear-gradient(105deg, #0ab091, #0da989);
          box-shadow: 0 9px 18px rgba(0, 33, 39, .2);
        }

        .preview-trust {
          margin-top: auto;
          padding: 13px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 12px;
          background: rgba(255,255,255,.055);
        }

        .preview-trust-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 9px;
          font-weight: 850;
        }

        .preview-trust-row strong {
          font-size: 12px;
        }

        .trust-bar {
          height: 5px;
          margin: 9px 0 7px;
          overflow: hidden;
          border-radius: 99px;
          background: rgba(255,255,255,.13);
        }

        .trust-bar span {
          display: block;
          width: 83%;
          height: 100%;
          background: linear-gradient(90deg, #f3d44c, #22d89c);
        }

        .preview-trust small {
          color: rgba(255,255,255,.58);
          font-size: 7px;
        }

        .preview-main {
          min-width: 0;
          padding: 18px;
          background: linear-gradient(180deg, #f8fbfd 0%, #f1f6fb 100%);
        }

        .preview-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 185px;
          gap: 18px;
          padding: 20px;
          border-radius: 18px;
          background:
            radial-gradient(circle at 92% 14%, rgba(72,194,255,.28), transparent 33%),
            linear-gradient(110deg, #373b85 0%, #4d41e1 52%, #3daff0 100%);
          color: #fff;
        }

        .preview-hero > div:first-child > span {
          display: block;
          margin-bottom: 6px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .06em;
          color: rgba(255,255,255,.8);
        }

        .preview-hero h2 {
          margin: 0;
          font-size: 21px;
          line-height: 1.1;
          letter-spacing: -.03em;
        }

        .preview-hero p {
          margin: 8px 0 0;
          font-size: 9px;
          line-height: 1.55;
          color: rgba(255,255,255,.84);
        }

        .health-card {
          padding: 14px;
          border-radius: 15px;
          background: rgba(255,255,255,.18);
          backdrop-filter: blur(3px);
        }

        .health-card small,
        .health-card strong,
        .health-card span {
          display: block;
        }

        .health-card small {
          font-size: 8px;
          color: rgba(255,255,255,.82);
        }

        .health-card strong {
          margin-top: 4px;
          font-size: 34px;
          line-height: 1;
        }

        .health-card span {
          margin-top: 5px;
          font-size: 8px;
        }

        .health-bar {
          height: 6px;
          margin-top: 12px;
          overflow: hidden;
          border-radius: 99px;
          background: rgba(255,255,255,.22);
        }

        .health-bar i {
          display: block;
          width: 78%;
          height: 100%;
          background: linear-gradient(90deg, #52b4ff, #00d8a7);
        }

        .preview-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .preview-kpis article,
        .finance-card,
        .risk-card,
        .patient-card,
        .trend-card {
          border: 1px solid #e2e9f1;
          background: #fff;
          box-shadow: 0 8px 22px rgba(24, 46, 78, .04);
        }

        .preview-kpis article {
          min-width: 0;
          padding: 12px;
          border-radius: 13px;
        }

        .preview-kpis small,
        .preview-kpis strong,
        .preview-kpis span {
          display: block;
        }

        .preview-kpis small {
          color: #66778e;
          font-size: 8px;
          font-weight: 850;
        }

        .preview-kpis strong {
          margin-top: 6px;
          color: #0d1e49;
          font-size: 20px;
          line-height: 1.05;
        }

        .preview-kpis span {
          margin-top: 6px;
          color: #8b99aa;
          font-size: 7px;
        }

        .preview-finance-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .finance-card,
        .risk-card,
        .patient-card {
          min-width: 0;
          min-height: 138px;
          padding: 12px;
          border-radius: 13px;
        }

        .finance-card small,
        .finance-card strong,
        .finance-card span,
        .risk-card small,
        .risk-card strong,
        .risk-card span,
        .patient-card small,
        .patient-card strong,
        .patient-card span {
          display: block;
        }

        .finance-card small,
        .risk-card small,
        .patient-card small {
          color: #596a83;
          font-size: 8px;
          font-weight: 850;
        }

        .finance-card strong,
        .risk-card strong,
        .patient-card strong {
          margin-top: 8px;
          color: #101f4c;
          font-size: 20px;
          line-height: 1.05;
        }

        .finance-card span,
        .risk-card span,
        .patient-card span {
          margin-top: 7px;
          color: #8a98aa;
          font-size: 7px;
        }

        .risk-bars {
          height: 54px;
          display: flex;
          align-items: flex-end;
          gap: 5px;
          margin-top: 10px;
        }

        .risk-bars i {
          flex: 1;
          border-radius: 5px 5px 2px 2px;
        }

        .risk-bars .b1 { height: 12px; background: #e9edf3; }
        .risk-bars .b2 { height: 20px; background: #ffd073; }
        .risk-bars .b3 { height: 48px; background: #9148ed; }
        .risk-bars .b4 { height: 31px; background: #6f7d95; }

        .donut {
          width: 58px;
          height: 58px;
          margin: 7px auto 0;
          border-radius: 50%;
          background: conic-gradient(#507cf3 0 47%, #09b7a6 47% 70%, #a139ef 70% 93%, #6430d8 93%);
          position: relative;
        }

        .donut::after {
          content: "";
          position: absolute;
          inset: 12px;
          border-radius: 50%;
          background: #fff;
        }

        .trend-card {
          margin-top: 10px;
          padding: 13px 15px 8px;
          border-radius: 14px;
        }

        .trend-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .trend-head span,
        .trend-head h3 {
          display: block;
        }

        .trend-head span {
          color: #0d8a7f;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .trend-head h3 {
          margin: 3px 0 0;
          color: #18294d;
          font-size: 13px;
        }

        .trend-head small {
          color: #8a98aa;
          font-size: 7px;
        }

        .trend-card svg {
          width: 100%;
          height: 115px;
          margin-top: 3px;
          overflow: visible;
        }

        @media (max-width: 1180px) {
          .landing-shell {
            width: min(880px, 100%);
            grid-template-columns: 1fr;
          }

          .dashboard-preview {
            min-height: 560px;
          }
        }

        @media (max-width: 760px) {
          .landing-page {
            padding: 14px;
          }

          .landing-shell {
            padding: 26px 20px;
            border-radius: 24px;
          }

          .brand-logo {
            width: 180px;
            margin-bottom: 34px;
          }

          h1 {
            font-size: clamp(46px, 14vw, 64px);
          }

          .hero-description {
            font-size: 15px;
          }

          .hero-actions,
          .primary-action,
          .secondary-action {
            width: 100%;
          }

          .security-line {
            flex-wrap: wrap;
          }

          .dashboard-preview {
            grid-template-columns: 1fr;
          }

          .preview-sidebar {
            display: none;
          }

          .preview-hero {
            grid-template-columns: 1fr;
          }

          .preview-kpis,
          .preview-finance-row {
            grid-template-columns: repeat(2, minmax(0,1fr));
          }
        }
      `}</style>
    </main>
  );
}
