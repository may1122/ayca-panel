"use client";

type AnalysisLoaderProps = {
  progress: number;
  activeStep: number;
  tip: string;
};

const analysisSteps = [
  "Envanter dosyası okunuyor",
  "Satış hareketleri işleniyor",
  "Ürün verileri eşleştiriliyor",
  "Finansal göstergeler hesaplanıyor",
  "Risk motoru çalıştırılıyor",
  "AYÇA yönetici özeti hazırlanıyor",
];

export default function AnalysisLoader({ progress, activeStep, tip }: AnalysisLoaderProps) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="ayca-analysis-overlay" role="status" aria-live="polite" aria-label="Analiz yapılıyor">
      <div className="ayca-analysis-panel">
        <div className="ayca-analysis-orbit" aria-hidden="true">
          <span className="orbit-ring orbit-ring-one" />
          <span className="orbit-ring orbit-ring-two" />
          <span className="orbit-core">A</span>
          <i className="orbit-dot orbit-dot-one" />
          <i className="orbit-dot orbit-dot-two" />
          <i className="orbit-dot orbit-dot-three" />
        </div>

        <span className="ayca-analysis-kicker">AYÇA ANALİZ MOTORU</span>
        <h2>{safeProgress >= 100 ? "Analiz tamamlandı" : "Verileriniz analiz ediliyor"}</h2>
        <p>
          {safeProgress >= 100
            ? "Sonuç ekranınız hazırlanıyor."
            : "Stok, satış, finans ve risk verileri tek bir karar destek özetine dönüştürülüyor."}
        </p>

        <div className="ayca-analysis-progress-head">
          <span>İşlem durumu</span>
          <strong>%{safeProgress}</strong>
        </div>
        <div className="ayca-analysis-progress" aria-hidden="true">
          <i style={{ width: `${safeProgress}%` }} />
        </div>

        <div className="ayca-analysis-steps">
          {analysisSteps.map((step, index) => {
            const isDone = safeProgress >= 100 || index < activeStep;
            const isActive = safeProgress < 100 && index === activeStep;

            return (
              <div key={step} className={`${isDone ? "done" : ""} ${isActive ? "active" : ""}`.trim()}>
                <span>{isDone ? "✓" : isActive ? "●" : "○"}</span>
                <p>{step}</p>
              </div>
            );
          })}
        </div>

        <div className="ayca-analysis-tip">
          <span>💡 AYÇA Bilgisi</span>
          <p>{tip}</p>
        </div>
      </div>
    </div>
  );
}