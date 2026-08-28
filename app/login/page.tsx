"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("demo@aycayazilim.com");
  const [password, setPassword] = useState("demo123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event?: FormEvent) {
    event?.preventDefault();

    if (!email.trim() || !password) {
      setMessage("Lütfen e-posta ve şifrenizi girin.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage("Giriş bilgilerinizi kontrol edin.");
        return;
      }

      const userId = data.user?.id;

      if (!userId) {
        setMessage("Kullanıcı bilgisi alınamadı.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError) {
        setMessage("Profil bilgisi alınamadı.");
        return;
      }

      window.location.href =
        profile?.role === "admin" ? "/admin" : "/dashboard";
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="brand-side">
        <div className="brand-orb brand-orb-one" />
        <div className="brand-orb brand-orb-two" />

        <div className="brand-content">
          <div className="logo-wrap">
            <img
              src="/ayca-logo.png"
              alt="AYÇA Yazılım"
              className="brand-logo"
            />
          </div>

          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">AYÇA INSIGHT</span>

              <h1>
                Eczanenizi
                <br />
                <strong>Verilerle</strong>
                <br />
                Yönetin.
              </h1>

              <p>
                Satış, stok, kârlılık, risk ve hasta hareketlerini tek analitik
                katmanda birleştirin. AYÇA, verilerinizi yalnızca raporlamaz;
                öncelikleri görünür hale getirir ve karar almayı kolaylaştırır.
              </p>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="visual-ring ring-one" />
              <div className="visual-ring ring-two" />
              <div className="visual-ring ring-three" />

              <div className="analytics-board">
                <div className="chart-donut">
                  <span />
                </div>

                <div className="chart-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>

                <div className="chart-mini-card mini-one">
                  <b />
                  <span />
                </div>

                <div className="chart-mini-card mini-two">
                  <b />
                  <span />
                </div>

                <div className="chart-line">
                  <svg viewBox="0 0 180 70">
                    <path
                      d="M4 55 C28 48, 36 22, 58 33 S90 58, 108 40 S138 18, 176 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon finance-icon">
                <span />
                <span />
                <span />
              </div>
              <strong>Finans</strong>
              <p>Ciro, kâr ve bağlı sermayeyi takip edin.</p>
            </article>

            <article className="feature-card">
              <div className="feature-icon stock-icon">◇</div>
              <strong>Stok</strong>
              <p>Riskleri erkenden görün, fazla ve ölü stoku yönetin.</p>
            </article>

            <article className="feature-card">
              <div className="feature-icon patient-icon">●●</div>
              <strong>Hasta</strong>
              <p>Hasta davranışlarını anlayın, reçete ihtiyaçlarını öngörün.</p>
            </article>
          </div>

          <div className="trust-strip">
            <span className="trust-shield">◇</span>
            <strong>Güvenli</strong>
            <i />
            <strong>Hızlı</strong>
            <i />
            <strong>Veriye dayalı</strong>
          </div>
        </div>
      </section>

      <section className="login-side">
        <div className="mobile-brand">
          <img
            src="/ayca-logo.png"
            alt="AYÇA Yazılım"
            className="mobile-logo"
          />
        </div>

        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-heading">
            <span>HOŞ GELDİNİZ</span>
            <h2>AYÇA Panel&apos;e giriş yapın</h2>
            <p>Hesabınıza devam etmek için bilgilerinizi girin.</p>
          </div>

          <label className="field">
            <span>E-posta adresi</span>
            <div className="input-wrap">
              <span className="field-icon">✉</span>
              <input
                value={email}
                type="email"
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@eczane.com"
                disabled={loading}
              />
            </div>
          </label>

          <label className="field">
            <span>Şifre</span>
            <div className="input-wrap">
              <span className="field-icon">▣</span>
              <input
                value={password}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifrenizi girin"
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? "Gizle" : "Göster"}
              </button>
            </div>
          </label>

          <div className="form-meta">
            <label className="remember">
              <input type="checkbox" defaultChecked />
              <span>Beni hatırla</span>
            </label>

            <span className="support-text">Şifremi mi unuttunuz?</span>
          </div>

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap →"}
          </button>

          {message && (
            <div className="login-alert" role="alert">
              {message}
            </div>
          )}

          <div className="login-divider">
            <span />
            <small>veya</small>
            <span />
          </div>

          <div className="security-note">
            <span className="security-icon">✓</span>
            <p>
              Güvenli oturum · Verileriniz yalnızca yetkili hesabınız üzerinden
              görüntülenir.
            </p>
          </div>

          <div className="card-footer">
            © {new Date().getFullYear()} AYÇA Yazılım
          </div>
        </form>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(560px, 0.98fr);
          background: #f5f8fc;
          color: #0b1d45;
        }

        .brand-side {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          padding: 38px 42px 34px;
          color: #ffffff;
          background:
            radial-gradient(circle at 72% 46%, rgba(35, 87, 185, 0.33), transparent 31%),
            radial-gradient(circle at 96% 92%, rgba(85, 56, 210, 0.2), transparent 29%),
            linear-gradient(150deg, #041a3d 0%, #061f49 45%, #0b2d61 100%);
        }

        .brand-orb {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(16px);
        }

        .brand-orb-one {
          width: 420px;
          height: 420px;
          left: -210px;
          bottom: -160px;
          background: rgba(0, 179, 255, 0.06);
        }

        .brand-orb-two {
          width: 360px;
          height: 360px;
          right: -180px;
          top: -160px;
          background: rgba(115, 76, 255, 0.08);
        }

        .brand-content {
          position: relative;
          z-index: 2;
          width: min(760px, 100%);
          min-height: calc(100vh - 72px);
          display: flex;
          flex-direction: column;
        }

        .logo-wrap {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
        }

        .brand-logo {
          width: 260px;
          max-height: 88px;
          object-fit: contain;
          object-position: left center;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(270px, 0.95fr);
          align-items: center;
          gap: 18px;
          margin-top: auto;
          padding-top: 58px;
        }

        .hero-copy {
          min-width: 0;
        }

        .eyebrow,
        .login-heading > span {
          display: block;
          margin-bottom: 18px;
          color: #39dfcf;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.18em;
        }

        .eyebrow {
          margin-bottom: 20px;
          font-size: clamp(15px, 1.15vw, 18px);
          font-weight: 950;
          letter-spacing: 0.22em;
          text-shadow: 0 0 22px rgba(57, 223, 207, 0.16);
        }

        .hero-copy h1 {
          margin: 0;
          font-size: clamp(58px, 5.1vw, 84px);
          line-height: 0.94;
          letter-spacing: -0.055em;
          font-weight: 900;
        }

        .hero-copy h1 strong {
          display: inline-block;
          margin: 6px 0;
          font-weight: 950;
          background: linear-gradient(90deg, #31c6f7, #6fe6dc 45%, #9b7cff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-copy p {
          max-width: 580px;
          margin: 28px 0 0;
          color: rgba(228, 238, 255, 0.8);
          font-size: 17px;
          line-height: 1.72;
        }

        .hero-visual {
          position: relative;
          height: 330px;
          display: grid;
          place-items: center;
        }

        .visual-ring {
          position: absolute;
          border: 1px solid rgba(44, 154, 255, 0.22);
          border-radius: 50%;
        }

        .ring-one {
          width: 310px;
          height: 310px;
        }

        .ring-two {
          width: 250px;
          height: 250px;
        }

        .ring-three {
          width: 190px;
          height: 190px;
        }

        .analytics-board {
          position: relative;
          width: 300px;
          height: 220px;
          transform: perspective(900px) rotateY(-10deg) rotateX(2deg);
          border: 1px solid rgba(65, 161, 255, 0.18);
          border-radius: 24px;
          background:
            linear-gradient(145deg, rgba(20, 69, 145, 0.86), rgba(8, 40, 91, 0.92));
          box-shadow:
            0 26px 70px rgba(0, 9, 31, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .chart-donut {
          position: absolute;
          top: 24px;
          left: 24px;
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: conic-gradient(#28dcce 0 35%, #1389ff 35% 72%, rgba(255,255,255,.08) 72%);
          padding: 13px;
          box-shadow: 0 0 35px rgba(42, 204, 255, 0.14);
        }

        .chart-donut span {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #0b2d66;
        }

        .chart-bars {
          position: absolute;
          top: 34px;
          right: 30px;
          height: 64px;
          display: flex;
          align-items: flex-end;
          gap: 7px;
        }

        .chart-bars i {
          width: 10px;
          border-radius: 6px 6px 2px 2px;
          background: linear-gradient(to top, #166ef4, #35c9ff);
        }

        .chart-bars i:nth-child(1) { height: 24px; }
        .chart-bars i:nth-child(2) { height: 42px; }
        .chart-bars i:nth-child(3) { height: 58px; }
        .chart-bars i:nth-child(4) { height: 34px; }
        .chart-bars i:nth-child(5) { height: 50px; }

        .chart-mini-card {
          position: absolute;
          left: 22px;
          width: 82px;
          height: 44px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px;
          border-radius: 12px;
          background: rgba(17, 70, 151, 0.7);
        }

        .chart-mini-card b {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #27e0d3;
          box-shadow: 0 0 18px rgba(39, 224, 211, 0.48);
        }

        .chart-mini-card span {
          width: 42px;
          height: 5px;
          border-radius: 99px;
          background: rgba(255,255,255,.17);
        }

        .mini-one { top: 112px; }
        .mini-two { top: 163px; }

        .chart-line {
          position: absolute;
          right: 18px;
          bottom: 18px;
          width: 172px;
          height: 80px;
          padding: 8px;
          border-radius: 14px;
          background: rgba(7, 34, 82, 0.72);
          color: #27d2ff;
        }

        .chart-line svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          margin-top: 34px;
          padding: 22px 8px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          background: rgba(255,255,255,.025);
        }

        .feature-card {
          min-width: 0;
          padding: 0 22px;
        }

        .feature-card + .feature-card {
          border-left: 1px solid rgba(255,255,255,.08);
        }

        .feature-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
          border: 1px solid rgba(78, 205, 255, 0.18);
          border-radius: 15px;
          background: rgba(21, 91, 167, 0.28);
          color: #41dbe3;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
          font-weight: 900;
        }

        .finance-icon {
          align-items: flex-end;
          gap: 4px;
          padding: 12px;
        }

        .finance-icon span {
          width: 6px;
          border-radius: 5px 5px 2px 2px;
          background: linear-gradient(to top, #18a6f2, #4ae7d9);
        }

        .finance-icon span:nth-child(1) { height: 14px; }
        .finance-icon span:nth-child(2) { height: 25px; }
        .finance-icon span:nth-child(3) { height: 34px; }

        .stock-icon {
          font-size: 35px;
          color: #57a6ff;
        }

        .patient-icon {
          font-size: 14px;
          letter-spacing: -2px;
          color: #a582ff;
        }

        .feature-card strong {
          display: block;
          font-size: 18px;
          color: #ffffff;
        }

        .feature-card p {
          margin: 8px 0 0;
          color: rgba(224, 235, 251, 0.72);
          font-size: 13px;
          line-height: 1.58;
        }

        .trust-strip {
          width: fit-content;
          max-width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 30px;
          padding: 12px 18px;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 999px;
          background: rgba(255,255,255,.02);
          color: rgba(235, 242, 255, 0.88);
        }

        .trust-strip strong {
          font-size: 12px;
          font-weight: 800;
        }

        .trust-strip i {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #2fdaca;
        }

        .trust-shield {
          color: #32e0d0;
          font-size: 17px;
        }

        .login-side {
          min-height: 100vh;
          display: flex;
          align-items: stretch;
          justify-content: center;
          padding: 42px;
          background:
            radial-gradient(circle at 78% 16%, rgba(38, 183, 230, 0.08), transparent 28%),
            linear-gradient(180deg, #f8fbfe 0%, #f5f8fc 100%);
        }

        .mobile-brand {
          display: none;
        }

        .login-card {
          width: min(720px, 100%);
          min-height: calc(100vh - 84px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(48px, 5vw, 78px);
          border: 1px solid #e0e8f1;
          border-radius: 30px;
          background: rgba(255,255,255,.97);
          box-shadow: 0 28px 90px rgba(15, 31, 68, 0.1);
        }

        .login-heading {
          margin-bottom: 34px;
        }

        .login-heading > span {
          margin-bottom: 16px;
          color: #0d8d81;
        }

        .login-heading h2 {
          margin: 0;
          color: #0c1d46;
          font-size: clamp(34px, 2.5vw, 46px);
          line-height: 1.08;
          letter-spacing: -0.045em;
        }

        .login-heading p {
          margin: 14px 0 0;
          color: #74849f;
          font-size: 15px;
          line-height: 1.6;
        }

        .field {
          display: block;
          margin-top: 22px;
        }

        .field > span {
          display: block;
          margin-bottom: 9px;
          color: #34445f;
          font-size: 13px;
          font-weight: 850;
        }

        .input-wrap {
          min-height: 70px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 0 19px;
          border: 1px solid #dbe4ed;
          border-radius: 16px;
          background: #fbfdff;
          transition: 160ms ease;
        }

        .input-wrap:focus-within {
          border-color: #1aa99f;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(26,169,159,.08);
        }

        .field-icon {
          color: #8c9bb4;
          font-size: 17px;
        }

        .input-wrap input {
          width: 100%;
          min-width: 0;
          height: 68px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #0d1e45;
          font: inherit;
          font-size: 15px;
        }

        .password-toggle {
          flex: 0 0 auto;
          border: 0;
          background: transparent;
          color: #694bd9;
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
        }

        .form-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin: 20px 0 28px;
        }

        .remember {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #65758f;
          font-size: 13px;
        }

        .remember input {
          width: 16px;
          height: 16px;
          accent-color: #12a494;
        }

        .support-text {
          color: #75839b;
          font-size: 12px;
          font-weight: 700;
        }

        .login-button {
          width: 100%;
          min-height: 68px;
          border: 0;
          border-radius: 16px;
          background: linear-gradient(105deg, #0fa28f 0%, #169da9 46%, #6848dc 100%);
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 18px 34px rgba(17, 132, 150, 0.16);
          font-size: 17px;
          font-weight: 900;
        }

        .login-button:disabled {
          cursor: wait;
          opacity: 0.66;
        }

        .login-alert {
          margin-top: 16px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 13px;
          background: #fff7f7;
          color: #b42318;
          font-size: 12px;
          line-height: 1.5;
        }

        .login-divider {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 18px;
          margin: 34px 0 26px;
          color: #9aa6b8;
        }

        .login-divider span {
          height: 1px;
          background: #e5eaf0;
        }

        .login-divider small {
          font-size: 12px;
        }

        .security-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          color: #8090a7;
        }

        .security-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #eef5f9;
          color: #5a7396;
          font-size: 13px;
          font-weight: 900;
        }

        .security-note p {
          margin: 5px 0 0;
          font-size: 12px;
          line-height: 1.55;
        }

        .card-footer {
          margin-top: 36px;
          padding-top: 24px;
          border-top: 1px solid #edf1f5;
          color: #8d99ad;
          text-align: center;
          font-size: 11px;
        }

        @media (max-width: 1220px) {
          .login-page {
            grid-template-columns: minmax(0, 1fr) minmax(500px, .95fr);
          }

          .hero-grid {
            grid-template-columns: 1fr;
          }

          .hero-visual {
            display: none;
          }
        }

        @media (max-width: 920px) {
          .login-page {
            display: block;
          }

          .brand-side {
            display: none;
          }

          .login-side {
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            padding: 24px 18px;
          }

          .mobile-brand {
            width: min(720px, 100%);
            display: flex;
            margin: 0 auto 18px;
          }

          .mobile-logo {
            width: 180px;
            height: auto;
          }

          .login-card {
            width: min(720px, 100%);
            min-height: 0;
            margin: auto;
            padding: 36px 26px;
            border-radius: 24px;
          }
        }

        @media (max-width: 560px) {
          .login-side {
            padding: 18px 14px;
          }

          .login-card {
            padding: 28px 20px;
          }

          .login-heading h2 {
            font-size: 30px;
          }

          .form-meta {
            align-items: flex-start;
            flex-direction: column;
          }

          .input-wrap {
            min-height: 60px;
          }

          .input-wrap input {
            height: 58px;
          }

          .login-button {
            min-height: 60px;
          }
        }
      `}</style>
    </main>
  );
}