"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { supabase } from "../../lib/supabaseClient";
import AnalysisLoader from "../../components/animations/AnalysisLoader";
import AnimatedPage from "../../components/animations/AnimatedPage";

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
  "Günlük Tüketim"?: number;
  "Stok Gün Karşılığı"?: number | null;
  "Hedef Stok": number;
  "Önerilen Sipariş": number;
  "Tahmini Sipariş Tutarı": number;
  Öncelik: string;
};

type StockRunoutProduct = {
  product_name: string;
  stock: number;
  sold_quantity: number;
  daily_consumption: number;
  estimated_runout_days: number;
  status: string;
};

type DeadStockProduct = {
  product_name: string;
  stock: number;
  stock_value: number;
  sold_quantity: number;
  recommended_action: string;
};

type ExpiryProduct = {
  product_name: string;
  expiry_date: string;
  days_left: number;
  stock: number;
  stock_value: number;
  status: string;
  supplier: string;
  shelf: string;
};

type MorningBriefing = {
  success: boolean;
  score: number;
  status: string;
  score_items: Record<string, number>;
  confidence_score?: number;
  data_warnings?: string[];
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

type DoctorMetric = {
  doctor_name: string;
  prescription_count?: number;
  transaction_count?: number;
  turnover?: number;
  average_prescription?: number;
};

type PatientMetric = {
  patient_name: string;
  patient_name_full?: string;
  segment?: string;
  visit_count?: number;
  turnover?: number;
  last_visit?: string;
  risk_level?: string;
};

type InstitutionMetric = {
  institution_name: string;
  prescription_count?: number;
  transaction_count?: number;
  turnover?: number;
  average_sale?: number;
};

type PrescriptionMetric = {
  prescription_type: string;
  count: number;
  turnover?: number;
  alert_count?: number;
};

type CopilotTab =
  "overview" | "stock" | "finance" | "doctor" | "patient" | "ask";

type CopilotMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

type DecisionSummary = {
  success: boolean;
  priority_score: number;
  priority: string;
  reason_codes: string[];
  recommended_action: string;
  confidence_score: number;
  summary: {
    zero_stock_count: number;
    critical_stock_count: number;
    warning_stock_count: number;
    over_stock_count: number;
    dead_stock_count: number;
    expiry_warning_count: number;
    expired_count: number;
    suggestion_count: number;
    estimated_order_budget: number;
  };
};

type AnalyzeResult = {
  success: boolean;
  analysis_status?: "complete" | "partial" | "failed";
  analysis_confidence_score?: number;
  analysis_checks?: Record<string, boolean>;
  analysis_failed_engines?: string[];
  analysis_warnings?: string[];
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
    warning_stock_count?: number;
    dead_stock_count?: number;
    dead_stock_value?: number;
    risk_score?: number;
    risk_products?: RiskProduct[];
    capital_products?: CapitalProduct[];
    stock_runout_products?: StockRunoutProduct[];
    dead_stock_products?: DeadStockProduct[];
  };
  expiry_metrics?: {
    success?: boolean;
    error?: string;
    warning_count?: number;
    expired_count?: number;
    risk_stock_value?: number;
    nearest_expiry_days?: number | null;
    products?: ExpiryProduct[];
  };
  files?: {
    inventory?: { storage_path?: string };
    sales?: { storage_path?: string };
    product_sales?: { storage_path?: string };
  };
  morning_briefing?: MorningBriefing | null;
  decision_summary?: DecisionSummary | null;
  patient_metrics?: {
    success?: boolean;
    health_score?: number;
    active_patient_count?: number;
    vip_patient_count?: number;
    lost_patient_risk_count?: number;
    doctors?: DoctorMetric[];
    patients?: PatientMetric[];
    institutions?: InstitutionMetric[];
    prescriptions?: PrescriptionMetric[];
  } | null;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");
const API_URL = `${API_BASE_URL}/analyze/`;
const REPORT_URL = `${API_BASE_URL}/analyze/report`;

const modules = [
  "🏠 Dashboard",
  "☀️ Sabah Brifingi",
  "📦 Operasyon Merkezi",
  "💰 Finans Merkezi",
  "🚨 Risk Merkezi",
  "⏱️ Stok Bitiş Tahmini",
  "⏳ Miad Takibi",
  "💀 Ölü Stok Analizi",
  "👥 Hasta & Reçete Merkezi",
  "🤖 AYÇA Copilot",
  "📊 Raporlar",
];

export default function DashboardPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [activeModule, setActiveModule] = useState("🏠 Dashboard");
  const [patientTab, setPatientTab] = useState<
    "doctor" | "patient" | "institution" | "prescription"
  >("doctor");
  const [showPatientNames, setShowPatientNames] = useState(false);
  const [copilotTab, setCopilotTab] = useState<CopilotTab>("overview");
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Merhaba, ben AYÇA Copilot. Stok, finans, risk, doktor ve hasta verileriniz hakkında soru sorabilirsiniz.",
    },
  ]);

  function handlePatientNameVisibility() {
    if (showPatientNames) {
      setShowPatientNames(false);
      return;
    }

    const approved = window.confirm(
      "KVKK kapsamında hasta isimleri hassas veridir.\n\n" +
        "Hasta isimlerini görüntülemek istediğinize emin misiniz?",
    );

    if (approved) {
      setShowPatientNames(true);
    }
  }

  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisTipIndex, setAnalysisTipIndex] = useState(0);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(
    null,
  );


  const analysisTips = [
    "AYÇA, stok ve satış hareketlerini birlikte değerlendirerek karar önerileri oluşturur.",
    "Kritik stok sinyalleri satış hızına göre önceliklendirilir.",
    "Fazla stok analizi, bağlı sermayeyi görünür hale getirir.",
    "Sipariş önerileri yalnızca miktarı değil, tahmini bütçe etkisini de hesaplar.",
  ];

  useEffect(() => {
    if (!isAnalyzing) return;

    const progressTimer = window.setInterval(() => {
      setAnalysisProgress((currentProgress) => {
        if (currentProgress >= 88) return currentProgress;

        const increment =
          currentProgress < 35 ? 4 : currentProgress < 65 ? 2 : 1;

        return Math.min(88, currentProgress + increment);
      });
    }, 420);

    const tipTimer = window.setInterval(() => {
      setAnalysisTipIndex(
        (currentIndex) => (currentIndex + 1) % analysisTips.length,
      );
    }, 2600);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(tipTimer);
    };
  }, [isAnalyzing, analysisTips.length]);

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
        .select("company_id, full_name")
        .eq("id", userData.user.id)
        .single();

      setFullName(profile?.full_name ?? "");

      if (profile?.company_id) {
        setCompanyId(profile.company_id);

        const { data: companyData } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profile.company_id)
          .single();

        setCompany(companyData);

        // Historical analysis data must not be shown on initial page load.
        setMetrics(null);
      }
    }

    loadDashboard();
  }, []);

  async function uploadFile(
    file: File | null,
    fileType: "inventory" | "sales" | "product",
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
        "Analiz için Envanter, Satış ve Ürün Satış dosyalarının üçünü de seçiniz.",
      );
      return;
    }

    try {
      setAnalysisProgress(6);
      setAnalysisStep(0);
      setAnalysisTipIndex(0);
      setIsAnalyzing(true);

      const inventoryPath = await uploadFile(inventoryFile, "inventory");

      if (!inventoryPath) {
        return;
      }

      setAnalysisProgress(24);
      setAnalysisStep(1);

      const salesPath = await uploadFile(salesFile, "sales");

      if (!salesPath) {
        return;
      }

      setAnalysisProgress(42);
      setAnalysisStep(2);

      const productPath = await uploadFile(productFile, "product");

      if (!productPath) {
        return;
      }

      setAnalysisProgress(58);
      setAnalysisStep(3);

      setAnalysisProgress(70);
      setAnalysisStep(4);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        alert("Oturum bulunamadı. Lütfen tekrar giriş yapınız.");
        return;
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
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
          typeof result === "object" && result !== null && "detail" in result
            ? String(result.detail)
            : "Analiz sırasında hata oluştu.";

        alert(errorMessage);
        return;
      }

      setAnalysisProgress(92);
      setAnalysisStep(5);
      setAnalyzeResult(result);

      const latestMetrics = Array.isArray(result.dashboard_metrics)
        ? result.dashboard_metrics[0]
        : result.dashboard_metrics;

      if (latestMetrics) {
        setMetrics(latestMetrics);
      }

      setAnalysisProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 850));

      alert("Analiz tamamlandı. Seçtiğiniz üç yeni dosya kullanıldı.");
    } catch (error) {
      console.error("Analyze error:", error);
      alert("Analiz başlatılırken hata oluştu.");
    } finally {
      setIsAnalyzing(false);
      window.setTimeout(() => {
        setAnalysisProgress(0);
        setAnalysisStep(0);
      }, 250);
    }
  }

  async function downloadAnalysisReport() {
    const files = analyzeResult?.files;
    const inventoryPath = files?.inventory?.storage_path;
    const salesPath = files?.sales?.storage_path;
    const productPath = files?.product_sales?.storage_path;

    if (!companyId || !inventoryPath || !salesPath || !productPath) {
      alert("Rapor için önce başarılı bir analiz yapınız.");
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        alert("Oturum bulunamadı. Lütfen tekrar giriş yapınız.");
        return;
      }

      const response = await fetch(REPORT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          company_id: companyId,
          inventory_path: inventoryPath,
          sales_path: salesPath,
          product_path: productPath,
        }),
      });

      if (!response.ok) {
        alert("Excel raporu oluşturulamadı.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AYCA_Insight_Rapor_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Report error:", error);
      alert("Excel raporu indirilirken hata oluştu.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function navigateToModule(moduleName: string) {
    setActiveModule(moduleName);

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const hasAnalysis = analyzeResult !== null;

  const estimatedOrderAmount =
    metrics?.estimated_order_budget ?? metrics?.estimated_order_amount;

  const orderSuggestions =
    analyzeResult?.order_suggestions?.top_suggestions ?? [];

  const morningBriefing = analyzeResult?.morning_briefing ?? null;

  const suggestionCount =
    analyzeResult?.order_suggestions?.suggestion_count ??
    morningBriefing?.summary.suggestion_count ??
    metrics?.ai_suggestion_count ??
    orderSuggestions.length;

  const analysisConfidenceScore =
    analyzeResult?.analysis_confidence_score ??
    morningBriefing?.confidence_score ??
    0;

  const decisionSummary = analyzeResult?.decision_summary ?? null;
  const decisionPriority = decisionSummary?.priority ?? "Analiz bekleniyor";
  const decisionPriorityScore = decisionSummary?.priority_score ?? 0;
  const decisionConfidenceScore =
    decisionSummary?.confidence_score ?? analysisConfidenceScore;
  const decisionAction =
    decisionSummary?.recommended_action ??
    morningBriefing?.top_actions?.[0] ??
    "Analiz tamamlandığında AYÇA bugünün öncelikli kararını burada oluşturur.";

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

  const riskProducts = (analyzeResult?.risk_metrics?.risk_products ?? []).map(
    (product) => ({
      name: product.product_name,
      category: product.risk_type,
      stock: product.stock,
      sales: product.sold_quantity,
      level: product.level,
      action: product.recommended_action,
    }),
  );

  const overStockCount = analyzeResult?.risk_metrics?.over_stock_count ?? null;
  const stockRunoutProducts = analyzeResult?.risk_metrics?.stock_runout_products ?? [];
  const deadStockProducts = analyzeResult?.risk_metrics?.dead_stock_products ?? [];
  const deadStockCount = analyzeResult?.risk_metrics?.dead_stock_count ?? 0;
  const deadStockValue = analyzeResult?.risk_metrics?.dead_stock_value ?? 0;
  const expiryMetrics = analyzeResult?.expiry_metrics ?? null;
  const expiryProducts = expiryMetrics?.products ?? [];

  const maximumFinanceRevenue = Math.max(
    ...financeDailyRevenue.map((item) => item.value),
    1,
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
          (overStockCount ?? 0),
      ),
    ),
  );

  const riskStatus =
    riskHealthScore >= 85
      ? "🟢 Kontrollü"
      : riskHealthScore >= 70
        ? "🟡 Dikkat"
        : "🔴 Yüksek Risk";

  const totalRiskItems =
    criticalStockCount + zeroStockCount + (overStockCount ?? 0);

  const healthScore = hasAnalysis ? (morningBriefing?.score ?? 0) : 0;

  const healthStatus =
    morningBriefing?.status ??
    (healthScore >= 90
      ? "Sağlıklı"
      : healthScore >= 75
        ? "Dikkat"
        : healthScore >= 50
          ? "Riskli"
          : "Kritik");

  const patientMetrics = analyzeResult?.patient_metrics ?? null;
  const doctorMetrics = patientMetrics?.doctors ?? [];
  const patientList = patientMetrics?.patients ?? [];
  const institutionMetrics = patientMetrics?.institutions ?? [];
  const prescriptionMetrics = patientMetrics?.prescriptions ?? [];

  const patientHealthScore = Math.max(
    0,
    Math.min(
      100,
      patientMetrics?.health_score ?? morningBriefing?.score ?? healthScore,
    ),
  );

  const activePatientCount =
    patientMetrics?.active_patient_count ?? patientList.length;
  const vipPatientCount =
    patientMetrics?.vip_patient_count ??
    patientList.filter((item) => item.segment?.toLowerCase().includes("vip"))
      .length;
  const lostPatientRiskCount =
    patientMetrics?.lost_patient_risk_count ??
    patientList.filter((item) =>
      ["yüksek", "kritik", "high", "critical"].some((level) =>
        item.risk_level?.toLowerCase().includes(level),
      ),
    ).length;
  const institutionCount = institutionMetrics.length;

  const totalTurnover = analyzeResult?.finance_metrics?.total_turnover ?? 0;
  const totalProfit = analyzeResult?.finance_metrics?.total_profit ?? 0;
  const profitMargin = analyzeResult?.finance_metrics?.profit_margin ?? 0;
  const averageSale = analyzeResult?.finance_metrics?.average_sale ?? 0;
  const transactionCount =
    analyzeResult?.finance_metrics?.transaction_count ?? 0;

  const topDoctor =
    [...doctorMetrics].sort(
      (first, second) => (second.turnover ?? 0) - (first.turnover ?? 0),
    )[0] ?? null;

  const topFinanceProduct =
    [...financeTopProducts].sort(
      (first, second) => second.turnover - first.turnover,
    )[0] ?? null;

  const topCapitalProduct =
    [...financeCapitalProducts].sort(
      (first, second) => second.value - first.value,
    )[0] ?? null;

  const copilotHealthScore = healthScore;
  const copilotStatus = healthStatus;
  const copilotStrong = morningBriefing?.strong ?? [];
  const copilotWatch = morningBriefing?.watch ?? [];
  const copilotUrgent = morningBriefing?.urgent ?? [];
  const briefingActions = morningBriefing?.top_actions?.length
    ? morningBriefing.top_actions
    : [
        `${criticalStockCount} kritik stok ürününü kontrol et.`,
        `${overStockCount ?? 0} fazla stok ürününü incele.`,
        `${suggestionCount} sipariş önerisini değerlendir.`,
      ];

  const copilotActions = Array.from(
    new Set(
      [
        decisionSummary?.recommended_action,
        ...briefingActions,
      ].filter((item): item is string => Boolean(item)),
    ),
  );

  function createCopilotAnswer(question: string): string {
    if (!analyzeResult) {
      return "Henüz analiz verisi bulunmuyor. Önce üç Excel dosyasını yükleyip Analizi Başlat butonuna basmalısınız.";
    }

    const normalizedQuestion = question.toLocaleLowerCase("tr-TR").trim();

    if (
      normalizedQuestion.includes("bugün") ||
      normalizedQuestion.includes("ne yapmalıyım") ||
      normalizedQuestion.includes("aksiyon")
    ) {
      return [
        `Bugünün önceliği: ${decisionPriority} (${decisionPriorityScore}/100).`,
        `Karar güveni: %${decisionConfidenceScore}.`,
        "Öncelikli aksiyonlar:",
        ...copilotActions
          .slice(0, 4)
          .map((action, index) => `${index + 1}. ${action}`),
      ].join("\n");
    }

    if (
      normalizedQuestion.includes("kritik stok") ||
      normalizedQuestion.includes("sıfır stok")
    ) {
      return `Şu anda ${zeroStockCount} sıfır stok ve ${criticalStockCount} kritik stok kaydı bulunuyor. Önce satış hızı yüksek kritik ürünleri kontrol etmenizi öneriyorum.`;
    }

    if (
      normalizedQuestion.includes("sipariş bütçe") ||
      normalizedQuestion.includes("sipariş tutar") ||
      normalizedQuestion.includes("ne kadar sipariş")
    ) {
      const budget =
        morningBriefing?.summary.estimated_order_budget ??
        estimatedOrderAmount ??
        0;
      return `Tahmini sipariş bütçesi ${budget.toLocaleString("tr-TR")} ₺. ${suggestionCount} ürün için sipariş önerisi bulunuyor.`;
    }

    if (
      normalizedQuestion.includes("sermaye") ||
      normalizedQuestion.includes("bağlı stok")
    ) {
      if (!topCapitalProduct) {
        return "Sermaye bağlayan ürün analizi için yeterli kayıt bulunamadı.";
      }
      return `En fazla sermaye bağlayan ürün ${topCapitalProduct.name}. Tahmini stok değeri ${topCapitalProduct.value.toLocaleString("tr-TR")} ₺.`;
    }

    if (
      normalizedQuestion.includes("finans") ||
      normalizedQuestion.includes("ciro") ||
      normalizedQuestion.includes("kâr") ||
      normalizedQuestion.includes("kar")
    ) {
      return `Toplam ciro ${totalTurnover.toLocaleString("tr-TR")} ₺, toplam kâr ${totalProfit.toLocaleString("tr-TR")} ₺ ve kâr marjı %${profitMargin.toLocaleString("tr-TR")}. Ortalama satış tutarı ${averageSale.toLocaleString("tr-TR")} ₺.`;
    }

    if (
      normalizedQuestion.includes("vip") ||
      normalizedQuestion.includes("hasta")
    ) {
      return `${activePatientCount} aktif hasta, ${vipPatientCount} VIP hasta ve ${lostPatientRiskCount} kayıp riski taşıyan hasta bulunuyor.`;
    }

    if (
      normalizedQuestion.includes("doktor") ||
      normalizedQuestion.includes("hekim")
    ) {
      if (!topDoctor) {
        return "Doktor analizi için satış hareketlerinde doktor veya hekim alanı bulunması gerekiyor.";
      }
      return `En yüksek ciro katkısını ${topDoctor.doctor_name} sağlıyor. Toplam katkısı ${(topDoctor.turnover ?? 0).toLocaleString("tr-TR")} ₺ ve reçete sayısı ${topDoctor.prescription_count ?? 0}.`;
    }

    if (
      normalizedQuestion.includes("risk") ||
      normalizedQuestion.includes("tehlike")
    ) {
      return `Genel risk skorunuz ${rawRiskScore}. ${criticalStockCount} kritik stok, ${zeroStockCount} sıfır stok ve ${overStockCount ?? 0} fazla stok kaydı bulunuyor.`;
    }

    if (
      normalizedQuestion.includes("en güçlü ürün") ||
      normalizedQuestion.includes("en çok satan") ||
      normalizedQuestion.includes("en iyi ürün")
    ) {
      if (!topFinanceProduct) {
        return "Ürün performansı için yeterli satış verisi bulunamadı.";
      }
      return `Ciro bakımından öne çıkan ürün ${topFinanceProduct.name}. Cirosu ${topFinanceProduct.turnover.toLocaleString("tr-TR")} ₺ ve satılan miktarı ${topFinanceProduct.sales}.`;
    }

    return `Genel sağlık skoru ${copilotHealthScore}/100 ve durum ${copilotStatus}. Bugünün karar önceliği ${decisionPriority} (${decisionPriorityScore}/100), karar güveni %${decisionConfidenceScore}. Daha net sonuç için “kritik stoklarım nasıl?”, “finansal durumum nasıl?” veya “bugün ne yapmalıyım?” şeklinde sorabilirsiniz.`;
  }

  function submitCopilotQuestion(question?: string) {
    const finalQuestion = (question ?? copilotQuestion).trim();
    if (!finalQuestion) return;

    const timestamp = Date.now();
    setCopilotMessages((currentMessages) => [
      ...currentMessages,
      { id: timestamp, role: "user", text: finalQuestion },
      {
        id: timestamp + 1,
        role: "assistant",
        text: createCopilotAnswer(finalQuestion),
      },
    ]);
    setCopilotQuestion("");
    setCopilotTab("ask");
  }

  return (
    <main className="insight-page">
      {isAnalyzing && (
        <AnalysisLoader
          progress={analysisProgress}
          activeStep={analysisStep}
          tip={analysisTips[analysisTipIndex]}
        />
      )}
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
            <h1>Günaydın, {fullName?.split(" ")[0] || "Hoş geldiniz"} 👋</h1>
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

        <section
          key={activeModule}
          className="active-module-title ayca-module-heading-enter"
        >
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
                      : activeModule === "⏱️ Stok Bitiş Tahmini"
                        ? "Satış hızına göre mevcut stokların tahmini kaç gün yeteceğini ve yakın bitiş risklerini görün."
                        : activeModule === "⏳ Miad Takibi"
                          ? "Kaynak verideki miad/SKT bilgilerine göre yaklaşan ve geçmiş son kullanma tarihlerini takip edin."
                          : activeModule === "💀 Ölü Stok Analizi"
                            ? "Hareketsiz veya düşük hareketli stoklarda bağlı sermayeyi ve önerilen aksiyonları inceleyin."
                            : activeModule === "👥 Hasta & Reçete Merkezi"
                              ? "Hasta sadakati, doktor katkısı, kurum performansı ve kontrollü reçete süreçlerini yönetin."
                              : activeModule === "🤖 AYÇA Copilot"
                                ? "Stok, finans, risk, doktor ve hasta verilerinizi tek bir yönetim danışmanıyla yorumlayın."
                                : activeModule === "📊 Raporlar"
                                  ? "Analiz sonuçlarını özetleyin ve Excel raporunu indirerek detaylı çıktıları dışa aktarın."
                                  : "AYÇA Insight analiz modülü."}
          </p>
        </section>

        {!hasAnalysis && activeModule !== "🏠 Dashboard" ? (
          <section className="insight-card">
            <h2>Analiz bekleniyor</h2>
            <p>
              Bu modüldeki verileri görmek için Dashboard üzerinden üç Excel
              dosyasını yükleyip Analizi Başlat butonuna basınız.
            </p>
            <button
              className="analysis-btn"
              type="button"
              onClick={() => navigateToModule("🏠 Dashboard")}
            >
              Dashboard&apos;a Dön
            </button>
          </section>
        ) : (
        <AnimatedPage animationKey={activeModule}>
        {activeModule === "🏠 Dashboard" && (
          <>
            <section className="dashboard-hero">
              <div>
                <span className="hero-kicker">CANLI YÖNETİCİ ÖZETİ</span>
                <h2>Eczanenizin bugünkü nabzı tek ekranda</h2>
                <p>
                  Stok, sipariş, risk ve aksiyonları birlikte okuyun. AYÇA
                  yalnızca veriyi göstermez; bugün ne yapmanız gerektiğini öne
                  çıkarır.
                </p>
                <div className="hero-badges">
                  <span>{hasAnalysis ? "● Veriler güncel" : "○ Veri bekleniyor"}</span>
                  <span>3 kaynak dosya</span>
                  <span>{hasAnalysis ? "Analiz hazır" : "Analiz bekleniyor"}</span>
                </div>
              </div>
              <button
                type="button"
                className="hero-score-card dashboard-navigation-card"
                onClick={() => navigateToModule("☀️ Sabah Brifingi")}
                aria-label="Sabah Brifingi modülünü aç"
              >
                <span>Eczane Sağlık Skoru</span>
                <strong>
                  {hasAnalysis ? healthScore : "-"}
                </strong>
                <small>
                  {hasAnalysis
                    ? `/100 · ${healthStatus}`
                    : "Analiz bekleniyor"}
                </small>
                <div className="score-track">
                  <i
                    style={{
                      width: `${hasAnalysis ? healthScore : 0}%`,
                    }}
                  />
                </div>
                <em className="navigation-hint">Brifingi aç →</em>
              </button>
            </section>

            <section className="insight-kpi-grid dashboard-kpis">
              <button
                type="button"
                className="insight-kpi kpi-blue dashboard-navigation-card"
                onClick={() => navigateToModule("🚨 Risk Merkezi")}
              >
                <b>⚠️</b>
                <span>Risk Skoru</span>
                <strong>{metrics?.risk_score ?? "-"}</strong>
                <p>Genel operasyon riski</p>
                <em className="navigation-hint">Riskleri incele →</em>
              </button>
              <button
                type="button"
                className="insight-kpi kpi-red dashboard-navigation-card"
                onClick={() => navigateToModule("📦 Operasyon Merkezi")}
              >
                <b>📦</b>
                <span>Kritik Stok</span>
                <strong>{metrics?.critical_stock_count ?? "-"}</strong>
                <p>Acil kontrol gerektiren ürün</p>
                <em className="navigation-hint">Ürünleri aç →</em>
              </button>
              <button
                type="button"
                className="insight-kpi kpi-orange dashboard-navigation-card"
                onClick={() => navigateToModule("📊 Raporlar")}
              >
                <b>🧪</b>
                <span>Veri Güveni</span>
                <strong>{hasAnalysis ? `%${analysisConfidenceScore}` : "-"}</strong>
                <p>Analiz motorlarının doğrulama oranı</p>
                <em className="navigation-hint">Detayları incele →</em>
              </button>
              <button
                type="button"
                className="insight-kpi kpi-green dashboard-navigation-card"
                onClick={() => navigateToModule("📦 Operasyon Merkezi")}
              >
                <b>🛒</b>
                <span>Sipariş Bütçesi</span>
                <strong>
                  {estimatedOrderAmount
                    ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
                <p>Önerilen toplam yatırım</p>
                <em className="navigation-hint">Siparişleri aç →</em>
              </button>
              <button
                type="button"
                className="insight-kpi kpi-purple dashboard-navigation-card"
                onClick={() => navigateToModule("🤖 AYÇA Copilot")}
              >
                <b>🤖</b>
                <span>AYÇA Önerileri</span>
                <strong>
                  {suggestionCount}
                </strong>
                <p>Karar destek aksiyonu</p>
                <em className="navigation-hint">Copilot'u aç →</em>
              </button>
            </section>

            <section className="dashboard-command-grid">
              <div className="insight-card command-card">
                <div className="section-heading">
                  <div>
                    <span>BUGÜNÜN ÖNCELİKLERİ</span>
                    <h2>AYÇA Ne Yapmalı Diyor?</h2>
                  </div>
                  <button onClick={() => navigateToModule("☀️ Sabah Brifingi")}>
                    Tüm brifingi aç →
                  </button>
                </div>
                <div className="priority-list">
                  {(morningBriefing?.top_actions?.length
                    ? morningBriefing.top_actions
                    : [
                        `${metrics?.critical_stock_count ?? 0} kritik stok ürününü kontrol et.`,
                        `${overStockCount ?? 0} fazla stok ürününün siparişini gözden geçir.`,
                        `${suggestionCount} sipariş önerisini bütçeye göre sırala.`,
                      ]
                  )
                    .slice(0, 4)
                    .map((item, index) => (
                      <div className="priority-item" key={index}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <p>{item}</p>
                        <b>→</b>
                      </div>
                    ))}
                </div>
              </div>

              <div className="insight-card pulse-card">
                <div className="section-heading">
                  <div>
                    <span>OPERASYON NABZI</span>
                    <h2>Risk Dağılımı</h2>
                  </div>
                </div>
                <div className="pulse-row">
                  <span>Kritik stok</span>
                  <strong>{metrics?.critical_stock_count ?? 0}</strong>
                  <i>
                    <em
                      style={{
                        width: `${Math.min(100, (metrics?.critical_stock_count ?? 0) * 8)}%`,
                      }}
                    />
                  </i>
                </div>
                <div className="pulse-row">
                  <span>Fazla stok</span>
                  <strong>{overStockCount ?? 0}</strong>
                  <i>
                    <em
                      style={{
                        width: `${Math.min(100, (overStockCount ?? 0) * 5)}%`,
                      }}
                    />
                  </i>
                </div>
                <div className="pulse-row">
                  <span>Sipariş fırsatı</span>
                  <strong>{suggestionCount}</strong>
                  <i>
                    <em
                      style={{
                        width: `${Math.min(100, suggestionCount * 5)}%`,
                      }}
                    />
                  </i>
                </div>
                <div className="manager-note">
                  <b>Yönetici yorumu</b>
                  <p>
                    {morningBriefing?.result ??
                      "Analiz tamamlandığında stok dengesi, nakit etkisi ve öncelikli aksiyon özeti burada oluşacak."}
                  </p>
                </div>
              </div>
            </section>

            <section className="dashboard-lower-grid">
              <div className="insight-card upload-card premium-upload">
                <div className="section-heading">
                  <div>
                    <span>VERİ MERKEZİ</span>
                    <h2>Analizi Yenile</h2>
                  </div>
                  <small>3 Excel kaynağı</small>
                </div>
                <div className="file-list compact-files">
                  <label>
                    <span>📚 Envanter</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) =>
                        setInventoryFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <small>
                      {inventoryFile ? inventoryFile.name : "Dosya seç"}
                    </small>
                  </label>
                  <label>
                    <span>🧾 Satış Hareketleri</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) =>
                        setSalesFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <small>{salesFile ? salesFile.name : "Dosya seç"}</small>
                  </label>
                  <label>
                    <span>📊 Ürün Toplamları</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) =>
                        setProductFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <small>
                      {productFile ? productFile.name : "Dosya seç"}
                    </small>
                  </label>
                </div>
                <button
                  className="analysis-btn"
                  onClick={startAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Analiz Yapılıyor..." : "🚀 Analizi Başlat"}
                </button>
              </div>

              <div className="insight-card opportunity-card">
                <div className="section-heading">
                  <div>
                    <span>FIRSAT RADARI</span>
                    <h2>Öne Çıkan Siparişler</h2>
                  </div>
                  <button
                    onClick={() => navigateToModule("📦 Operasyon Merkezi")}
                  >
                    Merkezi aç →
                  </button>
                </div>
                {orderSuggestions.length ? (
                  orderSuggestions.slice(0, 5).map((item, index) => (
                    <button
                      type="button"
                      className="opportunity-row dashboard-navigation-row"
                      key={index}
                      onClick={() => navigateToModule("📦 Operasyon Merkezi")}
                    >
                      <span
                        className={`priority-badge priority-${String(item["Öncelik"]).toLowerCase()}`}
                      >
                        {item["Öncelik"]}
                      </span>
                      <div>
                        <b>{item["Ürün Adı"]}</b>
                        <small>
                          Stok {item.Stok} · Satış {item["Satılan Adet"]}
                        </small>
                      </div>
                      <strong>{item["Önerilen Sipariş"]} ad.</strong>
                    </button>
                  ))
                ) : (
                  <div className="empty-state-rich">
                    <b>Analiz bekleniyor</b>
                    <p>
                      Sipariş fırsatları analizden sonra burada sıralanacak.
                    </p>
                  </div>
                )}
              </div>

              <div className="insight-card quick-card rich-quick">
                <div className="section-heading">
                  <div>
                    <span>HIZLI ERİŞİM</span>
                    <h2>Merkezler</h2>
                  </div>
                </div>
                <button onClick={() => navigateToModule("☀️ Sabah Brifingi")}>
                  <span>☀️</span>
                  <div>
                    <b>Sabah Brifingi</b>
                    <small>Günün aksiyon planı</small>
                  </div>
                  <em>→</em>
                </button>
                <button
                  onClick={() => navigateToModule("📦 Operasyon Merkezi")}
                >
                  <span>📦</span>
                  <div>
                    <b>Operasyon</b>
                    <small>Stok ve sipariş</small>
                  </div>
                  <em>→</em>
                </button>
                <button onClick={() => navigateToModule("🚨 Risk Merkezi")}>
                  <span>🚨</span>
                  <div>
                    <b>Risk Merkezi</b>
                    <small>Kritik sinyaller</small>
                  </div>
                  <em>→</em>
                </button>
                <button onClick={() => navigateToModule("🤖 AYÇA Copilot")}>
                  <span>🤖</span>
                  <div>
                    <b>AYÇA Copilot</b>
                    <small>Akıllı yorumlar</small>
                  </div>
                  <em>→</em>
                </button>
              </div>
            </section>
            <section className="insight-kpi-grid">
              <div className="insight-kpi">
                <span>Risk Skoru</span>
                <strong>{metrics?.risk_score ?? "-"}</strong>
                <p>
                  {metrics ? "Son analiz sonucu" : "Henüz analiz yapılmadı"}
                </p>
              </div>

              <div className="insight-kpi">
                <span>Kritik Stok</span>
                <strong>{metrics?.critical_stock_count ?? "-"}</strong>
                <p>
                  {metrics
                    ? "Kritik stoktaki ürün sayısı"
                    : "Henüz analiz yapılmadı"}
                </p>
              </div>

              <div className="insight-kpi">
                <span>Veri Güveni</span>
                <strong>{hasAnalysis ? `%${analysisConfidenceScore}` : "-"}</strong>
                <p>
                  {hasAnalysis
                    ? "Analiz motorlarının doğrulama oranı"
                    : "Henüz analiz yapılmadı"}
                </p>
              </div>

              <div className="insight-kpi">
                <span>Tahmini Sipariş Tutarı</span>
                <strong>
                  {estimatedOrderAmount
                    ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
                <p>
                  {metrics
                    ? "Önerilen sipariş bütçesi"
                    : "Henüz analiz yapılmadı"}
                </p>
              </div>

              <div className="insight-kpi">
                <span>AI Öneri Sayısı</span>
                <strong>{metrics?.ai_suggestion_count ?? "-"}</strong>
                <p>
                  {metrics ? "Üretilen öneri sayısı" : "Henüz analiz yapılmadı"}
                </p>
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
                  Kritik Stok :{" "}
                  <strong>{metrics?.critical_stock_count ?? "-"}</strong>
                </p>
                <p>
                  Fazla Stok : <strong>{overStockCount ?? "-"}</strong>
                </p>
                <p>
                  AI Önerileri :{" "}
                  <strong>{metrics?.ai_suggestion_count ?? "-"}</strong>
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
                    <small>
                      {inventoryFile ? inventoryFile.name : "Yüklenmedi"}
                    </small>
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
                    <small>
                      {productFile ? productFile.name : "Yüklenmedi"}
                    </small>
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
                    <p>
                      ✅ Risk skoru: <strong>{metrics.risk_score}</strong>
                    </p>
                    <p>
                      📦 Kritik stok:{" "}
                      <strong>{metrics.critical_stock_count}</strong> ürün
                    </p>
                    <p>
                      ⚠️ Yüksek stok: <strong>{overStockCount ?? "-"}</strong>{" "}
                      ürün
                    </p>
                    <p>
                      💰 Tahmini sipariş:{" "}
                      <strong>
                        {estimatedOrderAmount
                          ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                          : "-"}
                      </strong>
                    </p>
                    <p>
                      🤖 AI öneri sayısı:{" "}
                      <strong>{metrics.ai_suggestion_count ?? "-"}</strong>
                    </p>
                  </div>
                ) : (
                  <p>Henüz analiz yapılmadı.</p>
                )}
              </div>

              <div className="insight-card">
                <h2>Veri Kalitesi</h2>
                <p>
                  {metrics
                    ? "Veriler başarıyla analiz edildi."
                    : "Henüz analiz yapılmadı."}
                </p>
                <div className="donut-placeholder"></div>
              </div>

              <div className="insight-card quick-card">
                <h2>Hızlı Erişim</h2>
                <button onClick={() => navigateToModule("🤖 AYÇA Copilot")}>
                  AI Önerileri →
                </button>
                <button onClick={() => setActiveModule("📊 Raporlar")}>
                  Raporlar →
                </button>
                <button
                  onClick={() => navigateToModule("📦 Operasyon Merkezi")}
                >
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
                            {item["Tahmini Sipariş Tutarı"].toLocaleString(
                              "tr-TR",
                            )}{" "}
                            ₺
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

            <section className="briefing-hero">
              <div className="briefing-intro">
                <span className="hero-kicker">GÜNLÜK YÖNETİCİ BRİFİNGİ</span>
                <h2>Günaydın {fullName?.split(" ")[0] || ""}, bugün odak net.</h2>
                <p>
                  {morningBriefing?.result ??
                    "Analizi başlatın; AYÇA stok, finans ve risk sinyallerinden günlük aksiyon planınızı oluştursun."}
                </p>
                <div className="briefing-status">
                  <span>● Sistem hazır</span>
                  <span>{company?.name ?? "İdil Eczanesi"}</span>
                  <span>
                    {new Date().toLocaleDateString("tr-TR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <div className="briefing-score-panel">
                <small>BUGÜNKÜ SAĞLIK SKORU</small>
                <strong>{healthScore}</strong>
                <b>{healthStatus}</b>
                <div className="score-track light">
                  <i
                    style={{
                      width: `${healthScore}%`,
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="briefing-kpi-grid">
              <div>
                <span>⛔ Sıfır Stok</span>
                <strong>
                  {morningBriefing?.summary.zero_stock_count ??
                    analyzeResult?.risk_metrics?.zero_stock_count ??
                    0}
                </strong>
                <small>Satış kaybı riski</small>
              </div>
              <div>
                <span>⚠️ Kritik Stok</span>
                <strong>
                  {morningBriefing?.summary.critical_stock_count ??
                    metrics?.critical_stock_count ??
                    0}
                </strong>
                <small>Bugün kontrol et</small>
              </div>
              <div>
                <span>📦 Fazla Stok</span>
                <strong>
                  {morningBriefing?.summary.over_stock_count ??
                    overStockCount ??
                    0}
                </strong>
                <small>Bağlı sermaye</small>
              </div>
              <div>
                <span>🛒 Sipariş Önerisi</span>
                <strong>
                  {suggestionCount}
                </strong>
                <small>
                  {(
                    morningBriefing?.summary.estimated_order_budget ??
                    estimatedOrderAmount ??
                    0
                  ).toLocaleString("tr-TR")}{" "}
                  ₺ bütçe
                </small>
              </div>
              <div>
                <span>🧾 İşlem Sayısı</span>
                <strong>
                  {morningBriefing?.summary.transaction_count ?? "-"}
                </strong>
                <small>Analiz dönemi</small>
              </div>
              <div>
                <span>💰 Toplam Ciro</span>
                <strong>
                  {morningBriefing?.summary.total_turnover
                    ? `${morningBriefing.summary.total_turnover.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
                <small>Satış performansı</small>
              </div>
            </section>

            <section className="briefing-main-grid">
              <div className="insight-card action-plan-card">
                <div className="section-heading">
                  <div>
                    <span>ÖNCELİKLİ AKSİYONLAR</span>
                    <h2>Bugün Yapılacaklar</h2>
                  </div>
                  <b>{morningBriefing?.top_actions.length ?? 3} görev</b>
                </div>
                {(morningBriefing?.top_actions?.length
                  ? morningBriefing.top_actions
                  : [
                      "Kritik stok listesini kontrol et.",
                      "Sipariş önerilerini önceliğe göre değerlendir.",
                      "Fazla stok ürünlerinde alımı yavaşlat.",
                    ]
                ).map((item, index) => (
                  <div className="brief-task" key={index}>
                    <span>{index + 1}</span>
                    <div>
                      <b>{item}</b>
                      <small>
                        {index === 0
                          ? "Yüksek öncelik"
                          : index === 1
                            ? "Bugün"
                            : "Takip"}
                      </small>
                    </div>
                    <button>✓</button>
                  </div>
                ))}
              </div>

              <div className="insight-card score-breakdown-card">
                <div className="section-heading">
                  <div>
                    <span>SKOR KIRILIMI</span>
                    <h2>Eczane Sağlığı</h2>
                  </div>
                </div>
                {Object.entries(
                  morningBriefing?.score_items ?? {
                    "Stok Sağlığı": Math.max(
                      0,
                      100 - (metrics?.critical_stock_count ?? 0) * 5,
                    ),
                    "Risk Kontrolü": Math.max(
                      0,
                      100 - (metrics?.risk_score ?? 0) * 10,
                    ),
                    "Sipariş Dengesi": Math.max(
                      0,
                      100 - (overStockCount ?? 0) * 3,
                    ),
                    "Veri Kalitesi": metrics ? 100 : 35,
                  },
                ).map(([label, value]) => (
                  <div className="score-line" key={label}>
                    <div>
                      <span>{label}</span>
                      <strong>{value}/100</strong>
                    </div>
                    <i>
                      <em style={{ width: `${value}%` }} />
                    </i>
                  </div>
                ))}
              </div>
            </section>

            <section className="briefing-signal-grid">
              <div className="signal-column signal-green">
                <div className="signal-title">
                  <span>✅</span>
                  <div>
                    <b>Güçlü Yönler</b>
                    <small>Korunması gereken alanlar</small>
                  </div>
                </div>
                {(morningBriefing?.strong?.length
                  ? morningBriefing.strong
                  : [
                      "Veri yükleme altyapısı hazır.",
                      "Karar destek motorları aktif.",
                    ]
                ).map((x, i) => (
                  <p key={i}>{x}</p>
                ))}
              </div>
              <div className="signal-column signal-yellow">
                <div className="signal-title">
                  <span>🟡</span>
                  <div>
                    <b>Takip Edilecekler</b>
                    <small>Gün içinde kontrol</small>
                  </div>
                </div>
                {(morningBriefing?.watch?.length
                  ? morningBriefing.watch
                  : [
                      "Fazla stok ürünlerini izle.",
                      "Sipariş bütçesini nakit planıyla eşleştir.",
                    ]
                ).map((x, i) => (
                  <p key={i}>{x}</p>
                ))}
              </div>
              <div className="signal-column signal-red">
                <div className="signal-title">
                  <span>🔴</span>
                  <div>
                    <b>Acil Konular</b>
                    <small>Öncelikli müdahale</small>
                  </div>
                </div>
                {(morningBriefing?.urgent?.length
                  ? morningBriefing.urgent
                  : [
                      `${metrics?.critical_stock_count ?? 0} kritik stok sinyali bulunuyor.`,
                    ]
                ).map((x, i) => (
                  <p key={i}>{x}</p>
                ))}
              </div>
            </section>

            <section className="manager-result-banner">
              <div>
                <span>🤖 AYÇA YÖNETİCİ SONUCU</span>
                <h2>
                  {morningBriefing?.result ??
                    "Analizden sonra eczanenin güncel durumu ve en kritik yönetici kararı burada tek cümlede özetlenecek."}
                </h2>
              </div>
              <button onClick={() => navigateToModule("🤖 AYÇA Copilot")}>
                Copilot'a sor →
              </button>
            </section>
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
                    <strong>
                      {morningBriefing.summary.critical_stock_count}
                    </strong>
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
                      {morningBriefing.summary.estimated_order_budget.toLocaleString(
                        "tr-TR",
                      )}{" "}
                      ₺
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
                      ),
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
                <strong>{suggestionCount}</strong>
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

            <div className="table-wrapper" style={{ marginTop: 24 }}>
              <h2>⏱️ Stok Bitiş Tahmini</h2>
              <table>
                <thead><tr><th>Ürün</th><th>Stok</th><th>Dönem Satışı</th><th>Günlük Tüketim</th><th>Tahmini Bitiş</th><th>Durum</th></tr></thead>
                <tbody>
                  {stockRunoutProducts.length > 0 ? stockRunoutProducts.map((item, index) => (
                    <tr key={`${item.product_name}-${index}`}><td>{item.product_name}</td><td>{item.stock}</td><td>{item.sold_quantity}</td><td>{item.daily_consumption}</td><td>{item.estimated_runout_days} gün</td><td>{item.status}</td></tr>
                  )) : <tr><td colSpan={6}>Analiz sonrası 30 gün içinde bitebilecek ürünler burada görünecek.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeModule === "⏱️ Stok Bitiş Tahmini" && (
          <>
            <section className="insight-kpi-grid">
              <div className="insight-kpi risk-kpi risk-kpi-danger">
                <span>⏱️ 7 Gün İçinde Bitecek</span>
                <strong>
                  {
                    stockRunoutProducts.filter(
                      (item) => item.estimated_runout_days <= 7,
                    ).length
                  }
                </strong>
                <p>Acil stok aksiyonu gerektiren ürün</p>
              </div>

              <div className="insight-kpi risk-kpi risk-kpi-warning">
                <span>📦 30 Gün İçinde Bitecek</span>
                <strong>{stockRunoutProducts.length}</strong>
                <p>Yakın dönemde stok riski taşıyan ürün</p>
              </div>

              <div className="insight-kpi">
                <span>📉 En Yakın Bitiş</span>
                <strong>
                  {stockRunoutProducts.length > 0
                    ? `${Math.min(
                        ...stockRunoutProducts.map(
                          (item) => item.estimated_runout_days,
                        ),
                      )} gün`
                    : "-"}
                </strong>
                <p>Mevcut satış hızına göre tahmini süre</p>
              </div>

              <div className="insight-kpi">
                <span>🧮 Hesaplama</span>
                <strong>Stok / Günlük Tüketim</strong>
                <p>Analiz dönemindeki satış hızına göre</p>
              </div>
            </section>

            <section className="insight-card">
              <h2>⏱️ Stok Bitiş Tahmini</h2>
              <p>
                Mevcut stok ve analiz dönemindeki günlük tüketim hızına göre
                yakın dönemde bitebilecek ürünler.
              </p>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Durum</th>
                      <th>Ürün</th>
                      <th>Stok</th>
                      <th>Dönem Satışı</th>
                      <th>Günlük Tüketim</th>
                      <th>Tahmini Bitiş</th>
                    </tr>
                  </thead>

                  <tbody>
                    {stockRunoutProducts.length > 0 ? (
                      stockRunoutProducts.map((item, index) => (
                        <tr key={`${item.product_name}-${index}`}>
                          <td>{item.status}</td>
                          <td>{item.product_name}</td>
                          <td>{item.stock}</td>
                          <td>{item.sold_quantity}</td>
                          <td>{item.daily_consumption}</td>
                          <td>{item.estimated_runout_days} gün</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>
                          Yakın dönemde bitecek ürün bulunamadı veya henüz
                          analiz yapılmadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeModule === "⏳ Miad Takibi" && (
          <>
            <section className="insight-kpi-grid">
              <div className="insight-kpi risk-kpi risk-kpi-warning">
                <span>⏳ Miad Uyarısı</span>
                <strong>{expiryMetrics?.warning_count ?? "-"}</strong>
                <p>90 gün içinde miadı dolacak ürün</p>
              </div>
              <div className="insight-kpi risk-kpi risk-kpi-danger">
                <span>🚫 Miadı Geçmiş</span>
                <strong>{expiryMetrics?.expired_count ?? "-"}</strong>
                <p>Kontrol edilmesi gereken ürün</p>
              </div>
              <div className="insight-kpi">
                <span>💰 Riskli Stok Değeri</span>
                <strong>{expiryMetrics?.risk_stock_value != null ? `${expiryMetrics.risk_stock_value.toLocaleString("tr-TR")} ₺` : "-"}</strong>
                <p>Miad penceresindeki bağlı stok değeri</p>
              </div>
              <div className="insight-kpi">
                <span>📅 En Yakın Miad</span>
                <strong>{expiryMetrics?.nearest_expiry_days != null ? `${expiryMetrics.nearest_expiry_days} gün` : "-"}</strong>
                <p>Geçmemiş en yakın son kullanma tarihi</p>
              </div>
            </section>
            <section className="insight-card">
              <h2>⏳ Miadı Yaklaşan Ürünler</h2>
              {!expiryMetrics?.success && expiryMetrics?.error && <p>{expiryMetrics.error}</p>}
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Durum</th><th>Ürün</th><th>Miad</th><th>Kalan Gün</th><th>Stok</th><th>Stok Değeri</th><th>Raf</th><th>Tedarikçi</th></tr></thead>
                  <tbody>
                    {expiryProducts.length > 0 ? expiryProducts.map((item, index) => (
                      <tr key={`${item.product_name}-${index}`}>
                        <td>{item.status}</td><td>{item.product_name}</td><td>{item.expiry_date}</td><td>{item.days_left}</td><td>{item.stock}</td><td>{item.stock_value.toLocaleString("tr-TR")} ₺</td><td>{item.shelf}</td><td>{item.supplier}</td>
                      </tr>
                    )) : <tr><td colSpan={8}>Miad verisi bulunamadı veya analiz yapılmadı.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeModule === "💀 Ölü Stok Analizi" && (
          <>
            <section className="insight-kpi-grid">
              <div className="insight-kpi risk-kpi risk-kpi-overstock">
                <span>💀 Ölü Stok</span><strong>{deadStockCount}</strong><p>Analiz döneminde hareket görmeyen ürün</p>
              </div>
              <div className="insight-kpi risk-kpi risk-kpi-loss">
                <span>💸 Bağlı Sermaye</span><strong>{deadStockValue.toLocaleString("tr-TR")} ₺</strong><p>Hareketsiz stoktaki tahmini değer</p>
              </div>
            </section>
            <section className="insight-card">
              <h2>💀 Ölü / Hareketsiz Stok Listesi</h2>
              <p>Stokta olup analiz döneminde satış hareketi görülmeyen ürünler.</p>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Ürün</th><th>Stok</th><th>Dönem Satışı</th><th>Stok Değeri</th><th>Önerilen Aksiyon</th></tr></thead>
                  <tbody>
                    {deadStockProducts.length > 0 ? deadStockProducts.map((item, index) => (
                      <tr key={`${item.product_name}-${index}`}><td>{item.product_name}</td><td>{item.stock}</td><td>{item.sold_quantity}</td><td>{item.stock_value.toLocaleString("tr-TR")} ₺</td><td>{item.recommended_action}</td></tr>
                    )) : <tr><td colSpan={5}>Ölü stok bulunamadı veya henüz analiz yapılmadı.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeModule === "💰 Finans Merkezi" && (
          <>
            <section className="insight-kpi-grid">
              <div className="insight-kpi finance-kpi">
                <span>💰 Toplam Ciro</span>
                <strong>
                  {morningBriefing
                    ? `${morningBriefing.summary.total_turnover.toLocaleString(
                        "tr-TR",
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
                        "tr-TR",
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
                        "tr-TR",
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
                <h2>💚 Finansal Performans</h2>

                <h1 className="finance-score">
                  {analyzeResult?.finance_metrics?.success
                    ? `%${profitMargin.toLocaleString("tr-TR")}`
                    : "-"}
                </h1>

                <p>Kâr Marjı</p>
                <p>
                  {analyzeResult?.finance_metrics?.success
                    ? `Toplam ciro ${totalTurnover.toLocaleString("tr-TR")} ₺ · Kâr ${totalProfit.toLocaleString("tr-TR")} ₺`
                    : "Finans verisi doğrulanamadı."}
                </p>
              </div>

              <div className="insight-card">
                <h2>💸 Sermaye Durumu</h2>

                <div className="analysis-summary">
                  <p>
                    Fazla stoklu ürün: <strong>{overStockCount ?? "-"}</strong>
                  </p>

                  <p>
                    Kritik stoklu ürün:{" "}
                    <strong>{metrics?.critical_stock_count ?? "-"}</strong>
                  </p>

                  <p>
                    Veri güveni:{" "}
                    <strong>%{analysisConfidenceScore}</strong>
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

              <div className="ayca-chart-shell ayca-chart-large">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={financeDailyRevenue}
                    margin={{ top: 18, right: 18, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="financeRevenueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.34}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0.03}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(value) =>
                        `${Math.round(Number(value) / 1000)}K`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid #dbeafe",
                        boxShadow: "0 14px 30px rgba(15,23,42,.12)",
                      }}
                      formatter={(value) => [
                        `${Number(value).toLocaleString("tr-TR")} ₺`,
                        "Ciro",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#059669"
                      strokeWidth={3}
                      fill="url(#financeRevenueGradient)"
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
                            <td>{product.profit.toLocaleString("tr-TR")} ₺</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3}>
                            Analiz sonrası gerçek ürün verileri burada
                            görünecek.
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
                        "tr-TR",
                      )}{" "}
                      ₺
                    </strong>{" "}
                    olarak gerçekleşti.
                  </p>

                  <p>
                    Ortalama sepet tutarı{" "}
                    <strong>
                      {morningBriefing.summary.average_sale.toLocaleString(
                        "tr-TR",
                      )}{" "}
                      ₺
                    </strong>{" "}
                    seviyesinde.
                  </p>

                  <p>
                    Toplam{" "}
                    <strong>
                      {morningBriefing.summary.transaction_count.toLocaleString(
                        "tr-TR",
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
                    Doğrulanmış kâr marjı{" "}
                    <strong>%{profitMargin.toLocaleString("tr-TR")}</strong>.
                    Sipariş bütçesinin kritik stoklara yönlendirilmesi finansal
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
                <strong>🟢 Kâr Marjı</strong>
                <span>%{profitMargin.toLocaleString("tr-TR")}</span>
                <p>Doğrulanmış finansal performans metriği</p>
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
                <span>🧪 Veri Güveni</span>
                <strong>%{analysisConfidenceScore}</strong>
                <p>Analiz motorlarının doğrulama oranı</p>
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
                  <div className="ayca-chart-shell ayca-donut-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Kritik stok", value: criticalStockCount },
                            { name: "Sıfır stok", value: zeroStockCount },
                            { name: "Fazla stok", value: overStockCount ?? 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          <Cell fill="#ef4444" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#6366f1" />
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            Number(value).toLocaleString("tr-TR"),
                            "Ürün",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="ayca-donut-center">
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
                <h2>🧪 Analiz Güveni</h2>
                <p>Risk sonuçlarının veri ve motor doğrulama seviyesi</p>

                <div className="risk-loss-value">
                  %{analysisConfidenceScore}
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

        {activeModule === "👥 Hasta & Reçete Merkezi" && (
          <>
            <section className="patient-hero">
              <div>
                <span className="patient-hero-kicker">
                  SPRINT 3.7 · HASTA ZEKÂSI
                </span>
                <h2>Hasta, doktor ve reçete ilişkisini tek merkezde yönetin</h2>
                <p>
                  Sadakat, doktor katkısı, kurum performansı ve kontrollü reçete
                  sinyallerini KVKK odaklı bir yönetici ekranında birleştirin.
                </p>
              </div>
              <div className="patient-score-card">
                <span>Hasta & Reçete Skoru</span>
                <strong>{patientHealthScore}</strong>
                <small>/100</small>
                <div className="patient-score-track">
                  <i style={{ width: `${patientHealthScore}%` }} />
                </div>
              </div>
            </section>

            <section className="insight-kpi-grid patient-kpi-grid">
              <div className="insight-kpi patient-kpi patient-kpi-purple">
                <span>👥 Aktif Hasta</span>
                <strong>{activePatientCount || "-"}</strong>
                <p>Analiz döneminde işlem yapan hasta</p>
              </div>
              <div className="insight-kpi patient-kpi patient-kpi-green">
                <span>⭐ VIP Hasta</span>
                <strong>{vipPatientCount || "-"}</strong>
                <p>Yüksek sadakat ve katkı segmenti</p>
              </div>
              <div className="insight-kpi patient-kpi patient-kpi-red">
                <span>⚠️ Kayıp Riski</span>
                <strong>{lostPatientRiskCount || "-"}</strong>
                <p>Geri kazanım aksiyonu gereken hasta</p>
              </div>
              <div className="insight-kpi patient-kpi patient-kpi-blue">
                <span>🏥 Kurum Sayısı</span>
                <strong>{institutionCount || "-"}</strong>
                <p>Satış hareketlerinde görülen kurum</p>
              </div>
              <div className="insight-kpi patient-kpi patient-kpi-orange">
                <span>🔐 Reçete Sinyali</span>
                <strong>
                  {prescriptionMetrics.reduce(
                    (sum, item) => sum + (item.alert_count ?? 0),
                    0,
                  ) || "-"}
                </strong>
                <p>Kontrollü reçete ve KKİ uyarısı</p>
              </div>
            </section>

            <section className="patient-tab-shell">
              <div className="patient-tabs">
                <button
                  className={patientTab === "doctor" ? "active" : ""}
                  onClick={() => setPatientTab("doctor")}
                >
                  👨‍⚕️ Doktor Analizi
                </button>
                <button
                  className={patientTab === "patient" ? "active" : ""}
                  onClick={() => setPatientTab("patient")}
                >
                  👥 Hasta Sadakati
                </button>
                <button
                  className={patientTab === "institution" ? "active" : ""}
                  onClick={() => setPatientTab("institution")}
                >
                  🏥 Kurum Analizi
                </button>
                <button
                  className={patientTab === "prescription" ? "active" : ""}
                  onClick={() => setPatientTab("prescription")}
                >
                  🔐 Reçete Takibi
                </button>
              </div>

              {patientTab === "doctor" && (
                <section className="insight-card patient-panel">
                  <div className="patient-section-heading">
                    <div>
                      <h2>👨‍⚕️ Doktor Katkı Analizi</h2>
                      <p>Doktor bazında reçete, işlem ve ciro katkısı</p>
                    </div>
                    <span className="patient-live-badge">
                      {doctorMetrics.length} doktor
                    </span>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Doktor</th>
                          <th>Reçete</th>
                          <th>İşlem</th>
                          <th>Ciro</th>
                          <th>Ort. Reçete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctorMetrics.length > 0 ? (
                          doctorMetrics.map((doctor, index) => (
                            <tr key={`${doctor.doctor_name}-${index}`}>
                              <td>{doctor.doctor_name}</td>
                              <td>{doctor.prescription_count ?? "-"}</td>
                              <td>{doctor.transaction_count ?? "-"}</td>
                              <td>
                                {doctor.turnover != null
                                  ? `${doctor.turnover.toLocaleString("tr-TR")} ₺`
                                  : "-"}
                              </td>
                              <td>
                                {doctor.average_prescription != null
                                  ? `${doctor.average_prescription.toLocaleString("tr-TR")} ₺`
                                  : "-"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5}>
                              <div className="patient-empty">
                                <b>Doktor verisi bulunamadı</b>
                                <span>
                                  Satış hareketleri dosyasında doktor alanı
                                  bulunduğunda bu tablo otomatik dolacaktır.
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {patientTab === "patient" && (
                <section className="insight-card patient-panel">
                  <div className="patient-section-heading">
                    <div>
                      <h2>👥 Hasta Sadakati</h2>
                      <p>
                        Hasta segmenti, ziyaret sıklığı ve geri kazanım riski
                      </p>
                    </div>

                    <div
                      className="patient-name-controls"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className={
                          showPatientNames
                            ? "patient-live-badge patient-live-warning"
                            : "patient-live-badge"
                        }
                      >
                        {showPatientNames ? "İsimler görünür" : "KVKK maskeli"}
                      </span>

                      <button
                        type="button"
                        className={
                          showPatientNames
                            ? "patient-name-button patient-name-button-active"
                            : "patient-name-button"
                        }
                        onClick={handlePatientNameVisibility}
                        style={{
                          border: showPatientNames
                            ? "1px solid #ef4444"
                            : "1px solid #d8b4fe",
                          borderRadius: "12px",
                          background: showPatientNames ? "#fff1f2" : "#ffffff",
                          color: showPatientNames ? "#b91c1c" : "#6b21a8",
                          padding: "9px 14px",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: "pointer",
                          boxShadow: "0 6px 18px rgba(126, 34, 206, 0.08)",
                        }}
                      >
                        {showPatientNames
                          ? "🔒 İsimleri Gizle"
                          : "👁️ Hasta İsimlerini Göster"}
                      </button>
                    </div>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Hasta</th>
                          <th>Segment</th>
                          <th>Ziyaret</th>
                          <th>Ciro</th>
                          <th>Son Ziyaret</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientList.length > 0 ? (
                          patientList.map((patient, index) => (
                            <tr key={`${patient.patient_name}-${index}`}>
                              <td
                                className={
                                  showPatientNames ? "patient-name-visible" : ""
                                }
                                style={
                                  showPatientNames
                                    ? { fontWeight: 800, color: "#3b0764" }
                                    : undefined
                                }
                              >
                                {showPatientNames
                                  ? patient.patient_name_full ||
                                    patient.patient_name
                                  : patient.patient_name}
                              </td>
                              <td>
                                <span className="patient-segment">
                                  {patient.segment ?? "Standart"}
                                </span>
                              </td>
                              <td>{patient.visit_count ?? "-"}</td>
                              <td>
                                {patient.turnover != null
                                  ? `${patient.turnover.toLocaleString("tr-TR")} ₺`
                                  : "-"}
                              </td>
                              <td>{patient.last_visit ?? "-"}</td>
                              <td>
                                <span className="patient-risk-pill">
                                  {patient.risk_level ?? "Düşük"}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6}>
                              <div className="patient-empty">
                                <b>Hasta sadakat verisi henüz oluşmadı</b>
                                <span>
                                  Hasta bilgileri analiz motoruna eklendiğinde
                                  isimler maskelenerek gösterilecektir.
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {patientTab === "institution" && (
                <section className="insight-card patient-panel">
                  <div className="patient-section-heading">
                    <div>
                      <h2>🏥 Kurum Performansı</h2>
                      <p>Kurum bazında reçete, işlem ve ciro görünümü</p>
                    </div>
                    <span className="patient-live-badge">
                      {institutionMetrics.length} kurum
                    </span>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Kurum</th>
                          <th>Reçete</th>
                          <th>İşlem</th>
                          <th>Ciro</th>
                          <th>Ort. Sepet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {institutionMetrics.length > 0 ? (
                          institutionMetrics.map((institution, index) => (
                            <tr
                              key={`${institution.institution_name}-${index}`}
                            >
                              <td>{institution.institution_name}</td>
                              <td>{institution.prescription_count ?? "-"}</td>
                              <td>{institution.transaction_count ?? "-"}</td>
                              <td>
                                {institution.turnover != null
                                  ? `${institution.turnover.toLocaleString("tr-TR")} ₺`
                                  : "-"}
                              </td>
                              <td>
                                {institution.average_sale != null
                                  ? `${institution.average_sale.toLocaleString("tr-TR")} ₺`
                                  : "-"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5}>
                              <div className="patient-empty">
                                <b>Kurum kırılımı bulunamadı</b>
                                <span>
                                  Satış dosyasında kurum alanı olduğunda
                                  performans tablosu otomatik hazırlanacaktır.
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {patientTab === "prescription" && (
                <>
                  <section className="prescription-grid">
                    {[
                      ["Normal Reçete", "💊", "normal"],
                      ["Kırmızı Reçete", "🔴", "kirmizi"],
                      ["Yeşil Reçete", "🟢", "yesil"],
                      ["Mor / Turuncu", "🟣", "mor"],
                    ].map(([label, icon, key]) => {
                      const item = prescriptionMetrics.find((row) =>
                        row.prescription_type
                          .toLocaleLowerCase("tr-TR")
                          .includes(key),
                      );
                      return (
                        <div className="prescription-card" key={label}>
                          <span>
                            {icon} {label}
                          </span>
                          <strong>{item?.count ?? "-"}</strong>
                          <p>
                            {item?.turnover != null
                              ? `${item.turnover.toLocaleString("tr-TR")} ₺ ciro`
                              : "Veri bekleniyor"}
                          </p>
                        </div>
                      );
                    })}
                  </section>
                  <section className="insight-card patient-panel prescription-alert-panel">
                    <h2>🔐 Kontrollü Reçete ve KKİ Takibi</h2>
                    <div className="patient-action-grid">
                      <div>
                        <b>01</b>
                        <strong>Kontrollü reçeteleri doğrula</strong>
                        <p>
                          Kırmızı, yeşil ve özel reçete hareketlerini günlük
                          kontrol listesine al.
                        </p>
                      </div>
                      <div>
                        <b>02</b>
                        <strong>KKİ farklarını incele</strong>
                        <p>
                          Kurum karşılığı ile satış tutarı arasında fark bulunan
                          kayıtları önceliklendir.
                        </p>
                      </div>
                      <div>
                        <b>03</b>
                        <strong>KVKK sınırını koru</strong>
                        <p>
                          TC, açık tanı ve hassas sağlık verilerini yönetici
                          ekranına taşımadan analiz et.
                        </p>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </section>

            <section className="patient-kvkk-card">
              <div>
                <span>🔒</span>
                <div>
                  <strong>KVKK güvenlik katmanı</strong>
                  <p>
                    Hasta adları maskelenir. TC kimlik numarası, açık sağlık
                    tanısı ve hassas sağlık verileri bu ekranda gösterilmez.
                  </p>
                </div>
              </div>
              <b>Ticari karar desteği</b>
            </section>
          </>
        )}

        {activeModule === "🤖 AYÇA Copilot" && (
          <>
            <section className="copilot-page-heading">
              <div>
                <span>SPRINT 3.8 · YÖNETİM DANIŞMANI</span>
                <h1>🤖 AYÇA Copilot</h1>
                <p>
                  Stok, finans, risk, doktor ve hasta verilerinizi tek merkezden
                  yorumlayın.
                </p>
              </div>
              <div className="copilot-status-pill">
                <i />
                Analiz verisi {analyzeResult ? "hazır" : "bekleniyor"}
              </div>
            </section>

            <section className="copilot-hero">
              <div>
                <span className="copilot-hero-label">AYÇA YÖNETİCİ ZEKÂSI</span>
                <h2>
                  Veriyi raporlamaz,
                  <br />
                  ne yapmanız gerektiğini söyler.
                </h2>
                <p>
                  Analiz sonuçlarını tek tek incelemek yerine AYÇA’ya sorun;
                  stoktan finansa kadar öncelikli kararlarınızı birlikte
                  oluşturun.
                </p>
                <div className="copilot-hero-actions">
                  <button
                    type="button"
                    onClick={() =>
                      submitCopilotQuestion("Bugün ne yapmalıyım?")
                    }
                  >
                    Bugünün planını oluştur
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setCopilotTab("ask")}
                  >
                    AYÇA’ya soru sor
                  </button>
                </div>
              </div>
              <div className="copilot-score-card">
                <span>Bugünün Önceliği</span>
                <strong>{decisionPriority}</strong>
                <small>
                  Öncelik {decisionPriorityScore}/100 · Karar güveni %
                  {decisionConfidenceScore}
                </small>
                <div className="copilot-score-track">
                  <i
                    style={{
                      width: `${Math.min(100, Math.max(0, decisionPriorityScore))}%`,
                    }}
                  />
                </div>
                <p>{decisionAction}</p>
                <small>
                  Genel sağlık: {copilotHealthScore}/100 · {copilotStatus}
                </small>
              </div>
            </section>

            {decisionSummary && (
              <section className="insight-card" style={{ marginBottom: 16 }}>
                <div className="copilot-section-title">
                  <div>
                    <span>AYÇA DECISION ENGINE</span>
                    <h2>Kararın Dayanağı</h2>
                  </div>
                  <b>{decisionSummary.priority_score}/100</b>
                </div>
                <div className="analysis-summary">
                  <p>
                    Öncelik: <strong>{decisionSummary.priority}</strong>
                  </p>
                  <p>
                    Karar güveni:{" "}
                    <strong>%{decisionSummary.confidence_score}</strong>
                  </p>
                  <p>
                    Önerilen aksiyon:{" "}
                    <strong>{decisionSummary.recommended_action}</strong>
                  </p>
                  <p>
                    Sinyaller:{" "}
                    <strong>
                      {decisionSummary.reason_codes.length
                        ? decisionSummary.reason_codes.join(" · ")
                        : "Kritik karar sinyali yok"}
                    </strong>
                  </p>
                </div>
              </section>
            )}

            <section className="copilot-kpi-grid">
              <div>
                <span>📦 Kritik Stok</span>
                <strong>{criticalStockCount}</strong>
                <small>Bugün kontrol edilmeli</small>
              </div>
              <div>
                <span>🛒 Sipariş Önerisi</span>
                <strong>{suggestionCount}</strong>
                <small>
                  {(
                    morningBriefing?.summary.estimated_order_budget ??
                    estimatedOrderAmount ??
                    0
                  ).toLocaleString("tr-TR")}{" "}
                  ₺ bütçe
                </small>
              </div>
              <div>
                <span>💰 Toplam Ciro</span>
                <strong>
                  {totalTurnover
                    ? `${totalTurnover.toLocaleString("tr-TR")} ₺`
                    : "-"}
                </strong>
                <small>{transactionCount} işlem</small>
              </div>
              <div>
                <span>👥 VIP Hasta</span>
                <strong>{vipPatientCount}</strong>
                <small>{lostPatientRiskCount} kayıp riski</small>
              </div>
              <div>
                <span>🩺 Doktor</span>
                <strong>{doctorMetrics.length}</strong>
                <small>Katkısı analiz edilen hekim</small>
              </div>
            </section>

            <section className="copilot-tab-shell">
              <div className="copilot-tabs">
                {[
                  ["overview", "📋 Genel Durum"],
                  ["stock", "📦 Stok Danışmanı"],
                  ["finance", "💰 Finans Danışmanı"],
                  ["doctor", "🩺 Doktor Danışmanı"],
                  ["patient", "👥 Hasta Danışmanı"],
                  ["ask", "🧠 Bana Sor"],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    className={copilotTab === key ? "active" : ""}
                    onClick={() => setCopilotTab(key as CopilotTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {copilotTab === "overview" && (
                <section className="copilot-overview-grid">
                  <div className="insight-card copilot-ceo-card">
                    <div className="copilot-section-title">
                      <div>
                        <span>YÖNETİCİ ÖZETİ</span>
                        <h2>Eczane CEO Özeti</h2>
                      </div>
                      <b>
                        {decisionSummary
                          ? `${decisionPriority} · ${decisionPriorityScore}/100`
                          : `${copilotHealthScore}/100`}
                      </b>
                    </div>
                    <div className="copilot-signal-columns">
                      <div>
                        <h3>🟢 Güçlü Yönler</h3>
                        {(copilotStrong.length
                          ? copilotStrong
                          : [
                              "Analiz altyapısı aktif.",
                              "Finans ve stok verileri birlikte okunuyor.",
                            ]
                        ).map((item, index) => (
                          <p key={index}>{item}</p>
                        ))}
                      </div>
                      <div>
                        <h3>🟡 Dikkat Alanları</h3>
                        {(copilotWatch.length
                          ? copilotWatch
                          : [
                              `${overStockCount ?? 0} fazla stok kaydı takip edilmeli.`,
                            ]
                        ).map((item, index) => (
                          <p key={index}>{item}</p>
                        ))}
                      </div>
                      <div>
                        <h3>🔴 Acil Konular</h3>
                        {(copilotUrgent.length
                          ? copilotUrgent
                          : [
                              `${criticalStockCount} kritik stok ürünü kontrol edilmeli.`,
                            ]
                        ).map((item, index) => (
                          <p key={index}>{item}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="insight-card copilot-action-card">
                    <div className="copilot-section-title">
                      <div>
                        <span>BUGÜN</span>
                        <h2>Öncelikli Aksiyonlar</h2>
                      </div>
                    </div>
                    {decisionSummary && (
                      <p style={{ marginBottom: 12 }}>
                        Karar güveni:{" "}
                        <strong>%{decisionSummary.confidence_score}</strong>
                      </p>
                    )}
                    {copilotActions.slice(0, 5).map((item, index) => (
                      <div className="copilot-action-row" key={index}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {copilotTab === "stock" && (
                <section className="copilot-advisor-grid">
                  <div className="insight-card copilot-advisor-card">
                    <span>STOK DURUMU</span>
                    <h2>AYÇA Stok Yorumu</h2>
                    <p>
                      {zeroStockCount} sıfır stok, {criticalStockCount} kritik
                      stok ve {overStockCount ?? 0} fazla stok kaydı bulunuyor.
                    </p>
                    <div className="copilot-advisor-metrics">
                      <div>
                        <b>{zeroStockCount}</b>
                        <small>Sıfır stok</small>
                      </div>
                      <div>
                        <b>{criticalStockCount}</b>
                        <small>Kritik stok</small>
                      </div>
                      <div>
                        <b>{overStockCount ?? 0}</b>
                        <small>Fazla stok</small>
                      </div>
                    </div>
                  </div>
                  <div className="insight-card copilot-table-card">
                    <div className="copilot-section-title">
                      <div>
                        <span>SİPARİŞ RADARI</span>
                        <h2>Öncelikli Ürünler</h2>
                      </div>
                    </div>
                    {orderSuggestions.length ? (
                      orderSuggestions.slice(0, 7).map((item, index) => (
                        <div className="copilot-product-row" key={index}>
                          <div>
                            <b>{item["Ürün Adı"]}</b>
                            <small>
                              Stok {item.Stok} · Satış {item["Satılan Adet"]}
                            </small>
                          </div>
                          <strong>{item["Önerilen Sipariş"]} ad.</strong>
                        </div>
                      ))
                    ) : (
                      <div className="copilot-empty">
                        Sipariş önerisi bulunamadı.
                      </div>
                    )}
                  </div>
                </section>
              )}

              {copilotTab === "finance" && (
                <section className="copilot-advisor-grid">
                  <div className="insight-card copilot-advisor-card">
                    <span>FİNANS DURUMU</span>
                    <h2>AYÇA Finans Yorumu</h2>
                    <div className="copilot-finance-list">
                      <div>
                        <span>Toplam ciro</span>
                        <b>{totalTurnover.toLocaleString("tr-TR")} ₺</b>
                      </div>
                      <div>
                        <span>Toplam kâr</span>
                        <b>{totalProfit.toLocaleString("tr-TR")} ₺</b>
                      </div>
                      <div>
                        <span>Kâr marjı</span>
                        <b>%{profitMargin.toLocaleString("tr-TR")}</b>
                      </div>
                      <div>
                        <span>Ortalama satış</span>
                        <b>{averageSale.toLocaleString("tr-TR")} ₺</b>
                      </div>
                    </div>
                  </div>
                  <div className="insight-card copilot-advisor-card">
                    <span>FİNANS AKSİYONU</span>
                    <h2>Önerilen Yaklaşım</h2>
                    <div className="copilot-advice-list">
                      <p>01 · Kritik stok kaynaklı satış kayıplarını azalt.</p>
                      <p>02 · Fazla stokta yeni alımı yavaşlat.</p>
                      <p>03 · Yüksek ciro ve kâr sağlayan ürünleri koru.</p>
                      <p>
                        04 · Sipariş bütçesini öncelikli ürünlere yönlendir.
                      </p>
                    </div>
                    {topFinanceProduct && (
                      <div className="copilot-highlight">
                        <span>Öne çıkan ürün</span>
                        <b>{topFinanceProduct.name}</b>
                        <small>
                          {topFinanceProduct.turnover.toLocaleString("tr-TR")} ₺
                          ciro
                        </small>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {copilotTab === "doctor" && (
                <section className="copilot-advisor-grid">
                  <div className="insight-card copilot-advisor-card">
                    <span>DOKTOR ZEKÂSI</span>
                    <h2>Doktor İlişki Özeti</h2>
                    {topDoctor ? (
                      <div className="copilot-finance-list">
                        <div>
                          <span>Doktor sayısı</span>
                          <b>{doctorMetrics.length}</b>
                        </div>
                        <div>
                          <span>En güçlü doktor</span>
                          <b>{topDoctor.doctor_name}</b>
                        </div>
                        <div>
                          <span>Ciro katkısı</span>
                          <b>
                            {(topDoctor.turnover ?? 0).toLocaleString("tr-TR")}{" "}
                            ₺
                          </b>
                        </div>
                        <div>
                          <span>Reçete</span>
                          <b>{topDoctor.prescription_count ?? 0}</b>
                        </div>
                      </div>
                    ) : (
                      <div className="copilot-empty">
                        Doktor analizi için satış dosyasında doktor alanı
                        gerekir.
                      </div>
                    )}
                  </div>
                  <div className="insight-card copilot-table-card">
                    <div className="copilot-section-title">
                      <div>
                        <span>DOKTOR PERFORMANSI</span>
                        <h2>İlk 7 Doktor</h2>
                      </div>
                    </div>
                    {doctorMetrics.length ? (
                      doctorMetrics.slice(0, 7).map((doctor, index) => (
                        <div className="copilot-product-row" key={index}>
                          <div>
                            <b>{doctor.doctor_name}</b>
                            <small>
                              {doctor.prescription_count ?? 0} reçete
                            </small>
                          </div>
                          <strong>
                            {(doctor.turnover ?? 0).toLocaleString("tr-TR")} ₺
                          </strong>
                        </div>
                      ))
                    ) : (
                      <div className="copilot-empty">
                        Doktor verisi bulunamadı.
                      </div>
                    )}
                  </div>
                </section>
              )}

              {copilotTab === "patient" && (
                <section className="copilot-advisor-grid">
                  <div className="insight-card copilot-advisor-card">
                    <span>HASTA SADAKATİ</span>
                    <h2>Hasta Yönetimi Özeti</h2>
                    <div className="copilot-advisor-metrics">
                      <div>
                        <b>{activePatientCount}</b>
                        <small>Aktif hasta</small>
                      </div>
                      <div>
                        <b>{vipPatientCount}</b>
                        <small>VIP hasta</small>
                      </div>
                      <div>
                        <b>{lostPatientRiskCount}</b>
                        <small>Kayıp riski</small>
                      </div>
                    </div>
                    <p>
                      Kayıp riski taşıyan hastalar için hatırlatma ve geri
                      kazanım planı oluşturulmalı.
                    </p>
                  </div>
                  <div className="insight-card copilot-table-card">
                    <div className="copilot-section-title">
                      <div>
                        <span>GERİ KAZANIM</span>
                        <h2>Öncelikli Hasta Segmentleri</h2>
                      </div>
                    </div>
                    {patientList.length ? (
                      patientList
                        .filter((patient) =>
                          ["yüksek", "kritik"].some((level) =>
                            patient.risk_level
                              ?.toLocaleLowerCase("tr-TR")
                              .includes(level),
                          ),
                        )
                        .slice(0, 7)
                        .map((patient, index) => (
                          <div className="copilot-product-row" key={index}>
                            <div>
                              <b>{patient.patient_name}</b>
                              <small>
                                {patient.segment ?? "Standart"} · Son ziyaret{" "}
                                {patient.last_visit ?? "-"}
                              </small>
                            </div>
                            <strong>{patient.risk_level ?? "Takip"}</strong>
                          </div>
                        ))
                    ) : (
                      <div className="copilot-empty">
                        Hasta sadakat verisi bulunamadı.
                      </div>
                    )}
                  </div>
                </section>
              )}

              {copilotTab === "ask" && (
                <section className="copilot-chat-layout">
                  <div className="insight-card copilot-chat-card">
                    <div className="copilot-section-title">
                      <div>
                        <span>AYÇA İLE KONUŞ</span>
                        <h2>Bana Sor</h2>
                      </div>
                      <b>Doğrulanmış Decision Engine</b>
                    </div>
                    <div className="copilot-quick-questions">
                      {[
                        "Bugün ne yapmalıyım?",
                        "Kritik stoklarım nasıl?",
                        "Sipariş bütçem ne kadar?",
                        "Finansal durumum nasıl?",
                        "Kaç VIP hastam var?",
                        "En güçlü doktor kim?",
                      ].map((question) => (
                        <button
                          type="button"
                          key={question}
                          onClick={() => submitCopilotQuestion(question)}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                    <div className="copilot-messages">
                      {copilotMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`copilot-message ${message.role}`}
                        >
                          <span>
                            {message.role === "assistant" ? "AYÇA" : "Siz"}
                          </span>
                          <p>{message.text}</p>
                        </div>
                      ))}
                    </div>
                    <div className="copilot-input-row">
                      <textarea
                        value={copilotQuestion}
                        onChange={(event) =>
                          setCopilotQuestion(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            submitCopilotQuestion();
                          }
                        }}
                        placeholder="Örneğin: Bugün ne yapmalıyım?"
                      />
                      <button
                        type="button"
                        onClick={() => submitCopilotQuestion()}
                      >
                        Gönder →
                      </button>
                    </div>
                  </div>
                  <div className="insight-card copilot-guide-card">
                    <span>NASIL ÇALIŞIR?</span>
                    <h2>Veriye Dayalı Cevap</h2>
                    <p>
                      AYÇA Copilot bu aşamada yalnızca yüklediğiniz Excel
                      dosyalarından oluşan analiz sonuçlarını yorumlar.
                    </p>
                    <div>
                      <b>✓</b>
                      <p>Stok ve sipariş sorularını cevaplar.</p>
                    </div>
                    <div>
                      <b>✓</b>
                      <p>Finansal performansı yorumlar.</p>
                    </div>
                    <div>
                      <b>✓</b>
                      <p>Hasta ve doktor özetlerini oluşturur.</p>
                    </div>
                    <div>
                      <b>✓</b>
                      <p>Günün aksiyon planını hazırlar.</p>
                    </div>
                  </div>
                </section>
              )}
            </section>

            <style jsx>{`
              .copilot-page-heading {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 20px;
                margin-bottom: 16px;
              }
              .copilot-page-heading > div:first-child > span,
              .copilot-section-title span,
              .copilot-advisor-card > span,
              .copilot-guide-card > span {
                display: block;
                margin-bottom: 7px;
                color: #7c3aed;
                font-size: 11px;
                font-weight: 900;
                letter-spacing: 0.08em;
              }
              .copilot-page-heading h1 {
                margin: 0;
                color: #21104f;
                font-size: 28px;
              }
              .copilot-page-heading p {
                margin: 6px 0 0;
                color: #64748b;
              }
              .copilot-status-pill {
                display: flex;
                align-items: center;
                gap: 8px;
                border: 1px solid #ddd6fe;
                border-radius: 999px;
                background: #fff;
                padding: 9px 14px;
                color: #5b21b6;
                font-size: 12px;
                font-weight: 800;
              }
              .copilot-status-pill i {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #22c55e;
                box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12);
              }
              .copilot-hero {
                display: grid;
                grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.7fr);
                gap: 24px;
                margin-bottom: 16px;
                border: 1px solid #ddd6fe;
                border-radius: 24px;
                background:
                  radial-gradient(
                    circle at 84% 20%,
                    rgba(168, 85, 247, 0.18),
                    transparent 30%
                  ),
                  linear-gradient(135deg, #faf5ff, #fff 54%, #f5f3ff);
                padding: 28px;
              }
              .copilot-hero-label {
                display: inline-flex;
                border: 1px solid #d8b4fe;
                border-radius: 999px;
                background: #fff;
                padding: 6px 10px;
                color: #7e22ce;
                font-size: 10px;
                font-weight: 900;
              }
              .copilot-hero h2 {
                margin: 16px 0 10px;
                color: #2e1065;
                font-size: clamp(28px, 3vw, 45px);
                line-height: 1.04;
              }
              .copilot-hero p {
                color: #64748b;
                line-height: 1.7;
              }
              .copilot-hero-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
                flex-wrap: wrap;
              }
              .copilot-hero-actions button,
              .copilot-input-row button {
                border: 0;
                border-radius: 13px;
                background: linear-gradient(135deg, #7c3aed, #9333ea);
                padding: 11px 16px;
                color: #fff;
                font-weight: 900;
                cursor: pointer;
              }
              .copilot-hero-actions button.secondary {
                border: 1px solid #d8b4fe;
                background: #fff;
                color: #6b21a8;
              }
              .copilot-score-card {
                border: 1px solid rgba(255, 255, 255, 0.8);
                border-radius: 21px;
                background: rgba(255, 255, 255, 0.84);
                padding: 24px;
                box-shadow: 0 18px 50px rgba(109, 40, 217, 0.12);
              }
              .copilot-score-card span,
              .copilot-score-card small {
                color: #7c3aed;
                font-size: 12px;
                font-weight: 800;
              }
              .copilot-score-card strong {
                display: block;
                margin: 8px 0 0;
                color: #2e1065;
                font-size: 58px;
                line-height: 1;
              }
              .copilot-score-track {
                height: 8px;
                margin: 18px 0;
                border-radius: 999px;
                background: #ede9fe;
                overflow: hidden;
              }
              .copilot-score-track i {
                display: block;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, #ec4899, #7c3aed);
              }
              .copilot-score-card p {
                margin: 0;
                color: #475569;
                font-size: 13px;
              }
              .copilot-kpi-grid {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 12px;
                margin-bottom: 16px;
              }
              .copilot-kpi-grid > div {
                border: 1px solid #e9d5ff;
                border-radius: 18px;
                background: #fff;
                padding: 17px;
              }
              .copilot-kpi-grid span {
                color: #6b21a8;
                font-size: 11px;
                font-weight: 800;
              }
              .copilot-kpi-grid strong {
                display: block;
                margin: 8px 0 4px;
                color: #1e1b4b;
                font-size: 23px;
              }
              .copilot-kpi-grid small {
                color: #94a3b8;
              }
              .copilot-tab-shell {
                border: 1px solid #e9d5ff;
                border-radius: 20px;
                background: rgba(255, 255, 255, 0.72);
                padding: 12px;
              }
              .copilot-tabs {
                display: flex;
                gap: 7px;
                margin-bottom: 13px;
                border-radius: 15px;
                background: #faf5ff;
                padding: 6px;
                overflow-x: auto;
              }
              .copilot-tabs button {
                flex: 0 0 auto;
                border: 0;
                border-radius: 10px;
                background: transparent;
                padding: 10px 13px;
                color: #6b21a8;
                font-weight: 850;
                cursor: pointer;
              }
              .copilot-tabs button.active {
                background: linear-gradient(135deg, #7c3aed, #9333ea);
                color: #fff;
                box-shadow: 0 8px 18px rgba(124, 58, 237, 0.22);
              }
              .copilot-overview-grid,
              .copilot-advisor-grid,
              .copilot-chat-layout {
                display: grid;
                grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
                gap: 14px;
              }
              .copilot-section-title {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 15px;
                margin-bottom: 16px;
              }
              .copilot-section-title h2,
              .copilot-advisor-card h2,
              .copilot-guide-card h2 {
                margin: 0;
                color: #2e1065;
              }
              .copilot-section-title > b {
                border-radius: 999px;
                background: #f3e8ff;
                padding: 7px 10px;
                color: #7e22ce;
                font-size: 12px;
              }
              .copilot-signal-columns {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
              }
              .copilot-signal-columns > div {
                border: 1px solid #ede9fe;
                border-radius: 15px;
                background: #fafafa;
                padding: 14px;
              }
              .copilot-signal-columns h3 {
                margin: 0 0 10px;
                color: #312e81;
                font-size: 13px;
              }
              .copilot-signal-columns p,
              .copilot-advice-list p {
                margin: 7px 0;
                color: #64748b;
                font-size: 12px;
                line-height: 1.55;
              }
              .copilot-action-row {
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 1px solid #f1f5f9;
                padding: 12px 0;
              }
              .copilot-action-row span {
                display: grid;
                width: 32px;
                height: 32px;
                place-items: center;
                border-radius: 10px;
                background: #f3e8ff;
                color: #7e22ce;
                font-size: 11px;
                font-weight: 900;
              }
              .copilot-action-row p {
                margin: 0;
                color: #334155;
                font-weight: 700;
              }
              .copilot-advisor-card > p {
                color: #64748b;
                line-height: 1.65;
              }
              .copilot-advisor-metrics {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin: 18px 0;
              }
              .copilot-advisor-metrics > div {
                border-radius: 14px;
                background: #faf5ff;
                padding: 14px;
                text-align: center;
              }
              .copilot-advisor-metrics b {
                display: block;
                color: #581c87;
                font-size: 24px;
              }
              .copilot-advisor-metrics small {
                color: #7c3aed;
              }
              .copilot-product-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 15px;
                border-bottom: 1px solid #f1f5f9;
                padding: 12px 0;
              }
              .copilot-product-row b {
                display: block;
                color: #312e81;
              }
              .copilot-product-row small {
                color: #94a3b8;
              }
              .copilot-product-row strong {
                color: #7e22ce;
                white-space: nowrap;
              }
              .copilot-finance-list > div {
                display: flex;
                justify-content: space-between;
                gap: 15px;
                border-bottom: 1px solid #f1f5f9;
                padding: 11px 0;
              }
              .copilot-finance-list span {
                color: #64748b;
              }
              .copilot-finance-list b {
                color: #312e81;
              }
              .copilot-highlight {
                margin-top: 18px;
                border-radius: 15px;
                background: linear-gradient(135deg, #faf5ff, #f5f3ff);
                padding: 15px;
              }
              .copilot-highlight span,
              .copilot-highlight small {
                display: block;
                color: #7c3aed;
                font-size: 11px;
              }
              .copilot-highlight b {
                display: block;
                margin: 6px 0;
                color: #2e1065;
              }
              .copilot-empty {
                border: 1px dashed #d8b4fe;
                border-radius: 14px;
                background: #faf5ff;
                padding: 30px 18px;
                color: #7c3aed;
                text-align: center;
                font-weight: 800;
              }
              .copilot-quick-questions {
                display: flex;
                gap: 7px;
                margin-bottom: 15px;
                flex-wrap: wrap;
              }
              .copilot-quick-questions button {
                border: 1px solid #ddd6fe;
                border-radius: 999px;
                background: #fff;
                padding: 8px 11px;
                color: #6d28d9;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
              }
              .copilot-messages {
                min-height: 310px;
                max-height: 480px;
                border-radius: 16px;
                background: #f8fafc;
                padding: 14px;
                overflow-y: auto;
              }
              .copilot-message {
                max-width: 84%;
                margin-bottom: 12px;
                border-radius: 15px;
                padding: 12px 14px;
              }
              .copilot-message.assistant {
                margin-right: auto;
                background: #fff;
                box-shadow: 0 5px 18px rgba(76, 29, 149, 0.08);
              }
              .copilot-message.user {
                margin-left: auto;
                background: linear-gradient(135deg, #7c3aed, #9333ea);
                color: #fff;
              }
              .copilot-message span {
                display: block;
                margin-bottom: 5px;
                font-size: 10px;
                font-weight: 900;
                opacity: 0.72;
              }
              .copilot-message p {
                margin: 0;
                white-space: pre-line;
                line-height: 1.6;
              }
              .copilot-input-row {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 9px;
                margin-top: 12px;
              }
              .copilot-input-row textarea {
                min-height: 54px;
                resize: vertical;
                border: 1px solid #ddd6fe;
                border-radius: 13px;
                padding: 12px;
                font: inherit;
                outline: none;
              }
              .copilot-guide-card > p {
                color: #64748b;
                line-height: 1.7;
              }
              .copilot-guide-card > div {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                margin-top: 13px;
              }
              .copilot-guide-card > div b {
                display: grid;
                width: 24px;
                height: 24px;
                place-items: center;
                border-radius: 8px;
                background: #dcfce7;
                color: #15803d;
              }
              .copilot-guide-card > div p {
                margin: 2px 0 0;
                color: #475569;
              }
              @media (max-width: 1100px) {
                .copilot-kpi-grid {
                  grid-template-columns: repeat(3, 1fr);
                }
                .copilot-hero,
                .copilot-overview-grid,
                .copilot-advisor-grid,
                .copilot-chat-layout {
                  grid-template-columns: 1fr;
                }
              }
              @media (max-width: 720px) {
                .copilot-page-heading {
                  align-items: flex-start;
                  flex-direction: column;
                }
                .copilot-kpi-grid,
                .copilot-signal-columns,
                .copilot-advisor-metrics {
                  grid-template-columns: 1fr;
                }
                .copilot-hero {
                  padding: 20px;
                }
                .copilot-input-row {
                  grid-template-columns: 1fr;
                }
              }
            `}</style>
          </>
        )}


        {activeModule === "📊 Raporlar" && (
          <section className="insight-card">
            <h2>📊 AYÇA Insight Raporları</h2>
            <p>Analiz sonuçlarını yönetici özeti, sipariş, risk, stok bitiş, ölü stok, miad ve finans sayfalarıyla Excel olarak indirin.</p>
            <button className="primary-button" onClick={downloadAnalysisReport} disabled={!analyzeResult}>
              📥 Excel Analiz Raporunu İndir
            </button>
            <div className="analysis-summary" style={{ marginTop: 20 }}>
              <p>
                Analiz durumu:{" "}
                <strong>
                  {analyzeResult
                    ? analyzeResult.analysis_status === "complete"
                      ? "Tamamlandı"
                      : analyzeResult.analysis_status === "partial"
                        ? "Kısmi"
                        : analyzeResult.analysis_status === "failed"
                          ? "Başarısız"
                          : "Hazır"
                    : "Önce analiz yapınız"}
                </strong>
              </p>
              <p>
                Veri güveni: <strong>%{analysisConfidenceScore}</strong>
              </p>
              <p>Sipariş önerisi: <strong>{suggestionCount}</strong></p>
              <p>Kritik stok: <strong>{criticalStockCount}</strong></p>
              <p>Miad uyarısı: <strong>{expiryMetrics?.warning_count ?? 0}</strong></p>
              <p>Ölü stok: <strong>{deadStockCount}</strong></p>
            </div>
          </section>
        )}

        {activeModule !== "🏠 Dashboard" &&
          activeModule !== "☀️ Sabah Brifingi" &&
          activeModule !== "📦 Operasyon Merkezi" &&
          activeModule !== "💰 Finans Merkezi" &&
          activeModule !== "🚨 Risk Merkezi" &&
          activeModule !== "⏱️ Stok Bitiş Tahmini" &&
          activeModule !== "⏳ Miad Takibi" &&
          activeModule !== "💀 Ölü Stok Analizi" &&
          activeModule !== "👥 Hasta & Reçete Merkezi" &&
          activeModule !== "🤖 AYÇA Copilot" &&
          activeModule !== "📊 Raporlar" && (
            <section className="insight-card module-placeholder">
              <h2>{activeModule}</h2>
              <p>
                Bu alan, mevcut Streamlit AYÇA Insight modülünden Next.js
                platformuna taşınacak.
              </p>
              <div className="empty-chart">Modül iskeleti hazır.</div>
            </section>
          )}
        </AnimatedPage>
        )}
      </section>
    </main>
  );
}