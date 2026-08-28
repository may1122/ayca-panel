"use client";

import { useEffect, useRef, useState } from "react";
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

type PrescriptionProduct = {
  product_name: string;
  quantity?: number | null;
  turnover?: number | null;
};

type PrescriptionMetric = {
  prescription_type: string;
  count: number;
  turnover?: number;
  alert_count?: number;
  product_count?: number | null;
  quantity?: number | null;
  metric_basis?: "direct_prescription" | "product_reference" | string;
  source?: string;
  products?: PrescriptionProduct[];
};

type CopilotTab =
  "overview" | "stock" | "finance" | "doctor" | "patient" | "ask";

type OperationTab = "stock" | "risk" | "runout" | "dead";

type FinancePeriod = "week" | "month" | "3months" | "year" | "all";

type FinancePeriodMetric = {
  period: FinancePeriod;
  period_label: string;
  period_start?: string | null;
  period_end?: string | null;
  period_reference_date?: string | null;
  period_filter_applied?: boolean;
  total_turnover: number;
  total_profit: number;
  total_cost: number;
  profit_margin: number;
  transaction_count: number;
  average_sale: number;
  row_count?: number;
  week_offset?: number;
  is_latest_week?: boolean;
  daily_revenue?: FinanceDailyRevenue[];
  sgk_turnover?: number;
  cash_turnover?: number;
  returned_turnover?: number;
  other_turnover?: number;
  turnover_breakdown_available?: boolean;
};

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
    error?: string;
    warnings?: string[];
    duplicate_info?: {
      duplicate_check_applied?: boolean;
      duplicate_rows_detected?: number;
      duplicate_rows_removed?: number;
      duplicate_key_columns?: string[];
      duplicate_check_reason?: string | null;
    };
    total_turnover?: number;
    average_sale?: number;
    transaction_count?: number;
    total_profit?: number;
    total_cost?: number;
    total_debt?: number;
    total_payables?: number;
    debt_total?: number;
    outstanding_debt?: number;
    profit_margin?: number;
    period?: FinancePeriod;
    period_label?: string;
    period_start?: string | null;
    period_end?: string | null;
    period_reference_date?: string | null;
    period_filter_applied?: boolean;
    period_metrics?: Partial<Record<FinancePeriod, FinancePeriodMetric>>;
    week_metrics?: FinancePeriodMetric[];
    daily_revenue?: FinanceDailyRevenue[];
    sgk_turnover?: number;
    cash_turnover?: number;
    returned_turnover?: number;
    other_turnover?: number;
    turnover_breakdown_available?: boolean;
    sales_type_column?: string | null;
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
    total_patient_count?: number;
    active_patient_count?: number;
    vip_patient_count?: number;
    lost_patient_risk_count?: number;
    lapsed_patient_count?: number;
    doctors?: DoctorMetric[];
    patients?: PatientMetric[];
    patient_lookup?: PatientMetric[];
    lapsed_patients?: PatientMetric[];
    institutions?: InstitutionMetric[];
    prescriptions?: PrescriptionMetric[];
    duplicate_info?: {
      duplicate_check_applied?: boolean;
      duplicate_rows_detected?: number;
      duplicate_rows_removed?: number;
      duplicate_key_columns?: string[];
      duplicate_check_reason?: string | null;
    };
  } | null;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");
const API_URL = `${API_BASE_URL}/analyze/`;
const REPORT_URL = `${API_BASE_URL}/analyze/report`;
const COPILOT_URL = `${API_BASE_URL}/copilot/ask`;

const modules = [
  "🏠 Dashboard",
  "🤖 AYÇA Asistan",
  "📦 Operasyon",
  "💰 Finans",
  "👥 Hasta & Reçete",
];

const financePeriodLabels: Record<FinancePeriod, string> = {
  week: "Bu Hafta",
  month: "Bu Ay",
  "3months": "Son 3 Ay",
  year: "Bu Yıl",
  all: "Tümü",
};

function DashboardPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [activeModule, setActiveModule] = useState("🏠 Dashboard");
  const [financePeriod, setFinancePeriod] = useState<FinancePeriod>("month");
  const [weekOffset, setWeekOffset] = useState(0);
  const [operationTab, setOperationTab] = useState<OperationTab>("stock");
  const [patientTab, setPatientTab] = useState<
    "doctor" | "patient" | "institution" | "prescription"
  >("doctor");
  const [showPatientNames, setShowPatientNames] = useState(false);
  const [patientLoyaltyTab, setPatientLoyaltyTab] = useState<
    "segments" | "risk" | "lapsed"
  >("segments");
  const [patientSegmentFilter, setPatientSegmentFilter] = useState<
    "all" | "VIP" | "Sadık" | "Aktif" | "Yeni"
  >("all");
  const [activePatientContextName, setActivePatientContextName] =
    useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPrescriptionType, setSelectedPrescriptionType] =
    useState("Kırmızı Reçete");
  const [prescriptionSearch, setPrescriptionSearch] = useState("");
  const [copilotTab, setCopilotTab] = useState<CopilotTab>("overview");
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 1,
      role: "assistant",
      text:
        "Merhaba 👋 Ben AYÇA. Eczanenizin verilerini sizinle birlikte yorumlamak için buradayım. Stok, sipariş, finans, doktor ve hasta verileriniz hakkında bana doğal bir şekilde soru sorabilirsiniz. İsterseniz bugün dikkat etmeniz gereken konularla başlayabiliriz.",
    },
  ]);
  const [isCopilotThinking, setIsCopilotThinking] = useState(false);
  const [isAssistantDrawerOpen, setIsAssistantDrawerOpen] = useState(false);
  const [assistantOrbPosition, setAssistantOrbPosition] = useState({ x: 0, y: 0 });
  const assistantOrbDragRef = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const handleAssistantOrbPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return;

    assistantOrbDragRef.current = {
      dragging: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: assistantOrbPosition.x,
      originY: assistantOrbPosition.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAssistantOrbPointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    const drag = assistantOrbDragRef.current;
    if (!drag.dragging) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
    }

    const maxX = Math.max(80, Math.min(window.innerWidth * 0.32, 360));
    const maxY = Math.max(70, Math.min(window.innerHeight * 0.22, 190));

    setAssistantOrbPosition({
      x: Math.max(-maxX, Math.min(maxX, drag.originX + dx)),
      y: Math.max(-maxY, Math.min(maxY, drag.originY + dy)),
    });
  };

  const handleAssistantOrbPointerUp = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    const drag = assistantOrbDragRef.current;
    drag.dragging = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    const handleWindowPointerMove = (event: PointerEvent) => {
      const drag = assistantOrbDragRef.current;
      if (!drag.dragging) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        drag.moved = true;
      }

      const maxX = Math.max(120, Math.min(window.innerWidth * 0.42, 520));
      const maxY = Math.max(100, Math.min(window.innerHeight * 0.32, 280));

      setAssistantOrbPosition({
        x: Math.max(-maxX, Math.min(maxX, drag.originX + dx)),
        y: Math.max(-maxY, Math.min(maxY, drag.originY + dy)),
      });
    };

    const handleWindowPointerUp = () => {
      assistantOrbDragRef.current.dragging = false;
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, []);


  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTurnoverDetailOpen, setIsTurnoverDetailOpen] = useState(false);

  const hasConversationStarted = copilotMessages.some(
    (message) => message.role === "user",
  );

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
    if (financePeriod !== "week") return;

    const maxOffset = Math.max(
      (analyzeResult?.finance_metrics?.week_metrics?.length ?? 1) - 1,
      0,
    );

    if (weekOffset > maxOffset) {
      setWeekOffset(maxOffset);
    }
  }, [
    financePeriod,
    weekOffset,
    analyzeResult?.finance_metrics?.week_metrics?.length,
  ]);

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

      const resolvedFullName =
        profile?.full_name?.trim() ||
        String(
          userData.user.user_metadata?.full_name ??
            userData.user.user_metadata?.name ??
            "",
        ).trim() ||
        (userData.user.email?.split("@")[0] ?? "");

      setFullName(resolvedFullName);

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

  function navigateToOperation(tab: OperationTab) {
    setOperationTab(tab);
    setActiveModule("📦 Operasyon");

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
    Math.min(100, Math.round(100 - rawRiskScore)),
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
  const patientLookupList = patientMetrics?.patient_lookup ?? patientList;
  const lapsedPatientList = patientMetrics?.lapsed_patients ?? [];
  const institutionMetrics = patientMetrics?.institutions ?? [];
  const prescriptionMetrics = patientMetrics?.prescriptions ?? [];

  const normalizeSearchText = (value?: string | null) =>
    String(value ?? "")
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const matchesPatientSearch = (patient: PatientMetric) => {
    const query = normalizeSearchText(patientSearch.trim());
    if (!query) return true;

    return [
      patient.patient_name,
      showPatientNames ? patient.patient_name_full : "",
      patient.segment,
      patient.risk_level,
      patient.last_visit,
    ].some((value) => normalizeSearchText(value).includes(query));
  };

  const riskPatientList = patientList.filter((patient) =>
    ["yüksek", "kritik", "high", "critical"].some((level) =>
      patient.risk_level?.toLocaleLowerCase("tr-TR").includes(level),
    ),
  );

  const filteredPatientList = patientList.filter(matchesPatientSearch);
  const filteredRiskPatientList = riskPatientList.filter(matchesPatientSearch);
  const filteredLapsedPatientList =
    lapsedPatientList.filter(matchesPatientSearch);

  const patientSegmentCounts = {
    all: patientList.length,
    VIP: patientList.filter((patient) => patient.segment === "VIP").length,
    Sadık: patientList.filter((patient) => patient.segment === "Sadık").length,
    Aktif: patientList.filter((patient) => patient.segment === "Aktif").length,
    Yeni: patientList.filter((patient) => patient.segment === "Yeni").length,
  };

  const dashboardRiskChartData = [
    { name: "Sıfır Stok", value: zeroStockCount },
    { name: "Kritik", value: criticalStockCount },
    { name: "Fazla", value: overStockCount ?? 0 },
    { name: "Ölü Stok", value: deadStockCount },
  ];

  const dashboardPatientSegmentData = [
    { name: "VIP", value: patientSegmentCounts.VIP },
    { name: "Sadık", value: patientSegmentCounts.Sadık },
    { name: "Aktif", value: patientSegmentCounts.Aktif },
    { name: "Yeni", value: patientSegmentCounts.Yeni },
  ].filter((item) => item.value > 0);

  const filteredSegmentPatientList = filteredPatientList.filter((patient) =>
    patientSegmentFilter === "all"
      ? true
      : patient.segment === patientSegmentFilter,
  );

  const visibleLoyaltyPatients =
    patientLoyaltyTab === "segments"
      ? filteredSegmentPatientList
      : patientLoyaltyTab === "risk"
        ? filteredRiskPatientList
        : filteredLapsedPatientList;

  function resolvePatientNameFromQuestion(question: string) {
    const normalizedQuestion = normalizeSearchText(question);

    return (
      patientLookupList.find((patient) => {
        const fullName = patient.patient_name_full?.trim();
        if (!fullName) return false;

        const normalizedName = normalizeSearchText(fullName);
        return normalizedName.length >= 4 && normalizedQuestion.includes(normalizedName);
      })?.patient_name_full?.trim() ?? null
    );
  }

  function looksLikePatientFollowup(question: string) {
    const normalized = normalizeSearchText(question);

    const patientSignals = [
      "son ziyaret",
      "en son ne zaman",
      "ne zaman geldi",
      "kaç kere",
      "kaç kez",
      "kaç defa",
      "ziyaret say",
      "toplam ne kadar alışveriş",
      "toplam ciro",
      "cirosu",
      "harcama",
      "kayıp riski",
      "kayip riski",
      "risk neden",
      "hangi doktor",
      "hangi hekim",
      "doktorlardan",
      "hekimlerden",
      "hangi ilaç",
      "hangi ilac",
      "hangi ürün",
      "hangi urun",
      "son aldığı",
      "son aldigi",
      "geri kazan",
      "geri get",
      "segmenti",
      "segment",
    ];

    return patientSignals.some((signal) =>
      normalized.includes(normalizeSearchText(signal)),
    );
  }

  const selectedPrescription =
    prescriptionMetrics.find(
      (item) => item.prescription_type === selectedPrescriptionType,
    ) ?? null;

  const selectedPrescriptionProducts = (
    selectedPrescription?.products ?? []
  ).filter((product) =>
    normalizeSearchText(product.product_name).includes(
      normalizeSearchText(prescriptionSearch.trim()),
    ),
  );

  const patientHealthScore = Math.max(
    0,
    Math.min(
      100,
      patientMetrics?.health_score ?? morningBriefing?.score ?? healthScore,
    ),
  );

  const totalPatientCount =
    patientMetrics?.total_patient_count ??
    patientMetrics?.active_patient_count ??
    patientLookupList.length ??
    patientList.length;
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
  const lapsedPatientCount =
    patientMetrics?.lapsed_patient_count ?? lapsedPatientList.length;
  const institutionCount = institutionMetrics.length;

  const financeMetrics = analyzeResult?.finance_metrics ?? null;
  const financeAvailable = financeMetrics?.success !== false;
  const financeErrorMessage =
    financeMetrics?.error ??
    financeMetrics?.warnings?.[0] ??
    "Finans verisi hesaplanamadı.";
  const financeWeekMetrics = financeMetrics?.week_metrics ?? [];

  const selectedWeekMetric =
    financePeriod === "week"
      ? financeWeekMetrics[weekOffset] ?? null
      : null;

  const selectedFinancePeriod =
    selectedWeekMetric ??
    financeMetrics?.period_metrics?.[financePeriod] ??
    null;

  const selectedFinanceDailyRevenue =
    financePeriod === "week"
      ? selectedWeekMetric?.daily_revenue ?? []
      : selectedFinancePeriod?.daily_revenue ??
        financeMetrics?.daily_revenue ??
        [];

  const financeDailyRevenue = selectedFinanceDailyRevenue.map((item) => ({
    day: item.label,
    value: item.revenue,
    profit: item.profit ?? 0,
  }));

  const maximumFinanceRevenue = Math.max(
    ...financeDailyRevenue.map((item) => item.value),
    1,
  );

  const totalTurnover =
    selectedFinancePeriod?.total_turnover ??
    financeMetrics?.total_turnover ??
    0;

  const sgkTurnover =
    selectedFinancePeriod?.sgk_turnover ??
    financeMetrics?.sgk_turnover ??
    0;

  const cashTurnover =
    selectedFinancePeriod?.cash_turnover ??
    financeMetrics?.cash_turnover ??
    0;

  const returnedTurnover =
    selectedFinancePeriod?.returned_turnover ??
    financeMetrics?.returned_turnover ??
    0;

  const otherTurnover =
    selectedFinancePeriod?.other_turnover ??
    financeMetrics?.other_turnover ??
    0;

  const turnoverBreakdownAvailable =
    selectedFinancePeriod?.turnover_breakdown_available ??
    financeMetrics?.turnover_breakdown_available ??
    false;

  const totalProfit =
    selectedFinancePeriod?.total_profit ??
    financeMetrics?.total_profit ??
    0;

  const profitMargin =
    selectedFinancePeriod?.profit_margin ??
    financeMetrics?.profit_margin ??
    0;

  const averageSale =
    selectedFinancePeriod?.average_sale ??
    financeMetrics?.average_sale ??
    0;

  const transactionCount =
    selectedFinancePeriod?.transaction_count ??
    financeMetrics?.transaction_count ??
    0;

  const financePeriodLabel =
    financePeriod === "week" &&
    selectedWeekMetric?.period_start &&
    selectedWeekMetric?.period_end
      ? `${new Date(
          `${selectedWeekMetric.period_start}T00:00:00`,
        ).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "short",
        })} – ${new Date(
          `${selectedWeekMetric.period_end}T00:00:00`,
        ).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`
      : selectedFinancePeriod?.period_label ??
        financePeriodLabels[financePeriod];

  const financePeriodDateLabel =
    selectedFinancePeriod?.period_start &&
    selectedFinancePeriod?.period_end
      ? `${selectedFinancePeriod.period_start} – ${selectedFinancePeriod.period_end}`
      : financePeriodLabel;

  const canGoToPreviousWeek =
    financePeriod === "week" &&
    weekOffset < financeWeekMetrics.length - 1;

  const canGoToNextWeek =
    financePeriod === "week" && weekOffset > 0;

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

  const nearestRunoutProduct =
    [...stockRunoutProducts]
      .filter((item) => Number.isFinite(item.estimated_runout_days))
      .sort((a, b) => a.estimated_runout_days - b.estimated_runout_days)[0] ??
    null;

  const nearestExpiryProduct =
    [...expiryProducts]
      .filter((item) => Number.isFinite(item.days_left))
      .sort((a, b) => a.days_left - b.days_left)[0] ??
    null;

  type DashboardBriefingItem = {
    id: string;
    level: "critical" | "high" | "medium" | "opportunity";
    levelLabel: string;
    category: string;
    title: string;
    detail: string;
    actionLabel: string;
    action: "stock" | "risk" | "finance" | "patient" | "assistant";
  };

  const dashboardBriefingItems: DashboardBriefingItem[] = [];

  if (hasAnalysis && nearestRunoutProduct) {
    dashboardBriefingItems.push({
      id: "runout",
      level:
        nearestRunoutProduct.estimated_runout_days <= 5 ? "critical" : "high",
      levelLabel:
        nearestRunoutProduct.estimated_runout_days <= 5 ? "Kritik" : "Yüksek",
      category: "Stok",
      title: `${nearestRunoutProduct.product_name} ${Math.max(
        0,
        Math.round(nearestRunoutProduct.estimated_runout_days),
      )} gün içinde tükenebilir`,
      detail: `Mevcut stok ${nearestRunoutProduct.stock} adet. Son satış verisine göre günlük tüketim ${nearestRunoutProduct.daily_consumption.toLocaleString(
        "tr-TR",
        { maximumFractionDigits: 1 },
      )} adet.`,
      actionLabel: "Siparişleri aç",
      action: "stock",
    });
  } else if (hasAnalysis && (criticalStockCount > 0 || zeroStockCount > 0)) {
    dashboardBriefingItems.push({
      id: "stock-risk",
      level: zeroStockCount > 0 ? "critical" : "high",
      levelLabel: zeroStockCount > 0 ? "Kritik" : "Yüksek",
      category: "Stok",
      title: `${criticalStockCount + zeroStockCount} üründe stok müdahalesi gerekiyor`,
      detail: `${zeroStockCount} ürün sıfır stokta, ${criticalStockCount} ürün kritik seviyede.`,
      actionLabel: "Stok riskini aç",
      action: "stock",
    });
  }

  if (hasAnalysis && nearestExpiryProduct) {
    dashboardBriefingItems.push({
      id: "expiry",
      level: nearestExpiryProduct.days_left <= 30 ? "critical" : "high",
      levelLabel: nearestExpiryProduct.days_left <= 30 ? "Kritik" : "Yüksek",
      category: "SKT",
      title: `${nearestExpiryProduct.product_name} için ${Math.max(
        0,
        Math.round(nearestExpiryProduct.days_left),
      )} gün SKT süresi kaldı`,
      detail: `Stok ${nearestExpiryProduct.stock} adet · yaklaşık ${nearestExpiryProduct.stock_value.toLocaleString(
        "tr-TR",
      )} ₺ ürün değeri riskte.`,
      actionLabel: "SKT listesini aç",
      action: "risk",
    });
  }

  if (hasAnalysis && (deadStockCount > 0 || deadStockValue > 0)) {
    dashboardBriefingItems.push({
      id: "capital",
      level: deadStockValue > 0 ? "high" : "medium",
      levelLabel: deadStockValue > 0 ? "Yüksek" : "Orta",
      category: "Sermaye",
      title: `${deadStockCount} ürün stokta gereksiz sermaye bağlıyor`,
      detail:
        deadStockValue > 0
          ? `${deadStockValue.toLocaleString(
              "tr-TR",
            )} ₺ ölü stok değeri var. İade, transfer veya satış aksiyonu değerlendirilebilir.`
          : "Uzun süredir hareket görmeyen ürünleri gözden geçir.",
      actionLabel: "Ölü stok analizini aç",
      action: "risk",
    });
  }

  if (hasAnalysis && financeAvailable) {
    dashboardBriefingItems.push({
      id: "finance",
      level: profitMargin < 15 ? "high" : profitMargin < 25 ? "medium" : "opportunity",
      levelLabel: profitMargin < 15 ? "Yüksek" : profitMargin < 25 ? "Orta" : "Fırsat",
      category: "Finans",
      title: `Kâr marjın %${profitMargin.toLocaleString("tr-TR", {
        maximumFractionDigits: 1,
      })}`,
      detail: `${financePeriodLabel} cirosu ${totalTurnover.toLocaleString(
        "tr-TR",
      )} ₺, doğrulanmış kâr ${totalProfit.toLocaleString("tr-TR")} ₺.`,
      actionLabel: "Finansal analizi aç",
      action: "finance",
    });
  }

  if (hasAnalysis && (lostPatientRiskCount > 0 || lapsedPatientCount > 0)) {
    dashboardBriefingItems.push({
      id: "patient",
      level: lostPatientRiskCount > 0 ? "medium" : "opportunity",
      levelLabel: lostPatientRiskCount > 0 ? "Orta" : "Fırsat",
      category: "Hasta",
      title:
        lostPatientRiskCount > 0
          ? `${lostPatientRiskCount} hasta kayıp riski taşıyor`
          : `${lapsedPatientCount} hasta yeniden kazanılabilir`,
      detail: `${lapsedPatientCount} hasta gelmeyi bırakmış görünüyor. Hasta sadakati ekranından önceliklendirilebilir.`,
      actionLabel: "Hasta içgörülerini aç",
      action: "patient",
    });
  }

  if (hasAnalysis && suggestionCount > 0) {
    dashboardBriefingItems.push({
      id: "orders",
      level: "opportunity",
      levelLabel: "Fırsat",
      category: "Sipariş",
      title: `${suggestionCount} akıllı sipariş önerisi hazır`,
      detail: estimatedOrderAmount
        ? `Önerilen toplam sipariş bütçesi yaklaşık ${estimatedOrderAmount.toLocaleString(
            "tr-TR",
          )} ₺.`
        : "Satış hızı ve stok süresine göre sipariş fırsatları önceliklendirildi.",
      actionLabel: "Sipariş önerilerini aç",
      action: "stock",
    });
  }

  const dashboardBriefing =
    dashboardBriefingItems.length > 0
      ? dashboardBriefingItems.slice(0, 6)
      : [
          {
            id: "waiting",
            level: "medium" as const,
            levelLabel: "Bekliyor",
            category: "AYÇA",
            title: "Bugünün öncelikleri analizden sonra burada oluşacak",
            detail:
              "Üç veri dosyasını analiz ettiğinde AYÇA stok, finans, SKT, sermaye ve hasta sinyallerini birlikte sıralayacak.",
            actionLabel: "AYÇA’ya sor",
            action: "assistant" as const,
          },
        ];

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

  function createTodayPlan() {
    setActiveModule("🏠 Dashboard");

    window.setTimeout(() => {
      document
        .getElementById("ayca-morning-briefing")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function submitCopilotQuestion(question?: string) {
    const finalQuestion = (question ?? copilotQuestion).trim();

    if (!finalQuestion || isCopilotThinking) return;

    const patientNameInQuestion = resolvePatientNameFromQuestion(finalQuestion);
    const shouldUsePatientContext =
      Boolean(patientNameInQuestion) ||
      (Boolean(activePatientContextName) &&
        looksLikePatientFollowup(finalQuestion));

    const resolvedPatientContext = shouldUsePatientContext
      ? patientNameInQuestion ?? activePatientContextName
      : null;

    if (patientNameInQuestion) {
      setActivePatientContextName(patientNameInQuestion);
    }

    const backendQuestion =
      !patientNameInQuestion && resolvedPatientContext
        ? `${resolvedPatientContext}: ${finalQuestion}`
        : finalQuestion;

    const timestamp = Date.now();

    if (!analyzeResult) {
      setCopilotMessages((currentMessages) => [
        ...currentMessages,
        {
          id: timestamp,
          role: "user",
          text: finalQuestion,
        },
        {
          id: timestamp + 1,
          role: "assistant",
          text:
            "Henüz analiz verisi bulunmuyor. Önce üç Excel dosyasını yükleyip Analizi Başlat butonuna basmalısınız.",
        },
      ]);

      setCopilotQuestion("");
      setCopilotTab("ask");
      return;
    }

    if (!companyId) {
      alert("Şirket bilgisi bulunamadı.");
      return;
    }

    setCopilotMessages((currentMessages) => [
      ...currentMessages,
      {
        id: timestamp,
        role: "user",
        text: finalQuestion,
      },
    ]);

    setCopilotQuestion("");
    setCopilotTab("ask");
    setIsCopilotThinking(true);

    const copilotStartedAt = Date.now();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error(
          "Oturum bulunamadı. Lütfen tekrar giriş yapınız.",
        );
      }

      // Copilot'a her soruda binlerce hastanın detaylı lookup verisini
      // tekrar göndermiyoruz. Aktif hasta varsa yalnızca onun detaylı
      // kaydı; yoksa ekranda kullanılan hafif hasta listesi gönderilir.
      const selectedPatientForCopilot = resolvedPatientContext
        ? patientLookupList.find(
            (patient) =>
              normalizeSearchText(patient.patient_name_full) ===
              normalizeSearchText(resolvedPatientContext),
          ) ?? null
        : null;

      const compactPatientMetrics = analyzeResult.patient_metrics
        ? {
            ...analyzeResult.patient_metrics,
            patient_lookup: selectedPatientForCopilot
              ? [selectedPatientForCopilot]
              : analyzeResult.patient_metrics.patients ?? [],
          }
        : null;

      const copilotAnalysisResult: AnalyzeResult = {
        ...analyzeResult,
        patient_metrics: compactPatientMetrics,
      };

      const response = await fetch(COPILOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          company_id: companyId,
          question:
            activeModule === "🤖 AYÇA Asistan"
              ? backendQuestion
              : `[Aktif ekran: ${activeModule}] ${backendQuestion}`,
          analysis_result: copilotAnalysisResult,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result?.detail ??
            "AYÇA Asistan cevap oluşturamadı.",
        );
      }

      let answer =
        result.answer ??
        "Bu soru için doğrulanmış verilerden cevap oluşturulamadı.";

      if (
        Array.isArray(result.items) &&
        result.items.length > 0
      ) {
        const itemLines = result.items
          .slice(0, 10)
          .map(
            (
              item: Record<string, unknown>,
              index: number,
            ) => {
              const name =
                (showPatientNames ? item.patient_name_full : null) ??
                item.patient_name ??
                item.doctor_name ??
                item.product_name ??
                item["Ürün Adı"] ??
                `Kayıt ${index + 1}`;

              const details: string[] = [];

              if (
                typeof item.estimated_runout_days ===
                "number"
              ) {
                details.push(
                  `${item.estimated_runout_days} gün`,
                );
              }

              if (
                typeof item["Önerilen Sipariş"] ===
                "number"
              ) {
                details.push(
                  `${item["Önerilen Sipariş"]} adet`,
                );
              }

              if (
                typeof item[
                  "Tahmini Sipariş Tutarı"
                ] === "number"
              ) {
                details.push(
                  `${Number(
                    item["Tahmini Sipariş Tutarı"],
                  ).toLocaleString("tr-TR")} ₺`,
                );
              }

              if (typeof item.turnover === "number") {
                details.push(
                  `${Number(
                    item.turnover,
                  ).toLocaleString("tr-TR")} ₺`,
                );
              }

              if (typeof item.segment === "string") {
                details.push(item.segment);
              }

              return `${index + 1}. ${String(name)}${
                details.length
                  ? ` — ${details.join(" · ")}`
                  : ""
              }`;
            },
          );

        answer += `\n\n${itemLines.join("\n")}`;
      }

      if (
        result.recommended_action &&
        !answer.includes(result.recommended_action)
      ) {
        answer += `

Önerilen aksiyon: ${result.recommended_action}`;
      }

      const minimumThinkingTime = 650;
      const elapsed = Date.now() - copilotStartedAt;

      if (elapsed < minimumThinkingTime) {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, minimumThinkingTime - elapsed),
        );
      }

      setIsCopilotThinking(false);

      setCopilotMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          role: "assistant",
          text: answer,
        },
      ]);
    } catch (error) {
      setIsCopilotThinking(false);
      console.error("Copilot error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "AYÇA Asistan ile bağlantı kurulamadı.";

      setCopilotMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          role: "assistant",
          text: `Asistan hatası: ${message}`,
        },
      ]);
    }
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

      {isTurnoverDetailOpen && (
        <div
          role="presentation"
          onClick={() => setIsTurnoverDetailOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(15, 23, 42, 0.42)",
            backdropFilter: "blur(4px)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="turnover-detail-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              borderRadius: 24,
              border: "1px solid rgba(15, 138, 108, 0.15)",
              background: "#ffffff",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
              padding: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 18,
              }}
            >
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#0f8a6c",
                    marginBottom: 5,
                  }}
                >
                  {financePeriodDateLabel}
                </span>
                <h2
                  id="turnover-detail-title"
                  style={{
                    margin: 0,
                    fontSize: 22,
                    color: "#0f172a",
                  }}
                >
                  💰 Ciro Detayı
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsTurnoverDetailOpen(false)}
                aria-label="Ciro detayını kapat"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#475569",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 16px",
                  borderRadius: 16,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <span style={{ fontWeight: 800, color: "#334155" }}>
                  Toplam Ciro
                </span>
                <strong style={{ fontSize: 18, color: "#0f172a" }}>
                  {financeAvailable
                    ? `${totalTurnover.toLocaleString("tr-TR")} ₺`
                    : "—"}
                </strong>
              </div>

              {!financeAvailable ? (
                <p
                  style={{
                    margin: 0,
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: "#fff7ed",
                    color: "#9a3412",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  ⚠️ {financeErrorMessage}
                </p>
              ) : turnoverBreakdownAvailable ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "13px 16px",
                      borderRadius: 16,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span style={{ fontWeight: 750, color: "#475569" }}>
                      🏥 SGK Cirosu
                    </span>
                    <strong style={{ color: "#0f172a" }}>
                      {sgkTurnover.toLocaleString("tr-TR")} ₺
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "13px 16px",
                      borderRadius: 16,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span style={{ fontWeight: 750, color: "#475569" }}>
                      💵 Nakit Ciro
                    </span>
                    <strong style={{ color: "#0f172a" }}>
                      {cashTurnover.toLocaleString("tr-TR")} ₺
                    </strong>
                  </div>

                  {returnedTurnover !== 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        padding: "13px 16px",
                        borderRadius: 16,
                        border: "1px solid #fecaca",
                        background: "#fff7f7",
                      }}
                    >
                      <span style={{ fontWeight: 750, color: "#991b1b" }}>
                        ↩️ İadeli Satış
                      </span>
                      <strong style={{ color: "#991b1b" }}>
                        {returnedTurnover.toLocaleString("tr-TR")} ₺
                      </strong>
                    </div>
                  )}

                  {otherTurnover !== 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        padding: "13px 16px",
                        borderRadius: 16,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <span style={{ fontWeight: 750, color: "#475569" }}>
                        Diğer Satışlar
                      </span>
                      <strong style={{ color: "#0f172a" }}>
                        {otherTurnover.toLocaleString("tr-TR")} ₺
                      </strong>
                    </div>
                  )}

                  <p
                    style={{
                      margin: "4px 2px 0",
                      fontSize: 11,
                      lineHeight: 1.5,
                      color: "#64748b",
                    }}
                  >
                    SGK, satış dosyasındaki “Medula Satış”; nakit ise “Nakit Satış”
                    kayıtlarından hesaplanır. İadeler toplam ciroya mevcut işaretleriyle
                    yansır.
                  </p>
                </>
              ) : (
                <p
                  style={{
                    margin: 0,
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: "#fff7ed",
                    color: "#9a3412",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  Bu dosyada Satış Tipi alanı bulunamadığı için SGK/Nakit kırılımı
                  oluşturulamadı.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
      <aside className={`insight-sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div
          style={{
            padding: "10px 10px 12px",
          }}
        >
          <div
            style={{
              width: "100%",
              borderRadius: 16,
              padding: "8px 10px",
              background: "#ffffff",
              border: "1px solid rgba(103,232,249,.26)",
              boxShadow: "0 10px 24px rgba(0,0,0,.10)",
              overflow: "hidden",
            }}
          >
            <img
              src="/ayca-logo.png"
              alt="AYÇA - Akıllı Yazılım Çözüm Asistanı"
              style={{
                display: "block",
                width: "100%",
                height: 68,
                objectFit: "contain",
                objectPosition: "center",
              }}
            />
          </div>

          <p
            className="sidebar-subtitle"
            style={{
              margin: "10px 0 0",
              textAlign: "center",
              color: "#b7f7df",
              fontSize: 11,
              fontWeight: 850,
            }}
          >
            Eczane Yönetim Zekâsı
          </p>
        </div>

        <nav>
          {modules.map((item) => (
            <button
              key={item}
              className={activeModule === item ? "active" : ""}
              onClick={() => { setActiveModule(item); setIsMobileMenuOpen(false); }}
            >
              {item}
            </button>
          ))}
        </nav>

        <div
          style={{
            marginTop: "auto",
            padding: "12px",
            display: "grid",
            gap: "10px",
          }}
        >
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: "14px",
              padding: "12px",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 800 }}>
                Veri Güveni
              </span>
              <strong style={{ fontSize: "16px" }}>
                {hasAnalysis ? `%${analysisConfidenceScore}` : "-"}
              </strong>
            </div>

            <div
              style={{
                height: "7px",
                borderRadius: "999px",
                overflow: "hidden",
                background: "rgba(255,255,255,0.14)",
              }}
            >
              <div
                style={{
                  width: `${hasAnalysis ? analysisConfidenceScore : 0}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #facc15 0%, #22c55e 100%)",
                  transition: "width 250ms ease",
                }}
              />
            </div>

            <p
              style={{
                margin: "8px 0 0",
                fontSize: "10px",
                lineHeight: 1.4,
                opacity: 0.72,
              }}
            >
              Analiz motorlarının doğrulama oranı
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 4px",
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
                background: "rgba(255,255,255,0.12)",
                fontWeight: 900,
              }}
            >
              {(fullName?.trim()?.[0] || email?.[0] || "A").toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: "block",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {fullName?.trim() || "Eczane Kullanıcısı"}
              </strong>
              <small
                style={{
                  display: "block",
                  marginTop: "2px",
                  opacity: 0.7,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {company?.name ?? "Eczane"}
              </small>
            </div>
          </div>

          <button className="logout-btn" onClick={logout}>
            Çıkış Yap
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="Mobil menüyü kapat"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <section className="insight-content">
        <header
          className="insight-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 22,
            padding: "22px 26px",
            borderRadius: 24,
            border: "1px solid rgba(14, 165, 233, .10)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,.98) 0%, rgba(241,250,248,.97) 48%, rgba(239,246,255,.98) 100%)",
            boxShadow: "0 16px 44px rgba(15,23,42,.055)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Menüyü aç"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 170,
              top: -48,
              width: 260,
              height: 180,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(45,212,191,.10) 0%, rgba(96,165,250,.06) 45%, transparent 72%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ minWidth: 0, position: "relative", zIndex: 1 }}>
            <span
              style={{
                display: "block",
                marginBottom: 12,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: ".02em",
                color: "#0f8a6c",
              }}
            >
              Akıllı Yazılım Çözüm Asistanı
            </span>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(30px, 3vw, 48px)",
                lineHeight: 1,
                color: "#101542",
                letterSpacing: "-.035em",
              }}
            >
              Günaydın, {fullName?.trim() || "Hoş geldiniz"} 👋
            </h1>

            <p
              style={{
                margin: "12px 0 0",
                color: "#64748b",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {company?.name ?? "Eczane"} · {email}
            </p>
          </div>

          <div className="ayca-header-v3-stack">
            <button
              type="button"
              onClick={() => {
                if (assistantOrbDragRef.current.moved) {
                  assistantOrbDragRef.current.moved = false;
                  return;
                }
                setIsAssistantDrawerOpen(true);
              }}
              onPointerDown={handleAssistantOrbPointerDown}
              onPointerUp={handleAssistantOrbPointerUp}
              onPointerCancel={handleAssistantOrbPointerUp}
              style={{
                transform: `translate3d(${assistantOrbPosition.x}px, ${assistantOrbPosition.y}px, 0)`,
                touchAction: "none",
              }}
              aria-label="AYÇA Asistanı aç veya taşı"
              title="AYÇA Asistan"
              className={`ayca-header-orb-button ${isCopilotThinking ? "is-thinking" : totalRiskItems > 0 ? "has-alert" : "is-ready"}`}
            >
              <span className="ayca-header-orbit" aria-hidden="true" />
              <span className="ayca-orb-v3 ayca-orb-v3-header" aria-hidden="true">
                <span className="ayca-orb-v3-orbit ayca-orb-v3-orbit-a" />
                <span className="ayca-orb-v3-orbit ayca-orb-v3-orbit-b" />
                <span className="ayca-orb-v3-logo">
                  <span className="ayca-orb-v3-word" aria-label="AYÇA">
                    <span className="ayca-letter ayca-letter-navy">A</span>
                    <span className="ayca-letter ayca-letter-green">Y</span>
                    <span className="ayca-letter ayca-letter-navy">Ç</span>
                    <span className="ayca-letter ayca-letter-navy">A</span>
                  </span>
                  <small>ASİSTAN</small>
                </span>
                <span className="ayca-orb-v3-particle ayca-orb-v3-p1" />
                <span className="ayca-orb-v3-particle ayca-orb-v3-p2" />
              </span>
              <span className="ayca-header-spark ayca-header-spark-one" aria-hidden="true" />
              <span className="ayca-header-spark ayca-header-spark-two" aria-hidden="true" />
              <span
                aria-hidden="true"
                className={hasAnalysis ? "ayca-orb-online-dot" : "ayca-orb-offline-dot"}
              />
            </button>
            <div className="ayca-header-v3-period">
              <div style={{ display: "grid", gap: 7, width: "100%" }}>
              <select
                value={financePeriod}
                onChange={(event) => {
                  const nextPeriod = event.target.value as FinancePeriod;
                  setFinancePeriod(nextPeriod);
                  setWeekOffset(0);
                }}
                aria-label="Finans dönemi"
                title="Ciro ve kâr dönemini seç"
                style={{
                  minWidth: 118,
                  minHeight: 42,
                  padding: "8px 34px 8px 12px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#0f172a",
                  fontSize: 12,
                  fontWeight: 850,
                  boxShadow: "0 5px 14px rgba(15,23,42,.05)",
                }}
              >
                <option value="week">Bu Hafta</option>
                <option value="month">Bu Ay</option>
                <option value="3months">Son 3 Ay</option>
                <option value="year">Bu Yıl</option>
                <option value="all">Tümü</option>
              </select>

              {financePeriod === "week" && (
                <div
                  aria-label="Hafta seçimi"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    fontSize: 9,
                    color: "#64748b",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setWeekOffset((current) =>
                        Math.min(
                          current + 1,
                          Math.max(financeWeekMetrics.length - 1, 0),
                        ),
                      )
                    }
                    disabled={!canGoToPreviousWeek}
                    title="Önceki hafta"
                  >
                    ←
                  </button>
                  <span title={financePeriodDateLabel}>{financePeriodLabel}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setWeekOffset((current) => Math.max(current - 1, 0))
                    }
                    disabled={!canGoToNextWeek}
                    title="Sonraki hafta"
                  >
                    →
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
        </header>

{activeModule !== "🤖 AYÇA Asistan" && (
          <section
            key={activeModule}
            className="active-module-title ayca-module-heading-enter"
          >
            <h2>{activeModule}</h2>
            <p>
              {activeModule === "🏠 Dashboard"
                ? "Eczanenizin genel durumunu, bugünün önceliklerini ve analiz özetini tek ekranda görün."
                : activeModule === "📦 Operasyon"
                  ? "Sipariş, risk, stok bitişi ve ölü stok kararlarını tek çalışma alanında yönetin."
                  : activeModule === "💰 Finans"
                    ? "Ciro, kâr, marj, sermaye ve finansal performansı tek merkezden izleyin."
                    : "Hasta, doktor, kurum ve reçete ilişkilerini tek merkezde yönetin."}
            </p>
          </section>
        )}

        {!hasAnalysis &&
        activeModule !== "🏠 Dashboard" &&
        activeModule !== "🤖 AYÇA Asistan" ? (
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
                onClick={() => navigateToModule("🤖 AYÇA Asistan")}
                aria-label="AYÇA Asistanı aç"
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
                <em className="navigation-hint">AYÇA’ya sor →</em>
              </button>
            </section>

            <section className="insight-kpi-grid dashboard-kpis">
              <button
                type="button"
                className="insight-kpi kpi-blue dashboard-navigation-card"
                onClick={() => navigateToOperation("risk")}
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
                onClick={() => navigateToOperation("stock")}
              >
                <b>📦</b>
                <span>Kritik Stok</span>
                <strong>{metrics?.critical_stock_count ?? "-"}</strong>
                <p>Acil kontrol gerektiren ürün</p>
                <em className="navigation-hint">Ürünleri aç →</em>
              </button>
              <button
                type="button"
                className="insight-kpi kpi-green dashboard-navigation-card"
                onClick={() => navigateToOperation("stock")}
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
                onClick={() => navigateToModule("🤖 AYÇA Asistan")}
              >
                <b>🤖</b>
                <span>AYÇA Önerileri</span>
                <strong>
                  {suggestionCount}
                </strong>
                <p>Karar destek aksiyonu</p>
                <em className="navigation-hint">Asistanı aç →</em>
              </button>
            </section>

            <section
              className="dashboard-finance-summary-grid"
              aria-label="Dashboard finans ve stok özeti"
            >
              <button
                type="button"
                className="insight-kpi dashboard-navigation-card dashboard-finance-compact-kpi"
                onClick={() => navigateToModule("💰 Finans")}
              >
                <b>💵</b>
                <span>Ciro</span>
                <strong>
                  {hasAnalysis && financeAvailable
                    ? `${totalTurnover.toLocaleString("tr-TR")} ₺`
                    : "—"}
                </strong>
                <p>
                  {hasAnalysis && !financeAvailable
                    ? "Finans verisi hesaplanamadı"
                    : `${financePeriodLabel} toplam satış`}
                </p>
                <em className="navigation-hint">Finansı aç →</em>
              </button>

              <button
                type="button"
                className="insight-kpi dashboard-navigation-card dashboard-finance-compact-kpi"
                onClick={() => navigateToModule("💰 Finans")}
              >
                <b>📈</b>
                <span>Net Kâr</span>
                <strong>
                  {hasAnalysis && financeAvailable
                    ? `${totalProfit.toLocaleString("tr-TR")} ₺`
                    : "—"}
                </strong>
                <p>
                  {hasAnalysis && !financeAvailable
                    ? "Finans verisi hesaplanamadı"
                    : `${financePeriodLabel} doğrulanmış kâr`}
                </p>
                <em className="navigation-hint">Finansı aç →</em>
              </button>

              <button
                type="button"
                className="dashboard-stock-risk-card"
                onClick={() => navigateToOperation("risk")}
              >
                <div className="dashboard-mini-card-head">
                  <div>
                    <span>📦 Stok Risk Görünümü</span>
                    <strong>{totalRiskItems}</strong>
                    <small>Öne çıkan risk sinyalleri</small>
                  </div>
                  <span className="dashboard-card-arrow">→</span>
                </div>
                <div className="dashboard-stock-risk-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardRiskChartData}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar dataKey="value" radius={[7, 7, 2, 2]}>
                        {dashboardRiskChartData.map((_, index) => (
                          <Cell
                            key={`risk-mini-${index}`}
                            fill={["#ef4444", "#f59e0b", "#8b5cf6", "#64748b"][index]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </button>

              <button
                type="button"
                className="dashboard-patient-summary-card"
                onClick={() => navigateToModule("👥 Hasta & Reçete")}
              >
                <div className="dashboard-mini-card-head">
                  <div>
                    <span>👥 Hasta Segmentleri</span>
                    <strong>{hasAnalysis ? totalPatientCount.toLocaleString("tr-TR") : "-"}</strong>
                    <small>Toplam hasta</small>
                  </div>
                  <span className="dashboard-card-arrow">→</span>
                </div>
                <div className="dashboard-patient-summary-chart">
                  {dashboardPatientSegmentData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardPatientSegmentData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={32}
                          outerRadius={51}
                          paddingAngle={3}
                        >
                          {dashboardPatientSegmentData.map((_, index) => (
                            <Cell
                              key={`patient-mini-${index}`}
                              fill={["#7c3aed", "#a855f7", "#3b82f6", "#14b8a6"][index % 4]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="middle" align="right" layout="vertical" iconSize={7} wrapperStyle={{ fontSize: 9 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="dashboard-trend-empty">Analiz sonrası segmentler oluşacak</div>
                  )}
                </div>
              </button>
            </section>

            <section className="dashboard-dashboard-second-row">
              <button
                type="button"
                className="dashboard-finance-trend-card dashboard-finance-trend-full"
                onClick={() => navigateToModule("💰 Finans")}
              >
                <div className="dashboard-trend-head">
                  <div>
                    <span>FİNANSAL PERFORMANS</span>
                    <h2>Ciro & Kâr Trendi</h2>
                    <small>Son 7 günlük ciro ve kâr performansı</small>
                  </div>
                  <div className="dashboard-trend-legend">
                    <span><i className="turnover-dot" /> Ciro</span>
                    <span><i className="profit-dot" /> Kâr</span>
                  </div>
                </div>

                <div className="dashboard-finance-trend-chart">
                  {financeAvailable && financeDailyRevenue.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={financeDailyRevenue} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0b5558" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#0b5558" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="dashboardProfitFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.13} />
                            <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e8eef3" />
                        <XAxis
                          dataKey="day"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 11 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                          tickFormatter={(value) => `${Math.round(Number(value) / 1000)}K`}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            `${Number(value ?? 0).toLocaleString("tr-TR")} ₺`,
                            name === "value" ? "Ciro" : "Kâr",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#0b5558"
                          strokeWidth={3}
                          fill="url(#dashboardRevenueFill)"
                          activeDot={{ r: 5 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="profit"
                          stroke="#14b8a6"
                          strokeWidth={2.2}
                          fill="url(#dashboardProfitFill)"
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="dashboard-trend-empty">Analiz sonrası trend oluşacak</div>
                  )}
                </div>
              </button>

            </section>

            <section id="ayca-morning-briefing" className="dashboard-command-grid">
              <div className="insight-card command-card">
                <div className="section-heading">
                  <div>
                    <span>BUGÜNÜN ÖNCELİKLERİ</span>
                    <h2>AYÇA Ne Yapmalı Diyor?</h2>
                  </div>
                  <button onClick={() => navigateToModule("🤖 AYÇA Asistan")}>
                    AYÇA’ya sor →
                  </button>
                </div>
                <div className="ayca-briefing-summary">
                  <strong>
                    {hasAnalysis
                      ? `Bugün eczanen için ${dashboardBriefing.length} önemli içgörü var.`
                      : "AYÇA günlük briefingi analiz bekliyor."}
                  </strong>
                  <span>
                    Öncelik, zaman baskısı ve finansal etkiye göre sıralandı.
                  </span>
                </div>

                <div className="ayca-briefing-list">
                  {dashboardBriefing.map((item, index) => (
                    <article
                      className={`ayca-briefing-item is-${item.level}`}
                      key={item.id}
                    >
                      <div className="ayca-briefing-meta">
                        <span className={`ayca-briefing-level is-${item.level}`}>
                          {String(index + 1).padStart(2, "0")} · {item.levelLabel}
                        </span>
                        <span className="ayca-briefing-category">
                          {item.category}
                        </span>
                      </div>

                      <div className="ayca-briefing-copy">
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>

                      <button
                        type="button"
                        className="ayca-briefing-action"
                        onClick={() => {
                          if (item.action === "stock") {
                            navigateToOperation("stock");
                          } else if (item.action === "risk") {
                            navigateToOperation("risk");
                          } else if (item.action === "finance") {
                            navigateToModule("💰 Finans");
                          } else if (item.action === "patient") {
                            navigateToModule("👥 Hasta & Reçete");
                          } else {
                            setIsAssistantDrawerOpen(true);
                          }
                        }}
                      >
                        {item.actionLabel} <span>→</span>
                      </button>
                    </article>
                  ))}
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
                <button
                  type="button"
                  className="report-download-btn"
                  onClick={() => void downloadAnalysisReport()}
                  disabled={!analyzeResult}
                >
                  📥 Excel Raporunu İndir
                </button>
              </div>

              <div className="insight-card opportunity-card">
                <div className="section-heading">
                  <div>
                    <span>FIRSAT RADARI</span>
                    <h2>Öne Çıkan Siparişler</h2>
                  </div>
                  <button
                    onClick={() => navigateToOperation("stock")}
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
                      onClick={() => navigateToOperation("stock")}
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


            </section>
          </>
        )}

        {activeModule === "📦 Operasyon" && (
          <section className="operation-tab-shell">
            <div className="operation-tabs" role="tablist" aria-label="Operasyon bölümleri">
              {[
                ["stock", "✦ Sipariş Önerileri"],
                ["risk", "🚨 Risk Merkezi"],
                ["runout", "⏱️ Stok Bitiş"],
                ["dead", "💀 Fazla / Ölü Stok"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={operationTab === key ? "active" : ""}
                  onClick={() => setOperationTab(key as OperationTab)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {activeModule === "📦 Operasyon" && operationTab === "stock" && (
          <section className="order-center">
            <header className="order-center-hero">
              <div>
                <span className="order-center-kicker">AYÇA SİPARİŞ MERKEZİ</span>
                <h2>
                  {hasAnalysis
                    ? `Bugün ${suggestionCount} ürün için sipariş önerisi var`
                    : "Sipariş önerileri analizden sonra oluşacak"}
                </h2>
                <p>
                  AYÇA satış hızını, mevcut stoğu ve hedef stok seviyesini
                  birlikte değerlendirerek önerileri önceliklendirir.
                </p>
              </div>

              <div className="order-center-budget">
                <span>TAHMİNİ SİPARİŞ BÜTÇESİ</span>
                <strong>
                  {estimatedOrderAmount
                    ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                    : "—"}
                </strong>
                <small>
                  {orderSuggestions.length
                    ? `${orderSuggestions.reduce(
                        (sum, item) => sum + (item["Önerilen Sipariş"] ?? 0),
                        0,
                      ).toLocaleString("tr-TR")} adet toplam öneri`
                    : "Analiz bekleniyor"}
                </small>
              </div>
            </header>

            <section className="ayca-decision-card">
              <div className="ayca-decision-mark">✦</div>
              <div className="ayca-decision-content">
                <span>AYÇA ÖNERİYOR · SİPARİŞ</span>
                <strong>
                  {orderSuggestions.length > 0
                    ? `${orderSuggestions.length} ürün için satın alma planını önceliklendir.`
                    : "Sipariş kararı için analiz bekleniyor."}
                </strong>
                <p>
                  {orderSuggestions.length > 0
                    ? `Satış hızı ve hedef stok seviyesine göre yaklaşık ${
                        estimatedOrderAmount
                          ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                          : "hesaplanan"
                      } bütçelik sipariş ihtiyacı oluştu. Önce yüksek öncelikli ürünleri değerlendir.`
                    : "Analiz tamamlandığında AYÇA neyi, neden ve ne kadar sipariş etmeniz gerektiğini burada özetleyecek."}
                </p>
              </div>
              <button type="button" onClick={() => setIsAssistantDrawerOpen(true)}>
                AYÇA’ya sor <span>→</span>
              </button>
            </section>

            <div className="order-center-summary">
              <div>
                <span>ACİL / YÜKSEK</span>
                <strong>
                  {
                    orderSuggestions.filter((item) =>
                      ["acil", "yüksek", "kritik", "high", "critical"].some(
                        (level) =>
                          String(item["Öncelik"] ?? "")
                            .toLocaleLowerCase("tr-TR")
                            .includes(level),
                      ),
                    ).length
                  }
                </strong>
                <small>Önce değerlendirilmesi gereken</small>
              </div>

              <div>
                <span>KRİTİK STOK</span>
                <strong>{criticalStockCount}</strong>
                <small>Stok riski taşıyan ürün</small>
              </div>

              <div>
                <span>ORT. ÖNERİ TUTARI</span>
                <strong>
                  {orderSuggestions.length && estimatedOrderAmount
                    ? `${Math.round(
                        estimatedOrderAmount / orderSuggestions.length,
                      ).toLocaleString("tr-TR")} ₺`
                    : "—"}
                </strong>
                <small>Ürün başına tahmini bütçe</small>
              </div>

              <div>
                <span>FAZLA STOK</span>
                <strong>{overStockCount ?? "—"}</strong>
                <small>Yeni sipariş öncesi kontrol</small>
              </div>
            </div>

            <div className="order-center-heading">
              <div>
                <h3>Önerilen Siparişler</h3>
                <p>En yüksek öncelikten başlayarak listelenir.</p>
              </div>
              <span>{orderSuggestions.length} ürün</span>
            </div>

            {orderSuggestions.length ? (
              <div className="order-center-list">
                {orderSuggestions.map((item, index) => {
                  const priority = String(item["Öncelik"] ?? "Orta");
                  const priorityKey = priority
                    .toLocaleLowerCase("tr-TR")
                    .replaceAll("ı", "i")
                    .replaceAll("ş", "s")
                    .replaceAll("ğ", "g")
                    .replaceAll("ü", "u")
                    .replaceAll("ö", "o")
                    .replaceAll("ç", "c")
                    .replace(/[^a-z0-9]+/g, "-");

                  return (
                    <article
                      className={`order-recommendation priority-${priorityKey}`}
                      key={`${item["Ürün Adı"]}-${index}`}
                    >
                      <div className="order-priority-column">
                        <span className="order-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="order-priority-pill">{priority}</span>
                      </div>

                      <div className="order-product-column">
                        <strong>{item["Ürün Adı"]}</strong>
                        <div className="order-product-metrics">
                          <span>
                            <small>MEVCUT STOK</small>
                            <b>{item.Stok}</b>
                          </span>
                          <span>
                            <small>DÖNEM SATIŞI</small>
                            <b>{item["Satılan Adet"]}</b>
                          </span>
                          <span>
                            <small>GÜNLÜK TÜKETİM</small>
                            <b>
                              {item["Günlük Tüketim"] != null
                                ? Number(item["Günlük Tüketim"]).toLocaleString(
                                    "tr-TR",
                                    { maximumFractionDigits: 1 },
                                  )
                                : "—"}
                            </b>
                          </span>
                          <span>
                            <small>STOK SÜRESİ</small>
                            <b>
                              {item["Stok Gün Karşılığı"] != null
                                ? `${Math.round(
                                    Number(item["Stok Gün Karşılığı"]),
                                  )} gün`
                                : "—"}
                            </b>
                          </span>
                          <span>
                            <small>HEDEF STOK</small>
                            <b>{item["Hedef Stok"] ?? "—"}</b>
                          </span>
                        </div>
                      </div>

                      <div className="order-result-column">
                        <span>AYÇA ÖNERİSİ</span>
                        <strong>{item["Önerilen Sipariş"]} adet</strong>
                        <small>
                          {item["Tahmini Sipariş Tutarı"] != null
                            ? `${Number(
                                item["Tahmini Sipariş Tutarı"],
                              ).toLocaleString("tr-TR")} ₺`
                            : "Tutar hesaplanamadı"}
                        </small>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="order-center-empty">
                <span>✦</span>
                <strong>Henüz sipariş önerisi yok</strong>
                <p>
                  Analiz tamamlandığında AYÇA ürünleri satış hızı ve stok
                  ihtiyacına göre burada sıralayacak.
                </p>
              </div>
            )}
          </section>
        )}

        {activeModule === "📦 Operasyon" && operationTab === "runout" && (
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

            <section className="ayca-decision-card">
              <div className="ayca-decision-mark">✦</div>
              <div className="ayca-decision-content">
                <span>AYÇA ÖNERİYOR · STOK BİTİŞ</span>
                <strong>
                  {stockRunoutProducts.length > 0
                    ? `${stockRunoutProducts.filter((item) => item.estimated_runout_days <= 7).length} ürünü bugün kontrol et.`
                    : "Yakın dönem stok bitiş riski görünmüyor."}
                </strong>
                <p>
                  {stockRunoutProducts.length > 0
                    ? `En yakın stok bitişi ${Math.min(...stockRunoutProducts.map((item) => item.estimated_runout_days))} gün. Satış kaybını önlemek için en kısa stok süresine sahip ürünlerden başla.`
                    : "Satış hızı ve mevcut stok birlikte değerlendirildiğinde acil aksiyon gerektiren ürün bulunmadı."}
                </p>
              </div>
              <button type="button" onClick={() => setIsAssistantDrawerOpen(true)}>
                Nedenini sor <span>→</span>
              </button>
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

        {activeModule === "📦 Operasyon" && operationTab === "dead" && (
          <>
            <section className="insight-kpi-grid">
              <div className="insight-kpi risk-kpi risk-kpi-overstock">
                <span>💀 Ölü Stok</span><strong>{deadStockCount}</strong><p>Analiz döneminde hareket görmeyen ürün</p>
              </div>
              <div className="insight-kpi risk-kpi risk-kpi-loss">
                <span>💸 Bağlı Sermaye</span><strong>{deadStockValue.toLocaleString("tr-TR")} ₺</strong><p>Hareketsiz stoktaki tahmini değer</p>
              </div>
            </section>
            <section className="ayca-decision-card">
              <div className="ayca-decision-mark">✦</div>
              <div className="ayca-decision-content">
                <span>AYÇA ÖNERİYOR · SERMAYE</span>
                <strong>
                  {deadStockCount > 0
                    ? `${deadStockCount} hareketsiz üründe bağlı sermayeyi azalt.`
                    : "Hareketsiz stok için acil aksiyon görünmüyor."}
                </strong>
                <p>
                  {deadStockCount > 0
                    ? `${deadStockValue.toLocaleString("tr-TR")} ₺ değerindeki ölü stok için iade, transfer veya satış hızlandırma seçeneklerini ürün bazında değerlendir.`
                    : "Analiz döneminde satış hareketi olmayan anlamlı bir stok kümesi tespit edilmedi."}
                </p>
              </div>
              <button type="button" onClick={() => setIsAssistantDrawerOpen(true)}>
                Plan oluştur <span>→</span>
              </button>
            </section>

            <section className="insight-card">
              <h2>💀 Ölü / Hareketsiz Stok Listesi</h2>
              <p>Stokta olup analiz döneminde satış hareketi görülmeyen ürünler.</p>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Ürün</th><th>Stok</th><th>Dönem Satışı</th><th>Stok Değeri</th><th>✦ AYÇA Aksiyonu</th></tr></thead>
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

        {activeModule === "💰 Finans" && (
          <>
            <section className="finance-premium-kpis">
              <button
                type="button"
                className="finance-premium-kpi"
                onClick={() => setIsTurnoverDetailOpen(true)}
                title="SGK ve nakit ciro detayını gör"
              >
                <span>TOPLAM CİRO</span>
                <strong>
                  {financeAvailable && analyzeResult?.finance_metrics?.success
                    ? `${totalTurnover.toLocaleString("tr-TR")} ₺`
                    : "—"}
                </strong>
                <p>{financePeriodLabel} toplam satış</p>
                <em>Detayı gör →</em>
              </button>

              <div className="finance-premium-kpi">
                <span>BRÜT KÂR</span>
                <strong>
                  {financeAvailable && analyzeResult?.finance_metrics?.success
                    ? `${totalProfit.toLocaleString("tr-TR")} ₺`
                    : "—"}
                </strong>
                <p>Doğrulanmış dönem kârı</p>
              </div>

              <div className="finance-premium-kpi">
                <span>KÂR MARJI</span>
                <strong>
                  {financeAvailable && analyzeResult?.finance_metrics?.success
                    ? `%${profitMargin.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`
                    : "—"}
                </strong>
                <p>Ciro içindeki kâr oranı</p>
                <div className="finance-margin-line">
                  <i style={{ width: `${Math.max(4, Math.min(100, profitMargin))}%` }} />
                </div>
              </div>

              <div className="finance-premium-kpi">
                <span>SİPARİŞ SERMAYESİ</span>
                <strong>
                  {estimatedOrderAmount
                    ? `${estimatedOrderAmount.toLocaleString("tr-TR")} ₺`
                    : "—"}
                </strong>
                <p>Önerilen sipariş bütçesi</p>
              </div>
            </section>

            <section className="ayca-decision-card finance-ayca-decision">
              <div className="ayca-decision-mark">✦</div>
              <div className="ayca-decision-content">
                <span>AYÇA FİNANS YORUMU</span>
                <strong>
                  {!hasAnalysis
                    ? "Finansal karar için analiz bekleniyor."
                    : profitMargin < 15
                      ? `Kâr marjı %${profitMargin.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}; marj baskısını öncelikli incele.`
                      : (overStockCount ?? 0) > 0
                        ? `${overStockCount} ürün sermaye bağlıyor; nakit verimliliğini artırmak için fazla stoğu azalt.`
                        : "Finansal görünüm dengeli; kârlı ürünlerin payını korumaya odaklan."}
                </strong>
                <p>
                  {!hasAnalysis
                    ? "Analiz tamamlandığında AYÇA ciro, kâr, marj, stok sermayesi ve sipariş bütçesini birlikte yorumlayacak."
                    : `${financePeriodLabel} cirosu ${totalTurnover.toLocaleString("tr-TR")} ₺ ve doğrulanmış kâr ${totalProfit.toLocaleString("tr-TR")} ₺. ${
                        estimatedOrderAmount
                          ? `Planlanan sipariş bütçesi ${estimatedOrderAmount.toLocaleString("tr-TR")} ₺.`
                          : ""
                      }`}
                </p>
              </div>
              <button type="button" onClick={() => setIsAssistantDrawerOpen(true)}>
                Finansını yorumla <span>→</span>
              </button>
            </section>

            <section className="finance-premium-chart-card">
              <div className="finance-premium-section-head">
                <div>
                  <span>FİNANSAL PERFORMANS</span>
                  <h2>Ciro & Kâr Trendi</h2>
                  <p>{financePeriodDateLabel} · gerçek satış performansı</p>
                </div>
                <div className="finance-chart-legend">
                  <span><i className="revenue-dot" /> Ciro</span>
                  <span><i className="profit-dot" /> Kâr</span>
                </div>
              </div>

              <div className="ayca-chart-shell ayca-chart-large finance-premium-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={financeDailyRevenue}
                    margin={{ top: 18, right: 18, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="financeRevenueGradientPremium" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0b5558" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#0b5558" stopOpacity={0.015} />
                      </linearGradient>
                      <linearGradient id="financeProfitGradientPremium" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.16} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e8eef2" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1000)}K`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid #dbe5e7",
                        boxShadow: "0 14px 30px rgba(15,23,42,.10)",
                      }}
                      formatter={(value, name) => [
                        `${Number(value).toLocaleString("tr-TR")} ₺`,
                        name === "value" ? "Ciro" : "Kâr",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0b5558"
                      strokeWidth={3}
                      fill="url(#financeRevenueGradientPremium)"
                      activeDot={{ r: 5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      fill="url(#financeProfitGradientPremium)"
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="finance-premium-bottom-grid">
              <div className="finance-premium-panel">
                <div className="finance-premium-section-head compact">
                  <div>
                    <span>KÂRLILIK</span>
                    <h2>En Karlı Ürünler</h2>
                    <p>Gerçek kâr katkısı en yüksek ürünler</p>
                  </div>
                </div>

                <div className="finance-product-list">
                  {financeTopProducts.length > 0 ? (
                    financeTopProducts.map((product, index) => (
                      <div className="finance-product-row" key={product.name}>
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.sales} adet satış</small>
                        </div>
                        <span>{product.profit.toLocaleString("tr-TR")} ₺</span>
                      </div>
                    ))
                  ) : (
                    <div className="finance-empty">Analiz sonrası ürün kârlılığı burada görünecek.</div>
                  )}
                </div>
              </div>

              <div className="finance-premium-panel">
                <div className="finance-premium-section-head compact">
                  <div>
                    <span>SERMAYE</span>
                    <h2>Sermaye Bağlayan Ürünler</h2>
                    <p>Stokta en fazla kaynak tutan ürünler</p>
                  </div>
                </div>

                <div className="finance-product-list">
                  {financeCapitalProducts.length > 0 ? (
                    financeCapitalProducts.map((product, index) => (
                      <div className="finance-product-row" key={product.name}>
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.stock} adet stok</small>
                        </div>
                        <span>{product.value.toLocaleString("tr-TR")} ₺</span>
                      </div>
                    ))
                  ) : (
                    <div className="finance-empty">Sermaye bağlayan ürün bulunamadı.</div>
                  )}
                </div>
              </div>
            </section>

            <section className="finance-premium-strip">
              <div>
                <span>İŞLEM SAYISI</span>
                <strong>{transactionCount.toLocaleString("tr-TR")}</strong>
                <small>Toplam satış işlemi</small>
              </div>
              <div>
                <span>ORTALAMA SEPET</span>
                <strong>{averageSale ? `${averageSale.toLocaleString("tr-TR")} ₺` : "—"}</strong>
                <small>İşlem başına satış</small>
              </div>
              <div>
                <span>FAZLA STOK</span>
                <strong>{overStockCount ?? "—"}</strong>
                <small>Sermaye riski bulunan ürün</small>
              </div>
              <div>
                <span>VERİ GÜVENİ</span>
                <strong>%{analysisConfidenceScore}</strong>
                <small>Analiz güven skoru</small>
              </div>
            </section>
          </>
        )}

        {activeModule === "📦 Operasyon" && operationTab === "risk" && (
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

            <section className="ayca-decision-card">
              <div className="ayca-decision-mark">✦</div>
              <div className="ayca-decision-content">
                <span>AYÇA ÖNERİYOR · RİSK</span>
                <strong>
                  {totalRiskItems > 0
                    ? `${totalRiskItems} stok sinyalini önem sırasına göre ele al.`
                    : "Operasyonel risk seviyesi kontrollü görünüyor."}
                </strong>
                <p>
                  {totalRiskItems > 0
                    ? `${zeroStockCount} sıfır stok, ${criticalStockCount} kritik stok ve ${overStockCount ?? 0} fazla stok sinyali var. Önce satış kaybı yaratabilecek sıfır ve kritik stokları çöz.`
                    : "Mevcut analizde acil stok müdahalesi gerektiren anlamlı bir risk sinyali oluşmadı."}
                </p>
              </div>
              <button type="button" onClick={() => setIsAssistantDrawerOpen(true)}>
                Riskleri yorumla <span>→</span>
              </button>
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
                      <th>✦ AYÇA Aksiyonu</th>
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

        {activeModule === "👥 Hasta & Reçete" && (
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
                <span>👥 Toplam Hasta</span>
                <strong>{totalPatientCount || "-"}</strong>
                <p>Analiz dönemindeki benzersiz hasta</p>
              </div>
              <div className="insight-kpi patient-kpi patient-kpi-blue">
                <span>🔵 Aktif Hasta</span>
                <strong>{patientMetrics?.active_patient_count || "-"}</strong>
                <p>Analiz döneminde aktif görünen hasta</p>
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
              <div className="insight-kpi patient-kpi patient-kpi-red">
                <span>🚪 Gelmeyi Bırakan</span>
                <strong>{lapsedPatientCount || "-"}</strong>
                <p>90+ gündür tekrar gelmeyen hasta</p>
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
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "#f3f0ff",
                          color: "#6d28d9",
                          fontSize: 11,
                          fontWeight: 900,
                          marginBottom: 8,
                        }}
                      >
                        HASTA DENEYİMİ V2
                      </span>
                      <h2>👥 Hasta Sadakati</h2>
                      <p>
                        Hastaları segment, ziyaret sıklığı ve geri kazanım riskine
                        göre hızlıca filtreleyin.
                      </p>
                    </div>

                    <div
                      className="patient-name-controls"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      {activePatientContextName && (
                        <span
                          style={{
                            padding: "7px 10px",
                            borderRadius: 999,
                            background: "#ecfeff",
                            color: "#0f766e",
                            border: "1px solid #a5f3fc",
                            fontSize: 11,
                            fontWeight: 900,
                          }}
                          title="AYÇA devam sorularında bu hastayı bağlam olarak kullanır."
                        >
                          ✧ Aktif hasta:{" "}
                          {showPatientNames
                            ? activePatientContextName
                            : "KVKK korumalı"}
                        </span>
                      )}

                      <div className="patient-privacy-control">
                        <div className="patient-privacy-copy">
                          <span>{showPatientNames ? "İsimler görünür" : "KVKK maskeli"}</span>
                          <small>Hasta adları</small>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showPatientNames}
                          aria-label={
                            showPatientNames
                              ? "Hasta isimlerini gizle"
                              : "Hasta isimlerini göster"
                          }
                          className={
                            showPatientNames
                              ? "patient-privacy-switch is-on"
                              : "patient-privacy-switch"
                          }
                          onClick={handlePatientNameVisibility}
                        >
                          <span aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    className="patient-segment-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    {[
                      { key: "all", label: "Tümü", icon: "👥", count: patientSegmentCounts.all },
                      { key: "VIP", label: "VIP", icon: "👑", count: patientSegmentCounts.VIP },
                      { key: "Sadık", label: "Sadık", icon: "💜", count: patientSegmentCounts.Sadık },
                      { key: "Aktif", label: "Aktif", icon: "🔵", count: patientSegmentCounts.Aktif },
                      { key: "Yeni", label: "Yeni", icon: "🌱", count: patientSegmentCounts.Yeni },
                    ].map((segment) => {
                      const isActive =
                        patientLoyaltyTab === "segments" &&
                        patientSegmentFilter === segment.key;

                      return (
                        <button
                          key={segment.key}
                          type="button"
                          onClick={() => {
                            setPatientLoyaltyTab("segments");
                            setPatientSegmentFilter(
                              segment.key as "all" | "VIP" | "Sadık" | "Aktif" | "Yeni",
                            );
                          }}
                          style={{
                            border: isActive ? "1px solid #7c3aed" : "1px solid #e5e7eb",
                            borderRadius: 16,
                            padding: "13px 12px",
                            background: isActive ? "#f5f3ff" : "#fff",
                            boxShadow: isActive
                              ? "0 8px 22px rgba(124, 58, 237, 0.12)"
                              : "0 4px 14px rgba(15, 23, 42, 0.04)",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 160ms ease",
                          }}
                        >
                          <span style={{ display: "block", fontSize: 18, marginBottom: 6 }}>
                            {segment.icon}
                          </span>
                          <strong style={{ display: "block", fontSize: 14, color: "#172554" }}>
                            {segment.label}
                          </strong>
                          <small
                            style={{
                              display: "block",
                              marginTop: 3,
                              color: "#64748b",
                              fontWeight: 800,
                            }}
                          >
                            {segment.count} hasta
                          </small>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontWeight: 900,
                              letterSpacing: ".06em",
                              color: "#64748b",
                              marginBottom: 2,
                            }}
                          >
                            AKSİYON GEREKTİRENLER
                          </span>
                          <small style={{ color: "#94a3b8", fontWeight: 700 }}>
                            Risk ve geri kazanım listelerini ayrı izleyin.
                          </small>
                        </div>

                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                          {patientLoyaltyTab === "segments"
                            ? `${patientSegmentFilter === "all" ? "Tüm segmentler" : patientSegmentFilter} · ${visibleLoyaltyPatients.length} kayıt`
                            : patientLoyaltyTab === "risk"
                              ? `${lostPatientRiskCount} hasta · İlk ${visibleLoyaltyPatients.length} kayıt gösteriliyor`
                              : `${lapsedPatientCount} hasta · İlk ${visibleLoyaltyPatients.length} kayıt gösteriliyor`}
                        </span>
                      </div>

                      <div
                        className="patient-action-grid"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 12,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setPatientLoyaltyTab("risk")}
                          style={{
                            border:
                              patientLoyaltyTab === "risk"
                                ? "1px solid #fb923c"
                                : "1px solid #fed7aa",
                            borderRadius: 16,
                            padding: "14px 16px",
                            background:
                              patientLoyaltyTab === "risk"
                                ? "#fff7ed"
                                : "linear-gradient(135deg, #fffaf5 0%, #ffffff 100%)",
                            boxShadow:
                              patientLoyaltyTab === "risk"
                                ? "0 10px 24px rgba(249, 115, 22, 0.14)"
                                : "0 4px 14px rgba(15, 23, 42, 0.04)",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 12,
                                  fontWeight: 900,
                                  color: "#c2410c",
                                  marginBottom: 4,
                                }}
                              >
                                ⚠️ Kayıp Riski
                              </span>
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: 24,
                                  lineHeight: 1,
                                  color: "#7c2d12",
                                }}
                              >
                                {lostPatientRiskCount.toLocaleString("tr-TR")}
                              </strong>
                              <small
                                style={{
                                  display: "block",
                                  marginTop: 6,
                                  color: "#9a3412",
                                  fontWeight: 700,
                                }}
                              >
                                Takip edilmesi gereken hastalar
                              </small>
                            </div>

                            <span
                              style={{
                                fontSize: 20,
                                color: "#fb923c",
                                fontWeight: 900,
                              }}
                            >
                              →
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPatientLoyaltyTab("lapsed")}
                          style={{
                            border:
                              patientLoyaltyTab === "lapsed"
                                ? "1px solid #8b5cf6"
                                : "1px solid #ddd6fe",
                            borderRadius: 16,
                            padding: "14px 16px",
                            background:
                              patientLoyaltyTab === "lapsed"
                                ? "#f5f3ff"
                                : "linear-gradient(135deg, #faf8ff 0%, #ffffff 100%)",
                            boxShadow:
                              patientLoyaltyTab === "lapsed"
                                ? "0 10px 24px rgba(124, 58, 237, 0.14)"
                                : "0 4px 14px rgba(15, 23, 42, 0.04)",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 12,
                                  fontWeight: 900,
                                  color: "#6d28d9",
                                  marginBottom: 4,
                                }}
                              >
                                🚪 Gelmeyi Bırakanlar
                              </span>
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: 24,
                                  lineHeight: 1,
                                  color: "#4c1d95",
                                }}
                              >
                                {lapsedPatientCount.toLocaleString("tr-TR")}
                              </strong>
                              <small
                                style={{
                                  display: "block",
                                  marginTop: 6,
                                  color: "#6d28d9",
                                  fontWeight: 700,
                                }}
                              >
                                Geri kazanım fırsatlarını incele
                              </small>
                            </div>

                            <span
                              style={{
                                fontSize: 20,
                                color: "#8b5cf6",
                                fontWeight: 900,
                              }}
                            >
                              →
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <input
                      type="search"
                      value={patientSearch}
                      onChange={(event) => setPatientSearch(event.target.value)}
                      placeholder={
                        showPatientNames
                          ? "🔎 Hasta adı, segment veya risk ara..."
                          : "🔎 Maskeli hasta, segment veya risk ara..."
                      }
                      aria-label="Hasta ara"
                      style={{
                        width: "100%",
                        maxWidth: 560,
                        padding: "13px 15px",
                        borderRadius: 14,
                        border: "1px solid #d9dce3",
                        background: "#fff",
                        boxShadow: "0 3px 12px rgba(15, 23, 42, 0.04)",
                      }}
                    />
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Hasta</th>
                          <th>Segment</th>
                          <th>Ziyaret</th>
                          <th>Son Ziyaret</th>
                          <th>Ciro</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLoyaltyPatients.length > 0 ? (
                          visibleLoyaltyPatients.map((patient, index) => {
                            const patientDisplayName = showPatientNames
                              ? patient.patient_name_full || patient.patient_name
                              : patient.patient_name;


                            return (
                              <tr key={`${patientLoyaltyTab}-${patient.patient_name}-${index}`}>
                                <td>
                                  <div style={{ display: "grid", gap: 3 }}>
                                    <strong>{patientDisplayName}</strong>
                                    <small style={{ color: "#94a3b8" }}>
                                      {patient.segment ?? "Standart"} hasta
                                    </small>
                                  </div>
                                </td>
                                <td>
                                  <span className="patient-segment">
                                    {patient.segment ?? "Standart"}
                                  </span>
                                </td>
                                <td>{patient.visit_count ?? "-"}</td>
                                <td>{patient.last_visit ?? "-"}</td>
                                <td>
                                  {patient.turnover != null
                                    ? `${patient.turnover.toLocaleString("tr-TR")} ₺`
                                    : "-"}
                                </td>
                                <td>
                                  <span className="patient-risk-pill">
                                    {patient.risk_level ?? "-"}
                                  </span>
                                </td>

                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6}>
                              <div className="patient-empty">
                                <b>Kayıt bulunamadı</b>
                                <span>Arama kriterini, segmenti veya risk görünümünü değiştirin.</span>
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
                      ["Kırmızı Reçete", "🔴"],
                      ["Yeşil Reçete", "🟢"],
                      ["Mor Reçete", "🟣"],
                      ["Turuncu Reçete", "🟠"],
                    ].map(([label, icon]) => {
                      const item = prescriptionMetrics.find((row) => row.prescription_type === label);
                      const isSelected = selectedPrescriptionType === label;

                      return (
                        <button
                          type="button"
                          className="prescription-card"
                          key={label}
                          onClick={() => {
                            setSelectedPrescriptionType(label);
                            setPrescriptionSearch("");
                          }}
                          aria-pressed={isSelected}
                          style={{ textAlign: "left", cursor: "pointer", outline: isSelected ? "3px solid rgba(45, 99, 255, 0.18)" : "none" }}
                        >
                          <span>{icon} {label}</span>
                          <strong>{item?.count ?? "-"}</strong>
                          <p>
                            {item
                              ? `${item.product_count ?? item.count} ürün${item.quantity != null ? ` · ${item.quantity.toLocaleString("tr-TR")} adet` : ""}${item.turnover != null ? ` · ${item.turnover.toLocaleString("tr-TR")} ₺ ciro` : ""}`
                              : "Veri bulunamadı"}
                          </p>
                        </button>
                      );
                    })}
                  </section>

                  <section className="insight-card patient-panel" style={{ marginTop: 18 }}>
                    <div className="patient-section-heading">
                      <div>
                        <h2>🔐 {selectedPrescriptionType} İlaçları</h2>
                        <p>Kartı seçerek o reçete grubundaki ilaçları inceleyin.</p>
                      </div>
                      <span className="patient-live-badge">
                        {selectedPrescription?.products?.length ?? 0} ilaç
                      </span>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <input
                        type="search"
                        value={prescriptionSearch}
                        onChange={(event) => setPrescriptionSearch(event.target.value)}
                        placeholder="🔎 İlaç ara..."
                        aria-label="Reçete ilacı ara"
                        style={{ width: "100%", maxWidth: 520, padding: "12px 14px", borderRadius: 12, border: "1px solid #d9dce3", background: "#fff" }}
                      />
                    </div>

                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th>İlaç</th><th>Satılan Adet</th><th>Ciro</th></tr></thead>
                        <tbody>
                          {selectedPrescriptionProducts.length > 0 ? (
                            selectedPrescriptionProducts.map((product, index) => (
                              <tr key={`${selectedPrescriptionType}-${product.product_name}-${index}`}>
                                <td>{product.product_name}</td>
                                <td>{product.quantity ?? "-"}</td>
                                <td>{product.turnover != null ? `${product.turnover.toLocaleString("tr-TR")} ₺` : "-"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={3}><div className="patient-empty"><b>{prescriptionSearch ? "Aramayla eşleşen ilaç bulunamadı" : "İlaç detayı bulunamadı"}</b><span>Seçili reçete grubunda eşleşen ürünler burada gösterilir.</span></div></td></tr>
                          )}
                        </tbody>
                      </table>
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

        {activeModule === "🤖 AYÇA Asistan" && (
          <>
            <section className="copilot-page-heading">
              <div>
                <span>YÖNETİM ASİSTANI</span>
                <h1>🤖 AYÇA Asistan</h1>
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
                    onClick={createTodayPlan}
                  >
                    Sabah Brifingini Aç
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
                  {financeAvailable && totalTurnover
                    ? `${totalTurnover.toLocaleString("tr-TR")} ₺`
                    : "—"}
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
                        <b>{financeAvailable ? `${totalTurnover.toLocaleString("tr-TR")} ₺` : "—"}</b>
                      </div>
                      <div>
                        <span>Toplam kâr</span>
                        <b>{financeAvailable ? `${totalProfit.toLocaleString("tr-TR")} ₺` : "—"}</b>
                      </div>
                      <div>
                        <span>Kâr marjı</span>
                        <b>{financeAvailable ? `%${profitMargin.toLocaleString("tr-TR")}` : "—"}</b>
                      </div>
                      <div>
                        <span>Ortalama satış</span>
                        <b>{financeAvailable ? `${averageSale.toLocaleString("tr-TR")} ₺` : "—"}</b>
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
                        <b>{totalPatientCount}</b>
                        <small>Toplam hasta</small>
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
                          disabled={isCopilotThinking}
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

                      {isCopilotThinking && (
                        <div className="copilot-message assistant copilot-thinking">
                          <span>AYÇA</span>
                          <div className="copilot-thinking-content">
                            <div className="copilot-thinking-dots" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                            </div>
                            <p>Verilerinizi inceliyorum...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="copilot-input-row">
                      <textarea
                        value={copilotQuestion}
                        onChange={(event) =>
                          setCopilotQuestion(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey &&
                            !isCopilotThinking
                          ) {
                            event.preventDefault();
                            submitCopilotQuestion();
                          }
                        }}
                        placeholder="Örneğin: Bugün ne yapmalıyım?"
                        disabled={isCopilotThinking}
                      />
                      <button
                        type="button"
                        disabled={isCopilotThinking}
                        onClick={() => submitCopilotQuestion()}
                      >
                        {isCopilotThinking ? "AYÇA düşünüyor..." : "Gönder →"}
                      </button>
                    </div>
                  </div>
                  <div className="insight-card copilot-guide-card">
                    <span>NASIL ÇALIŞIR?</span>
                    <h2>Veriye Dayalı Cevap</h2>
                    <p>
                      AYÇA Asistan bu aşamada yalnızca yüklediğiniz Excel
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


          </>
        )}


        </AnimatedPage>
        )}
      </section>

      {isAssistantDrawerOpen && (
        <>
          <button
            type="button"
            aria-label="AYÇA Asistan panelini kapat"
            onClick={() => setIsAssistantDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1998,
              border: 0,
              background: "rgba(15, 23, 42, 0.20)",
              backdropFilter: "blur(2px)",
              cursor: "default",
            }}
          />

          <aside
            aria-label="AYÇA Orb Asistan"
            style={{
              position: "fixed",
              top: 12,
              right: 12,
              bottom: 12,
              width: "min(420px, calc(100vw - 24px))",
              zIndex: 1999,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 24,
              color: "#18324a",
              background:
                "radial-gradient(circle at 50% 18%, rgba(45,212,191,.18), transparent 28%), linear-gradient(180deg, #fbfffe 0%, #f0fbf8 48%, #eef9fb 100%)",
              border: "1px solid rgba(16,185,129,.26)",
              boxShadow:
                "-22px 0 60px rgba(15,23,42,.14), 0 0 0 1px rgba(255,255,255,.72), 0 0 34px rgba(56,189,248,.10)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "17px 18px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div className={`ayca-orb-v3 ayca-orb-v3-mini ${isCopilotThinking ? "is-thinking" : totalRiskItems > 0 ? "has-alert" : "is-ready"}`} aria-hidden="true">
                  <span className="ayca-orb-v3-orbit ayca-orb-v3-orbit-a" />
                  <span className="ayca-orb-v3-orbit ayca-orb-v3-orbit-b" />
                  <span className="ayca-orb-v3-logo">
                  <span className="ayca-orb-v3-word" aria-label="AYÇA">
                    <span className="ayca-letter ayca-letter-navy">A</span>
                    <span className="ayca-letter ayca-letter-green">Y</span>
                    <span className="ayca-letter ayca-letter-navy">Ç</span>
                    <span className="ayca-letter ayca-letter-navy">A</span>
                  </span>
                  <small>ASİSTAN</small>
                </span>
                  <span className="ayca-orb-v3-particle ayca-orb-v3-p1" />
                  <span className="ayca-orb-v3-particle ayca-orb-v3-p2" />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: 15, color: "#12314a" }}>
                    AYÇA Asistan
                  </strong>
                  <small
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 3,
                      color: hasAnalysis ? "#34d399" : "#94a3b8",
                      fontWeight: 800,
                    }}
                  >
                    <i
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: hasAnalysis ? "#10b981" : "#64748b",
                        boxShadow: hasAnalysis ? "0 0 12px #10b981" : "none",
                      }}
                    />
                    {hasAnalysis ? "Çevrimiçi · Analiz hazır" : "Analiz bekleniyor"}
                  </small>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAssistantDrawerOpen(false)}
                aria-label="Kapat"
                style={{
                  border: "1px solid rgba(148,163,184,.22)",
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.76)",
                  color: "#475569",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "0 18px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <small style={{ color: "#64748b", fontWeight: 750 }}>
                Bağlam: {activeModule}
              </small>

              {activePatientContextName && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 7px 5px 9px",
                    borderRadius: 999,
                    border: "1px solid rgba(45,212,191,.28)",
                    background: "rgba(13,148,136,.10)",
                    color: "#5eead4",
                    fontSize: 10,
                    fontWeight: 850,
                  }}
                >
                  ✧ {showPatientNames ? activePatientContextName : "Aktif hasta"}
                  <button
                    type="button"
                    onClick={() => setActivePatientContextName(null)}
                    aria-label="Aktif hasta bağlamını temizle"
                    style={{
                      border: 0,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(45,212,191,.10)",
                      color: "#5eead4",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            {!hasConversationStarted && (
              <>
            <div
              style={{
                padding: "4px 18px 10px",
                textAlign: "center",
              }}
            >
              <div className={`ayca-orb-v3 ayca-orb-v3-stage ${isCopilotThinking ? "is-thinking" : totalRiskItems > 0 ? "has-alert" : "is-ready"}`} aria-hidden="true">
                <span className="ayca-orb-v3-orbit ayca-orb-v3-orbit-a" />
                <span className="ayca-orb-v3-orbit ayca-orb-v3-orbit-b" />
                <span className="ayca-orb-v3-logo">
                  <span className="ayca-orb-v3-word" aria-label="AYÇA">
                    <span className="ayca-letter ayca-letter-navy">A</span>
                    <span className="ayca-letter ayca-letter-green">Y</span>
                    <span className="ayca-letter ayca-letter-navy">Ç</span>
                    <span className="ayca-letter ayca-letter-navy">A</span>
                  </span>
                  <small>ASİSTAN</small>
                </span>
                <span className="ayca-orb-v3-particle ayca-orb-v3-p1" />
                <span className="ayca-orb-v3-particle ayca-orb-v3-p2" />
                <span className="ayca-orb-v3-particle ayca-orb-v3-p3" />
              </div>
              <div className={`ayca-orb-v3-status-text ${isCopilotThinking ? "is-thinking" : totalRiskItems > 0 ? "has-alert" : "is-ready"}`}>
                <span className="ayca-status-dot" />
                <strong>
                  {isCopilotThinking
                    ? "Düşünüyor"
                    : totalRiskItems > 0
                      ? "Hazır · İçgörü var"
                      : hasAnalysis
                        ? "Hazır bekliyor"
                        : "Analiz bekleniyor"}
                </strong>
              </div>

              <h3
                style={{
                  margin: "8px 0 3px",
                  color: "#17233b",
                  fontSize: 18,
                }}
              >
                Merhaba {fullName?.trim() || "Eczacı"} 👋
              </h3>
              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                Verilerinizi birlikte yorumlayalım. Ne öğrenmek istersiniz?
              </p>
            </div>
              </>
            )}

            {!hasConversationStarted && (
              <>
            <div
              style={{
                padding: "2px 16px 10px",
                display: "grid",
                gap: 7,
              }}
            >
              {[
                ["🧠", "Bugün ne yapmalıyım?", "Günün önceliklerini göster"],
                ["⚠️", "Stokta risk var mı?", "Kritik ve riskli stokları listele"],
                ["💹", "Finansal durumum nasıl?", "Ciro, kâr ve borç durumunu analiz et"],
              ].map(([icon, question, description]) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void submitCopilotQuestion(question)}
                  disabled={isCopilotThinking}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 11px",
                    borderRadius: 13,
                    border: "1px solid rgba(99,102,241,.13)",
                    background: "rgba(255,255,255,.76)",
                    color: "#263650",
                    boxShadow: "0 8px 20px rgba(99,102,241,.05)",
                    textAlign: "left",
                    cursor: isCopilotThinking ? "wait" : "pointer",
                    opacity: isCopilotThinking ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      display: "grid",
                      placeItems: "center",
                      background: "linear-gradient(135deg, rgba(124,58,237,.12), rgba(37,99,235,.10))",
                    }}
                  >
                    {icon}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 11.5 }}>
                      {question}
                    </strong>
                    <small
                      style={{
                        display: "block",
                        marginTop: 2,
                        color: "#64748b",
                        fontSize: 9.5,
                      }}
                    >
                      {description}
                    </small>
                  </span>
                  <span style={{ color: "#64748b" }}>›</span>
                </button>
              ))}
            </div>
              </>
            )}

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                minHeight: 110,
                padding: "8px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 9,
                borderTop: "1px solid rgba(148,163,184,.08)",
              }}
            >
              {copilotMessages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: "9px 11px",
                    borderRadius:
                      message.role === "user"
                        ? "13px 13px 4px 13px"
                        : "13px 13px 13px 4px",
                    background:
                      message.role === "user"
                        ? "linear-gradient(135deg, #7c3aed, #2563eb)"
                        : "rgba(255,255,255,.82)",
                    border:
                      message.role === "user"
                        ? "1px solid rgba(167,139,250,.30)"
                        : "1px solid rgba(148,163,184,.08)",
                    color: message.role === "user" ? "#fff" : "#29445b",
                    whiteSpace: "pre-wrap",
                    fontSize: 11.5,
                    lineHeight: 1.5,
                  }}
                >
                  {message.text}
                </div>
              ))}

              {isCopilotThinking && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    padding: "9px 11px",
                    borderRadius: "13px 13px 13px 4px",
                    background: "rgba(255,255,255,.82)",
                    color: "#2563eb",
                    fontSize: 11,
                  }}
                >
                  AYÇA düşünüyor...
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitCopilotQuestion();
              }}
              style={{
                display: "flex",
                gap: 8,
                padding: "12px 14px 14px",
                borderTop: "1px solid rgba(148,163,184,.10)",
                background: "rgba(241,250,248,.96)",
              }}
            >
              <input
                type="text"
                value={copilotQuestion}
                onChange={(event) => setCopilotQuestion(event.target.value)}
                placeholder="AYÇA'ya sorun..."
                aria-label="AYÇA Asistan sorusu"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "1px solid rgba(99,102,241,.24)",
                  borderRadius: 13,
                  padding: "11px 13px",
                  outline: "none",
                  background: "rgba(255,255,255,.92)",
                  color: "#18324a",
                }}
              />
              <button
                type="submit"
                disabled={!copilotQuestion.trim() || isCopilotThinking}
                style={{
                  width: 43,
                  border: 0,
                  borderRadius: 13,
                  background:
                    "linear-gradient(135deg, #7c3aed 0%, #2563eb 58%, #06b6d4 100%)",
                  color: "#fff",
                  fontSize: 16,
                  cursor:
                    !copilotQuestion.trim() || isCopilotThinking
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    !copilotQuestion.trim() || isCopilotThinking ? 0.52 : 1,
                  boxShadow: "0 0 22px rgba(99,102,241,.20)",
                }}
              >
                ➤
              </button>
            </form>
          </aside>
        </>
      )}

      <style>{`
        .ayca-header-orb-button {
          position: relative;
          width: 116px;
          height: 58px;
          border: 0;
          border-radius: 18px;
          display: grid;
          place-items: center;
          cursor: pointer;
          background: rgba(255,255,255,.56);
          box-shadow: 0 10px 30px rgba(79,70,229,.07);
          isolation: isolate;
          transition: transform .22s ease, box-shadow .22s ease, background .22s ease;
        }

        .ayca-header-orb-button:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,.86);
          box-shadow: 0 14px 34px rgba(79,70,229,.12);
        }

        .ayca-header-orbit {
          position: absolute;
          z-index: 1;
          width: 98px;
          height: 25px;
          border-radius: 50%;
          border: 1.5px solid rgba(59,130,246,.48);
          transform: rotate(-13deg);
          box-shadow: 0 0 16px rgba(99,102,241,.14);
          pointer-events: none;
        }

        .ayca-header-orbit::after {
          content: "";
          position: absolute;
          width: 6px;
          height: 6px;
          right: 12px;
          top: -3px;
          border-radius: 50%;
          background: #60a5fa;
          box-shadow: 0 0 10px rgba(96,165,250,.75);
        }

        .ayca-header-orb-core {
          position: relative;
          z-index: 3;
          display: inline-block;
          padding: 2px 6px;
          color: transparent;
          font-size: 22px;
          line-height: 1;
          letter-spacing: -.075em;
          font-weight: 950;
          background: linear-gradient(100deg, #8b5cf6 0%, #6366f1 42%, #2563eb 72%, #06b6d4 100%);
          -webkit-background-clip: text;
          background-clip: text;
          filter: drop-shadow(0 4px 10px rgba(99,102,241,.16));
        }

        .ayca-header-spark {
          position: absolute;
          z-index: 4;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #7c3aed;
          box-shadow: 0 0 9px rgba(124,58,237,.55);
          pointer-events: none;
        }

        .ayca-header-spark-one { left: 14px; top: 15px; }
        .ayca-header-spark-two { right: 17px; bottom: 14px; background: #38bdf8; }

        .ayca-orb-online-dot,
        .ayca-orb-offline-dot {
          position: absolute;
          z-index: 5;
          right: 7px;
          bottom: 7px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid #ffffff;
        }

        .ayca-orb-online-dot {
          background: #10b981;
          box-shadow: 0 0 9px rgba(16,185,129,.50);
        }

        .ayca-orb-offline-dot { background: #94a3b8; }

        .ayca-orb-mini {
          position: relative;
          width: 64px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: linear-gradient(135deg, rgba(139,92,246,.09), rgba(37,99,235,.08));
          border: 1px solid rgba(99,102,241,.15);
          box-shadow: 0 8px 20px rgba(99,102,241,.08);
          overflow: visible;
        }

        .ayca-orb-mini::after {
          content: "";
          position: absolute;
          width: 54px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid rgba(59,130,246,.32);
          transform: rotate(-14deg);
        }

        .ayca-orb-mini span {
          position: relative;
          z-index: 2;
          color: transparent;
          font-size: 14px;
          letter-spacing: -.07em;
          font-weight: 950;
          background: linear-gradient(100deg, #8b5cf6, #4f46e5 48%, #2563eb 76%, #06b6d4);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .ayca-orb-stage {
          position: relative;
          width: 178px;
          height: 116px;
          margin: 0 auto;
          display: grid;
          place-items: center;
        }

        .ayca-orb-core {
          position: relative;
          z-index: 3;
          display: grid;
          place-items: center;
          padding: 10px 18px 12px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255,255,255,.90), rgba(248,250,255,.72));
          border: 1px solid rgba(99,102,241,.10);
          box-shadow: 0 16px 40px rgba(79,70,229,.10), inset 0 1px 0 rgba(255,255,255,.88);
          animation: aycaWordmarkPulse 3.4s ease-in-out infinite;
        }

        .ayca-orb-core span {
          color: transparent;
          font-size: 33px;
          line-height: 1;
          letter-spacing: -.085em;
          font-weight: 950;
          background: linear-gradient(100deg, #8b5cf6 0%, #6366f1 40%, #2563eb 72%, #06b6d4 100%);
          -webkit-background-clip: text;
          background-clip: text;
          filter: drop-shadow(0 6px 14px rgba(99,102,241,.15));
        }

        .ayca-orb-ring {
          position: absolute;
          z-index: 2;
          left: 15px;
          right: 15px;
          height: 35px;
          border-radius: 50%;
          border: 1.5px solid rgba(59,130,246,.38);
          box-shadow: 0 0 18px rgba(99,102,241,.10);
        }

        .ayca-orb-ring-one {
          transform: rotate(-12deg);
          animation: aycaWordmarkOrbitOne 7s linear infinite;
        }

        .ayca-orb-ring-two {
          left: 31px;
          right: 31px;
          height: 54px;
          border-color: rgba(139,92,246,.22);
          transform: rotate(28deg);
          animation: aycaWordmarkOrbitTwo 9s linear infinite;
        }

        .ayca-orb-particle {
          position: absolute;
          z-index: 4;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #7c3aed;
          box-shadow: 0 0 11px rgba(124,58,237,.56);
        }

        .ayca-orb-particle-one { left: 18px; top: 29px; }
        .ayca-orb-particle-two { right: 17px; bottom: 25px; background: #38bdf8; }

        @keyframes aycaWordmarkPulse {
          0%, 100% { transform: translateY(0) scale(1); filter: brightness(1); }
          50% { transform: translateY(-2px) scale(1.018); filter: brightness(1.05); }
        }

        @keyframes aycaWordmarkOrbitOne {
          from { transform: rotate(-12deg); }
          to { transform: rotate(348deg); }
        }

        @keyframes aycaWordmarkOrbitTwo {
          from { transform: rotate(28deg); }
          to { transform: rotate(-332deg); }
        }

        .ayca-header-orb-button.is-thinking .ayca-header-orbit,
        .ayca-orb-stage.is-thinking .ayca-orb-ring-one {
          animation-duration: 2.2s;
          border-color: rgba(124,58,237,.64);
          box-shadow: 0 0 22px rgba(124,58,237,.18);
        }

        .ayca-header-orb-button.is-thinking .ayca-header-orb-core,
        .ayca-orb-stage.is-thinking .ayca-orb-core {
          animation: aycaThinkingPulse 1.05s ease-in-out infinite;
        }

        .ayca-header-orb-button.has-alert::before,
        .ayca-orb-stage.has-alert::before {
          content: "";
          position: absolute;
          inset: 3px;
          border-radius: 20px;
          border: 1.5px solid rgba(245,158,11,.42);
          box-shadow: 0 0 18px rgba(245,158,11,.16);
          pointer-events: none;
          animation: aycaAlertRing 2.4s ease-in-out infinite;
        }

        .ayca-header-orb-button.is-ready .ayca-header-orb-core,
        .ayca-orb-stage.is-ready .ayca-orb-core {
          filter: saturate(1.05) brightness(1.02);
        }

        @keyframes aycaThinkingPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.045); filter: brightness(1.10); }
        }

        @keyframes aycaAlertRing {
          0%, 100% { opacity: .35; transform: scale(.98); }
          50% { opacity: 1; transform: scale(1.02); }
        }

        .mobile-menu-button,
        .mobile-sidebar-backdrop {
          display: none;
        }

        @media (max-width: 1180px) {
          .insight-kpi-grid,
          .copilot-kpi-grid,
          .risk-summary-grid,
          .patient-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .dashboard-command-grid,
          .dashboard-lower-grid,
          .copilot-overview-grid,
          .copilot-advisor-grid,
          .risk-insight-grid,
          .finance-alert-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 900px) {
          .insight-page {
            display: block !important;
            min-width: 0 !important;
            width: 100% !important;
            overflow-x: hidden !important;
          }

          .insight-sidebar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            width: min(292px, 86vw) !important;
            height: 100dvh !important;
            z-index: 2100 !important;
            transform: translateX(-105%) !important;
            transition: transform 220ms ease !important;
            box-shadow: 24px 0 54px rgba(15, 23, 42, .22) !important;
            overflow-y: auto !important;
          }

          .insight-sidebar.mobile-open {
            transform: translateX(0) !important;
          }

          .mobile-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 2090;
            border: 0;
            padding: 0;
            background: rgba(15, 23, 42, .32);
            backdrop-filter: blur(2px);
          }

          .insight-content {
            width: 100% !important;
            min-width: 0 !important;
            margin-left: 0 !important;
            padding: 12px !important;
          }

          .insight-header {
            min-width: 0 !important;
            padding: 16px !important;
            border-radius: 18px !important;
            gap: 12px !important;
            flex-wrap: wrap !important;
            align-items: flex-start !important;
          }

          .mobile-menu-button {
            display: grid;
            place-content: center;
            gap: 4px;
            width: 42px;
            height: 42px;
            flex: 0 0 42px;
            border: 1px solid #dbe7ef;
            border-radius: 12px;
            background: #fff;
            box-shadow: 0 5px 14px rgba(15,23,42,.05);
            cursor: pointer;
            position: relative;
            z-index: 3;
          }

          .mobile-menu-button span {
            display: block;
            width: 18px;
            height: 2px;
            border-radius: 999px;
            background: #172554;
          }

          .insight-header h1 {
            font-size: clamp(24px, 7vw, 34px) !important;
            line-height: 1.08 !important;
          }

          .insight-header > div:last-child {
            width: 100% !important;
            justify-content: space-between !important;
            gap: 10px !important;
          }

          .ayca-header-orb-button {
            width: 72px !important;
            height: 72px !important;
          }

          .ayca-header-orb-core {
            width: 56px !important;
            height: 56px !important;
            font-size: 16px !important;
          }

          .ayca-header-orb-button::after {
            width: 64px !important;
            height: 26px !important;
          }

          .insight-main-grid,
          .dashboard-command-grid,
          .dashboard-lower-grid,
          .copilot-chat-layout,
          .copilot-overview-grid,
          .copilot-advisor-grid,
          .copilot-signal-columns,
          .risk-insight-grid,
          .risk-action-grid,
          .risk-donut-layout,
          .finance-alert-grid,
          .prescription-grid {
            grid-template-columns: 1fr !important;
          }

          .dashboard-mini-grid,
          [aria-label="Dashboard mini analiz grafikleri"] {
            grid-template-columns: 1fr !important;
          }

          .patient-segment-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .patient-action-grid {
            grid-template-columns: 1fr !important;
          }

          .table-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }

          .table-wrapper table {
            min-width: 720px;
          }

          .operation-tabs,
          .patient-tabs,
          .copilot-tabs,
          .copilot-quick-questions,
          .copilot-action-row,
          .hero-badges,
          .patient-name-controls {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            scrollbar-width: thin;
            padding-bottom: 3px;
          }

          .operation-tabs button,
          .patient-tabs button,
          .copilot-tabs button,
          .copilot-quick-questions button {
            flex: 0 0 auto !important;
            min-height: 58px;
          }

          .insight-card {
            min-width: 0 !important;
            max-width: 100% !important;
          }

          input,
          select,
          textarea,
          button {
            max-width: 100%;
          }

          input,
          select,
          textarea {
            font-size: 16px !important;
          }
        }

        @media (max-width: 640px) {
          .insight-content {
            padding: 8px !important;
          }

          .insight-header {
            padding: 14px !important;
            border-radius: 16px !important;
          }

          .insight-kpi-grid,
          .copilot-kpi-grid,
          .risk-summary-grid,
          .patient-kpi-grid,
          .responsive-grid-3 {
            grid-template-columns: 1fr !important;
          }

          .patient-segment-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .insight-kpi,
          .insight-card {
            border-radius: 16px !important;
          }

          .section-heading,
          .patient-section-heading,
          .risk-section-heading,
          .active-module-title {
            gap: 8px !important;
            flex-wrap: wrap !important;
          }

          .copilot-input-row {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          .copilot-input-row button,
          .analysis-btn,
          .report-download-btn {
            width: 100% !important;
            min-height: 46px !important;
          }

          aside[aria-label="AYÇA Orb Asistan"] {
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100dvh !important;
            border-radius: 0 !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ayca-orb-core,
          .ayca-orb-ring-one,
          .ayca-orb-ring-two {
            animation: none !important;
          }
        }

        @media (max-width: 1050px) {
          [aria-label="Dashboard mini analiz grafikleri"] {
            grid-template-columns: 1fr !important;
          }
        }
        /* AYÇA Assistant V1.1 — larger, rounder identity + subtitle */
        .ayca-header-orb-button {
          min-width: 168px !important;
          height: 64px !important;
          padding: 7px 16px !important;
          border-radius: 32px !important;
          transform: none !important;
        }

        .ayca-v1-brand,
        .ayca-v1-brand-mini {
          border-radius: 999px !important;
          transform: none !important;
        }

        .ayca-v1-word-wrap {
          position: relative;
          z-index: 2;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1;
          gap: 2px;
        }

        .ayca-v1-word-wrap small {
          font-size: 7px;
          line-height: 1;
          letter-spacing: .18em;
          font-weight: 850;
          color: #7c3aed;
          opacity: .72;
        }

        .ayca-header-orb-button .ayca-v1-word {
          font-size: 24px !important;
          letter-spacing: -.04em;
        }

        .ayca-header-orb-button .ayca-v1-orbit {
          inset: 7px 12px !important;
          border-radius: 999px !important;
        }

        /* Put the time filter below the larger AYÇA identity on wide screens. */
        @media (min-width: 900px) {
          .header-actions,
          .topbar-actions,
          .dashboard-header-actions {
            align-items: flex-end;
          }
        }

        @media (max-width: 640px) {
          .ayca-header-orb-button {
            min-width: 142px !important;
            height: 56px !important;
          }
        }


        /* AYÇA ORB V2 — reference-driven circular visual identity */
        .ayca-header-orb-button {
          width: 96px !important;
          min-width: 96px !important;
          height: 96px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 50% !important;
          background: transparent !important;
          box-shadow: none !important;
          overflow: visible !important;
          transform: none !important;
        }

        .ayca-header-orbit,
        .ayca-header-spark {
          display: none !important;
        }

        .ayca-orb-v2 {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 82px;
          height: 82px;
          border-radius: 50%;
          isolation: isolate;
          background:
            radial-gradient(circle at 50% 45%, rgba(31,20,78,.96) 0 43%, rgba(50,21,116,.94) 56%, rgba(111,28,229,.92) 69%, rgba(49,205,255,.82) 82%, rgba(255,255,255,.96) 86%, transparent 89%),
            conic-gradient(from 210deg, #5ee7ff, #6d28d9, #d946ef, #7c3aed, #22d3ee, #5ee7ff);
          box-shadow:
            0 0 0 1px rgba(139,92,246,.20),
            0 0 12px rgba(124,58,237,.40),
            0 0 28px rgba(109,40,217,.30),
            0 0 40px rgba(34,211,238,.16),
            inset 0 0 20px rgba(255,255,255,.08);
          transition: transform .22s ease, filter .22s ease, box-shadow .22s ease;
        }

        .ayca-orb-v2::before {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,.18);
          background:
            radial-gradient(circle at 30% 25%, rgba(255,255,255,.13), transparent 18%),
            radial-gradient(circle at 70% 78%, rgba(56,189,248,.10), transparent 24%),
            rgba(9,8,34,.30);
          z-index: -1;
        }

        .ayca-orb-v2::after {
          content: "";
          position: absolute;
          inset: -5px;
          border-radius: 50%;
          border: 1px solid rgba(139,92,246,.26);
          box-shadow: inset 0 0 12px rgba(168,85,247,.20);
          transform: rotate(-18deg);
        }

        .ayca-orb-v2-word {
          position: relative;
          z-index: 4;
          color: #fff;
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          font-size: 19px;
          line-height: 1;
          font-weight: 850;
          letter-spacing: -.055em;
          text-shadow: 0 0 12px rgba(255,255,255,.28);
        }

        .ayca-orb-v2-ring {
          position: absolute;
          z-index: 2;
          border-radius: 50%;
          pointer-events: none;
        }

        .ayca-orb-v2-ring-one {
          width: 70px;
          height: 31px;
          border: 1px solid rgba(213,180,255,.48);
          transform: rotate(-22deg);
        }

        .ayca-orb-v2-ring-two {
          width: 61px;
          height: 55px;
          border: 1px solid rgba(62,220,255,.22);
          transform: rotate(38deg);
        }

        .ayca-orb-v2-glow {
          position: absolute;
          width: 7px;
          height: 7px;
          right: 8px;
          top: 18px;
          border-radius: 50%;
          background: #d8b4fe;
          box-shadow:
            -50px 30px 0 -2px rgba(56,189,248,.9),
            -17px -11px 0 -2px rgba(255,255,255,.85),
            0 0 9px #c084fc;
          z-index: 5;
        }

        .ayca-header-orb-button:hover .ayca-orb-v2 {
          transform: translateY(-2px) scale(1.045);
          filter: saturate(1.08);
          box-shadow:
            0 0 0 1px rgba(139,92,246,.26),
            0 0 18px rgba(124,58,237,.55),
            0 0 34px rgba(109,40,217,.38),
            0 0 48px rgba(34,211,238,.22);
        }

        .ayca-header-orb-button.is-thinking .ayca-orb-v2-ring-one {
          animation: aycaOrbSpin 2.2s linear infinite;
        }

        .ayca-header-orb-button.is-thinking .ayca-orb-v2 {
          animation: aycaOrbPulse 1.7s ease-in-out infinite;
        }

        .ayca-header-orb-button.has-alert::after {
          content: "1";
          position: absolute;
          top: 1px;
          right: 0;
          z-index: 20;
          display: grid;
          place-items: center;
          width: 19px;
          height: 19px;
          border-radius: 50%;
          background: #ef4444;
          color: #fff;
          border: 2px solid #fff;
          font-size: 9px;
          font-weight: 900;
          box-shadow: 0 4px 12px rgba(239,68,68,.30);
        }

        .ayca-orb-v2-mini {
          width: 54px;
          height: 54px;
        }

        .ayca-orb-v2-mini .ayca-orb-v2-word {
          font-size: 13px;
        }

        .ayca-orb-v2-mini .ayca-orb-v2-ring-one {
          width: 46px;
          height: 21px;
        }

        .ayca-orb-v2-mini .ayca-orb-v2-ring-two {
          width: 41px;
          height: 37px;
        }

        .ayca-orb-v2-mini .ayca-orb-v2-glow {
          transform: scale(.65);
          transform-origin: center;
        }

        @keyframes aycaOrbSpin {
          from { transform: rotate(-22deg); }
          to { transform: rotate(338deg); }
        }

        @keyframes aycaOrbPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.035); }
        }

        @media (max-width: 640px) {
          .ayca-header-orb-button {
            width: 76px !important;
            min-width: 76px !important;
            height: 76px !important;
          }

          .ayca-header-orb-button .ayca-orb-v2 {
            width: 68px;
            height: 68px;
          }

          .ayca-header-orb-button .ayca-orb-v2-word {
            font-size: 16px;
          }
        }


        /* AYÇA ORB V3 — emerald / teal / cyan shared assistant identity */
        .ayca-header-v3-stack {
          position: relative;
          z-index: 1;
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          min-width: 144px;
        }

        .ayca-header-v3-period {
          width: 126px;
        }

        .ayca-header-v3-period select {
          width: 100%;
          min-width: 0 !important;
          min-height: 38px !important;
          border-radius: 19px !important;
          border-color: rgba(15,118,110,.18) !important;
          box-shadow: 0 5px 14px rgba(15,118,110,.06) !important;
        }

        .ayca-header-orb-button {
          width: 132px !important;
          min-width: 132px !important;
          height: 132px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 50% !important;
          background: transparent !important;
          box-shadow: none !important;
          overflow: visible !important;
          transform: none !important;
        }

        .ayca-header-orbit,
        .ayca-header-spark {
          display: none !important;
        }

        .ayca-orb-v3 {
          --orb-size: 116px;
          position: relative;
          width: var(--orb-size);
          height: var(--orb-size);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 50%;
          isolation: isolate;
          background:
            radial-gradient(circle at 34% 27%, rgba(255,255,255,.42) 0 4%, transparent 5%),
            radial-gradient(circle at 48% 47%, #103b46 0 35%, #0a4850 46%, #0f766e 59%, #14b8a6 70%, #22d3ee 80%, #a7f3d0 87%, transparent 90%),
            conic-gradient(from 205deg, #2dd4bf, #22d3ee, #34d399, #0f766e, #2dd4bf);
          border: 1px solid rgba(94,234,212,.64);
          box-shadow:
            0 0 0 4px rgba(240,253,250,.78),
            0 0 18px rgba(20,184,166,.34),
            0 0 38px rgba(34,211,238,.18),
            0 12px 30px rgba(15,118,110,.16),
            inset 0 0 26px rgba(255,255,255,.08);
          transition: transform .22s ease, box-shadow .22s ease, filter .22s ease;
        }

        .ayca-orb-v3::before {
          content: "";
          position: absolute;
          inset: 10px;
          z-index: -1;
          border-radius: 50%;
          border: 1px solid rgba(204,251,241,.26);
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,.12), transparent 18%),
            radial-gradient(circle at 72% 74%, rgba(34,211,238,.11), transparent 25%),
            rgba(2,44,50,.24);
        }

        .ayca-orb-v3::after {
          content: "";
          position: absolute;
          inset: -7px;
          z-index: -2;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(45,212,191,.18), rgba(34,211,238,.08) 48%, transparent 70%);
          filter: blur(5px);
        }

        .ayca-orb-v3-word {
          position: relative;
          z-index: 6;
          color: #f8fffe;
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          font-size: calc(var(--orb-size) * .235);
          line-height: 1;
          font-weight: 880;
          letter-spacing: -.065em;
          text-shadow:
            0 1px 0 rgba(255,255,255,.20),
            0 0 14px rgba(94,234,212,.30);
        }

        .ayca-orb-v3-orbit {
          position: absolute;
          z-index: 4;
          border-radius: 50%;
          pointer-events: none;
        }

        .ayca-orb-v3-orbit-a {
          width: 88%;
          height: 38%;
          border: 1.2px solid rgba(204,251,241,.58);
          transform: rotate(-18deg);
          box-shadow: 0 0 12px rgba(45,212,191,.16);
        }

        .ayca-orb-v3-orbit-b {
          width: 72%;
          height: 67%;
          border: 1px solid rgba(103,232,249,.26);
          transform: rotate(38deg);
        }

        .ayca-orb-v3-particle {
          position: absolute;
          z-index: 8;
          border-radius: 50%;
          background: #99f6e4;
          box-shadow: 0 0 9px rgba(94,234,212,.9);
        }

        .ayca-orb-v3-p1 {
          width: 8px;
          height: 8px;
          right: 9%;
          top: 23%;
        }

        .ayca-orb-v3-p2 {
          width: 6px;
          height: 6px;
          left: 10%;
          bottom: 27%;
          background: #67e8f9;
        }

        .ayca-orb-v3-p3 {
          width: 5px;
          height: 5px;
          right: 21%;
          bottom: 8%;
          background: #6ee7b7;
        }

        .ayca-header-orb-button:hover .ayca-orb-v3 {
          transform: translateY(-2px) scale(1.035);
          filter: saturate(1.04) brightness(1.025);
          box-shadow:
            0 0 0 4px rgba(240,253,250,.88),
            0 0 24px rgba(20,184,166,.44),
            0 0 44px rgba(34,211,238,.22),
            0 14px 34px rgba(15,118,110,.18),
            inset 0 0 26px rgba(255,255,255,.10);
        }

        .ayca-orb-v3.is-thinking .ayca-orb-v3-orbit-a,
        .ayca-header-orb-button.is-thinking .ayca-orb-v3-orbit-a {
          animation: aycaOrbV3Spin 2.1s linear infinite;
        }

        .ayca-orb-v3.is-thinking,
        .ayca-header-orb-button.is-thinking .ayca-orb-v3 {
          animation: aycaOrbV3Pulse 1.65s ease-in-out infinite;
        }

        .ayca-orb-v3-stage {
          --orb-size: 172px;
          margin: 8px auto 15px;
        }

        .ayca-orb-v3-mini {
          --orb-size: 48px;
          box-shadow:
            0 0 0 2px rgba(240,253,250,.86),
            0 0 13px rgba(20,184,166,.22),
            inset 0 0 13px rgba(255,255,255,.07);
        }

        .ayca-orb-v3-mini::before {
          inset: 5px;
        }

        .ayca-orb-v3-mini::after {
          inset: -3px;
          filter: blur(3px);
        }

        .ayca-orb-v3-mini .ayca-orb-v3-particle {
          transform: scale(.58);
        }

        .ayca-orb-v3-mini .ayca-orb-v3-orbit-a {
          border-width: .8px;
        }

        .ayca-header-orb-button.has-alert::after {
          content: "1";
          position: absolute;
          top: 8px;
          right: 7px;
          z-index: 20;
          display: grid;
          place-items: center;
          width: 21px;
          height: 21px;
          border-radius: 50%;
          background: #f97316;
          color: #fff;
          border: 2px solid #fff;
          font-size: 10px;
          font-weight: 900;
          box-shadow: 0 4px 12px rgba(249,115,22,.25);
        }

        @keyframes aycaOrbV3Spin {
          from { transform: rotate(-18deg); }
          to { transform: rotate(342deg); }
        }

        @keyframes aycaOrbV3Pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.035); }
        }

        @media (max-width: 760px) {
          .ayca-header-v3-stack {
            min-width: 112px;
          }

          .ayca-header-orb-button {
            width: 104px !important;
            min-width: 104px !important;
            height: 104px !important;
          }

          .ayca-orb-v3-header {
            --orb-size: 92px;
          }

          .ayca-header-v3-period {
            width: 108px;
          }

          .ayca-orb-v3-stage {
            --orb-size: 148px;
          }
        }


        /* AYÇA ORB V3.2 — assistant subtitle inside the sphere */
        .ayca-orb-v3-logo {
          position: relative;
          z-index: 6;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          pointer-events: none;
        }

        .ayca-orb-v3-logo .ayca-orb-v3-word {
          position: static;
        }

        .ayca-orb-v3-logo small {
          display: block;
          margin-left: .18em;
          color: rgba(236, 253, 250, .78);
          font-size: calc(var(--orb-size) * .072);
          line-height: 1;
          font-weight: 800;
          letter-spacing: .22em;
          text-shadow: 0 0 9px rgba(94, 234, 212, .24);
        }

        .ayca-orb-v3-mini .ayca-orb-v3-logo {
          gap: 2px;
        }

        .ayca-orb-v3-mini .ayca-orb-v3-logo small {
          font-size: calc(var(--orb-size) * .065);
          letter-spacing: .16em;
        }


        /* AYÇA ORB V3.3 — free 2D dragging in header */
        .ayca-header-orb-button {
          width: 154px !important;
          min-width: 154px !important;
          height: 154px !important;
          cursor: grab !important;
          user-select: none;
          -webkit-user-select: none;
          will-change: transform;
        }

        .ayca-header-orb-button:active {
          cursor: grabbing !important;
        }

        .ayca-orb-v3-header {
          --orb-size: 140px;
        }

        @media (max-width: 760px) {
          .ayca-header-orb-button {
            width: 124px !important;
            min-width: 124px !important;
            height: 124px !important;
          }

          .ayca-orb-v3-header {
            --orb-size: 110px;
          }
        }


        /* AYÇA ORB V3.4 — brand colors + live assistant states */
        .ayca-orb-v3-word {
          display: inline-flex;
          align-items: baseline;
          justify-content: center;
          gap: 0;
          text-shadow: none;
        }

        .ayca-orb-v3-word .ayca-letter {
          display: inline-block;
          font: inherit;
          letter-spacing: inherit;
        }

        .ayca-orb-v3-word .ayca-letter-navy {
          color: #0f2747;
          text-shadow:
            0 1px 0 rgba(255,255,255,.35),
            0 0 10px rgba(255,255,255,.18);
        }

        .ayca-orb-v3-word .ayca-letter-green {
          color: #16a889;
          text-shadow:
            0 1px 0 rgba(255,255,255,.35),
            0 0 12px rgba(45,212,191,.24);
        }

        .ayca-orb-v3-stage .ayca-orb-v3-orbit-a,
        .ayca-orb-v3-mini .ayca-orb-v3-orbit-a {
          transform-origin: 50% 50%;
        }

        .ayca-orb-v3-stage .ayca-orb-v3-orbit-b,
        .ayca-orb-v3-mini .ayca-orb-v3-orbit-b {
          transform-origin: 50% 50%;
        }

        /* Ready: very slow ambient motion so AYÇA never looks frozen */
        .ayca-orb-v3.is-ready .ayca-orb-v3-orbit-a {
          animation: aycaOrbitReadyA 8s linear infinite !important;
        }

        .ayca-orb-v3.is-ready .ayca-orb-v3-orbit-b {
          animation: aycaOrbitReadyB 11s linear infinite reverse !important;
        }

        .ayca-orb-v3.is-ready .ayca-orb-v3-particle {
          animation: aycaParticleFloat 3.8s ease-in-out infinite alternate;
        }

        /* Thinking: visibly faster orbital motion + pulse */
        .ayca-orb-v3.is-thinking .ayca-orb-v3-orbit-a,
        .ayca-header-orb-button.is-thinking .ayca-orb-v3-orbit-a {
          animation: aycaOrbitThinkingA 1.45s linear infinite !important;
        }

        .ayca-orb-v3.is-thinking .ayca-orb-v3-orbit-b,
        .ayca-header-orb-button.is-thinking .ayca-orb-v3-orbit-b {
          animation: aycaOrbitThinkingB 2.05s linear infinite reverse !important;
        }

        .ayca-orb-v3.is-thinking {
          animation: aycaThinkingPulse 1.15s ease-in-out infinite !important;
          box-shadow:
            0 0 0 4px rgba(240,253,250,.9),
            0 0 28px rgba(20,184,166,.52),
            0 0 56px rgba(34,211,238,.28),
            0 14px 38px rgba(15,118,110,.22),
            inset 0 0 28px rgba(255,255,255,.12);
        }

        .ayca-orb-v3.is-thinking .ayca-orb-v3-particle {
          animation: aycaParticleThinking 1.05s ease-in-out infinite alternate !important;
        }

        /* Alert / insight ready: more energetic but not frantic */
        .ayca-orb-v3.has-alert .ayca-orb-v3-orbit-a {
          animation: aycaOrbitAlertA 4.5s linear infinite !important;
        }

        .ayca-orb-v3.has-alert .ayca-orb-v3-orbit-b {
          animation: aycaOrbitAlertB 6.5s linear infinite reverse !important;
        }

        .ayca-orb-v3.has-alert {
          animation: aycaAlertBreath 2.1s ease-in-out infinite !important;
        }

        .ayca-orb-v3-status-text {
          margin: -4px auto 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 24px;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.76);
          border: 1px solid rgba(15,118,110,.12);
          color: #365267;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 5px 16px rgba(15,118,110,.06);
        }

        .ayca-orb-v3-status-text .ayca-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px rgba(16,185,129,.55);
        }

        .ayca-orb-v3-status-text.is-thinking {
          color: #0f766e;
          border-color: rgba(20,184,166,.22);
          background: rgba(240,253,250,.88);
        }

        .ayca-orb-v3-status-text.is-thinking .ayca-status-dot {
          background: #22d3ee;
          box-shadow: 0 0 10px rgba(34,211,238,.68);
          animation: aycaStatusBlink .8s ease-in-out infinite alternate;
        }

        .ayca-orb-v3-status-text.has-alert .ayca-status-dot {
          background: #f59e0b;
          box-shadow: 0 0 9px rgba(245,158,11,.48);
        }

        @keyframes aycaOrbitReadyA {
          from { transform: rotate(-18deg); }
          to   { transform: rotate(342deg); }
        }

        @keyframes aycaOrbitReadyB {
          from { transform: rotate(38deg); }
          to   { transform: rotate(398deg); }
        }

        @keyframes aycaOrbitThinkingA {
          from { transform: rotate(-18deg) scaleX(1); }
          to   { transform: rotate(342deg) scaleX(1); }
        }

        @keyframes aycaOrbitThinkingB {
          from { transform: rotate(38deg); }
          to   { transform: rotate(398deg); }
        }

        @keyframes aycaOrbitAlertA {
          from { transform: rotate(-18deg); }
          to   { transform: rotate(342deg); }
        }

        @keyframes aycaOrbitAlertB {
          from { transform: rotate(38deg); }
          to   { transform: rotate(398deg); }
        }

        @keyframes aycaParticleFloat {
          from { translate: 0 -2px; opacity: .72; }
          to   { translate: 0 3px; opacity: 1; }
        }

        @keyframes aycaParticleThinking {
          from { transform: scale(.75); opacity: .55; }
          to   { transform: scale(1.25); opacity: 1; }
        }

        @keyframes aycaThinkingPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.035); filter: brightness(1.08); }
        }

        @keyframes aycaAlertBreath {
          0%, 100% { filter: saturate(1) brightness(1); }
          50% { filter: saturate(1.08) brightness(1.04); }
        }

        @keyframes aycaStatusBlink {
          from { opacity: .45; transform: scale(.8); }
          to { opacity: 1; transform: scale(1.15); }
        }


        /* AYÇA ORB V3.5 — lighter mint/green identity */
        .ayca-orb-v3 {
          background:
            radial-gradient(circle at 34% 27%, rgba(255,255,255,.72) 0 4%, transparent 5%),
            radial-gradient(circle at 48% 47%,
              #ecfdf5 0 24%,
              #d1fae5 38%,
              #a7f3d0 52%,
              #6ee7b7 66%,
              #5eead4 76%,
              #67e8f9 84%,
              #ecfeff 89%,
              transparent 91%),
            conic-gradient(from 205deg, #a7f3d0, #67e8f9, #6ee7b7, #99f6e4, #a7f3d0);
          border-color: rgba(52,211,153,.55);
          box-shadow:
            0 0 0 4px rgba(248,255,252,.90),
            0 0 17px rgba(52,211,153,.26),
            0 0 34px rgba(45,212,191,.15),
            0 12px 28px rgba(16,185,129,.11),
            inset 0 0 24px rgba(255,255,255,.30);
        }

        .ayca-orb-v3::before {
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,.34), transparent 20%),
            radial-gradient(circle at 72% 74%, rgba(103,232,249,.18), transparent 27%),
            rgba(209,250,229,.20);
          border-color: rgba(255,255,255,.50);
        }

        .ayca-orb-v3::after {
          background: radial-gradient(circle, rgba(110,231,183,.16), rgba(94,234,212,.08) 48%, transparent 70%);
        }

        .ayca-orb-v3-orbit-a {
          border-color: rgba(15,118,110,.34);
        }

        .ayca-orb-v3-orbit-b {
          border-color: rgba(14,116,144,.20);
        }

        .ayca-orb-v3-particle {
          background: #34d399;
          box-shadow: 0 0 8px rgba(16,185,129,.52);
        }

        .ayca-orb-v3-p2 {
          background: #22d3ee;
        }

        .ayca-orb-v3-p3 {
          background: #10b981;
        }

        .ayca-orb-v3-logo small {
          color: rgba(15,39,71,.62);
          text-shadow: none;
        }

        /* Keep the header orb freely draggable in both axes. */
        .ayca-header-orb-button {
          cursor: grab !important;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          will-change: transform;
        }

        .ayca-header-orb-button:active {
          cursor: grabbing !important;
        }


        /* AYÇA ORB V3.6 — reference violet/blue/cyan palette */
        .ayca-orb-v3 {
          background:
            radial-gradient(circle at 32% 24%, rgba(255,255,255,.78) 0 3.5%, transparent 6%),
            radial-gradient(circle at 34% 30%, rgba(129,92,246,.88), transparent 34%),
            linear-gradient(135deg, #7c4df5 5%, #655cf5 34%, #4f8eea 62%, #29c7c7 100%) !important;
          border-color: rgba(118,91,245,.30) !important;
          box-shadow:
            0 0 0 3px rgba(255,255,255,.72),
            0 0 22px rgba(99,102,241,.24),
            0 0 38px rgba(34,211,238,.12),
            0 13px 30px rgba(79,70,229,.13),
            inset 0 0 26px rgba(255,255,255,.10) !important;
        }

        .ayca-orb-v3::before {
          background:
            radial-gradient(circle at 30% 26%, rgba(255,255,255,.16), transparent 20%),
            radial-gradient(circle at 74% 76%, rgba(34,211,238,.12), transparent 26%),
            transparent !important;
          border-color: rgba(255,255,255,.14) !important;
        }

        .ayca-orb-v3::after {
          background: radial-gradient(circle, rgba(99,102,241,.15), rgba(34,211,238,.07) 50%, transparent 72%) !important;
        }

        .ayca-orb-v3-orbit-a {
          border-color: rgba(139,92,246,.42) !important;
        }

        .ayca-orb-v3-orbit-b {
          border-color: rgba(56,189,248,.38) !important;
        }

        .ayca-orb-v3-word .ayca-letter-navy {
          color: #ffffff !important;
          text-shadow: 0 1px 1px rgba(15,23,42,.12), 0 0 10px rgba(255,255,255,.16) !important;
        }

        .ayca-orb-v3-word .ayca-letter-green {
          color: #172554 !important;
          text-shadow: 0 1px 0 rgba(255,255,255,.15) !important;
        }

        .ayca-orb-v3-logo small {
          color: rgba(255,255,255,.88) !important;
          text-shadow: 0 1px 2px rgba(15,23,42,.14) !important;
        }

        .ayca-orb-v3-particle {
          background: #ffffff !important;
          box-shadow: 0 0 9px rgba(255,255,255,.62) !important;
        }

        .ayca-orb-v3-p2 {
          background: #67e8f9 !important;
        }

        /* Drag target must stay movable in both axes; override hover transforms. */
        .ayca-header-orb-button {
          cursor: grab !important;
          touch-action: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          will-change: transform !important;
          position: relative;
          z-index: 5;
        }

        .ayca-header-orb-button:active {
          cursor: grabbing !important;
        }


        /* AYÇA ORB V3.7 — deep teal reference tone */
        .ayca-orb-v3 {
          background:
            radial-gradient(circle at 31% 23%, rgba(255,255,255,.34) 0 3%, transparent 5%),
            radial-gradient(circle at 42% 38%, rgba(12,91,94,.52), transparent 42%),
            linear-gradient(145deg, #0b5558 0%, #084c50 42%, #06464a 72%, #053f43 100%) !important;
          border-color: rgba(93,210,205,.32) !important;
          box-shadow:
            0 0 0 3px rgba(238,255,253,.74),
            0 0 18px rgba(13,148,136,.20),
            0 0 34px rgba(6,95,100,.16),
            0 12px 28px rgba(4,65,69,.16),
            inset 0 0 28px rgba(255,255,255,.045) !important;
        }

        .ayca-orb-v3::before {
          background:
            repeating-linear-gradient(
              135deg,
              rgba(255,255,255,.018) 0px,
              rgba(255,255,255,.018) 1px,
              transparent 1px,
              transparent 10px
            ) !important;
          border-color: rgba(255,255,255,.10) !important;
        }

        .ayca-orb-v3::after {
          background: radial-gradient(circle, rgba(45,212,191,.10), rgba(6,78,82,.07) 52%, transparent 72%) !important;
        }

        .ayca-orb-v3-orbit-a {
          border-color: rgba(255,255,255,.34) !important;
        }

        .ayca-orb-v3-orbit-b {
          border-color: rgba(153,246,228,.20) !important;
        }

        .ayca-orb-v3-word .ayca-letter,
        .ayca-orb-v3-word .ayca-letter-navy,
        .ayca-orb-v3-word .ayca-letter-green {
          color: #ffffff !important;
          text-shadow: 0 1px 2px rgba(0,0,0,.18), 0 0 10px rgba(255,255,255,.08) !important;
        }

        .ayca-orb-v3-logo small {
          color: rgba(255,255,255,.84) !important;
          text-shadow: 0 1px 2px rgba(0,0,0,.16) !important;
        }

        .ayca-orb-v3-particle,
        .ayca-orb-v3-p2,
        .ayca-orb-v3-p3 {
          background: #ffffff !important;
          box-shadow: 0 0 8px rgba(255,255,255,.46) !important;
        }


        /* Dashboard spacing fix — original layout preserved */
        .dashboard-hero {
          margin-bottom: 18px !important;
        }

        .dashboard-kpis,
        .dashboard-finance-kpis {
          gap: 16px !important;
          margin-bottom: 18px !important;
          align-items: stretch !important;
        }

        .dashboard-kpis > *,
        .dashboard-finance-kpis > * {
          min-width: 0 !important;
          height: auto !important;
        }

        .dashboard-kpis .insight-kpi,
        .dashboard-finance-kpis .insight-kpi {
          padding: 18px 20px !important;
          min-height: 158px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          gap: 0 !important;
          overflow: hidden !important;
        }

        .dashboard-kpis .insight-kpi > b,
        .dashboard-finance-kpis .insight-kpi > b {
          position: static !important;
          align-self: flex-end !important;
          margin-bottom: -18px !important;
          line-height: 1 !important;
          flex: 0 0 auto !important;
        }

        .dashboard-kpis .insight-kpi > span,
        .dashboard-finance-kpis .insight-kpi > span {
          display: block !important;
          width: 100% !important;
          margin: 0 0 10px !important;
          padding-right: 32px !important;
          color: #64748b !important;
          line-height: 1.25 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .dashboard-kpis .insight-kpi > strong,
        .dashboard-finance-kpis .insight-kpi > strong {
          display: block !important;
          width: 100% !important;
          margin: 0 0 10px !important;
          line-height: 1.05 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
        }

        .dashboard-kpis .insight-kpi > p,
        .dashboard-finance-kpis .insight-kpi > p {
          width: 100% !important;
          margin: 0 0 12px !important;
          line-height: 1.45 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .dashboard-kpis .navigation-hint,
        .dashboard-finance-kpis .navigation-hint {
          position: static !important;
          display: block !important;
          width: 100% !important;
          margin-top: auto !important;
          padding-top: 4px !important;
          line-height: 1.25 !important;
          white-space: normal !important;
        }

        [aria-label="Dashboard mini analiz grafikleri"] {
          gap: 16px !important;
          margin-bottom: 18px !important;
          align-items: stretch !important;
        }

        [aria-label="Dashboard mini analiz grafikleri"] > button {
          min-width: 0 !important;
          overflow: hidden !important;
        }

        [aria-label="Dashboard mini analiz grafikleri"] > button > div:first-child {
          min-width: 0 !important;
          align-items: flex-start !important;
        }

        [aria-label="Dashboard mini analiz grafikleri"] > button > div:first-child > div {
          min-width: 0 !important;
        }

        [aria-label="Dashboard mini analiz grafikleri"] strong,
        [aria-label="Dashboard mini analiz grafikleri"] small,
        [aria-label="Dashboard mini analiz grafikleri"] span {
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
        }

        .dashboard-command-grid,
        .dashboard-lower-grid {
          gap: 16px !important;
          align-items: stretch !important;
        }

        .dashboard-command-grid > *,
        .dashboard-lower-grid > * {
          min-width: 0 !important;
          overflow: hidden !important;
        }

        /* Tablet: prevent cards becoming too narrow and colliding */
        @media (max-width: 1280px) and (min-width: 901px) {
          .dashboard-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .dashboard-finance-kpis {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 1050px) {
          .dashboard-finance-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-kpis,
          .dashboard-finance-kpis {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .dashboard-kpis .insight-kpi,
          .dashboard-finance-kpis .insight-kpi {
            min-height: 142px !important;
            padding: 16px !important;
          }

          [aria-label="Dashboard mini analiz grafikleri"] {
            gap: 12px !important;
          }
        }


        /* Dashboard top 4 KPI cards — fill the entire row evenly */
        .dashboard-kpis {
          width: 100% !important;
          max-width: none !important;
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          column-gap: 18px !important;
          row-gap: 18px !important;
        }

        .dashboard-kpis > .insight-kpi {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          box-sizing: border-box !important;
        }

        @media (max-width: 1180px) and (min-width: 761px) {
          .dashboard-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-kpis {
            grid-template-columns: 1fr !important;
          }
        }


        /* AYÇA Daily Briefing V1 */
        .command-card {
          min-width: 0;
        }

        .ayca-briefing-summary {
          margin: 2px 0 13px;
          padding: 11px 13px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(6,78,82,.055), rgba(45,212,191,.035));
          border: 1px solid rgba(6,78,82,.09);
        }

        .ayca-briefing-summary strong {
          display: block;
          color: #102a43;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 850;
        }

        .ayca-briefing-summary span {
          display: block;
          margin-top: 3px;
          color: #8291a7;
          font-size: 9px;
          line-height: 1.4;
          font-weight: 650;
        }

        .ayca-briefing-list {
          display: grid;
          gap: 10px;
        }

        .ayca-briefing-item {
          position: relative;
          display: grid;
          grid-template-columns: 118px minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          min-width: 0;
          min-height: 84px;
          padding: 13px 14px 13px 15px;
          overflow: hidden;
          border: 1px solid #e3e9ef;
          border-radius: 13px;
          background: #fbfcfd;
        }

        .ayca-briefing-item::before {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 3px;
          background: #64748b;
        }

        .ayca-briefing-item.is-critical::before { background: #ef4444; }
        .ayca-briefing-item.is-high::before { background: #f59e0b; }
        .ayca-briefing-item.is-medium::before { background: #6366f1; }
        .ayca-briefing-item.is-opportunity::before { background: #0f8a6c; }

        .ayca-briefing-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .ayca-briefing-level,
        .ayca-briefing-category {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 4px 7px;
          border-radius: 6px;
          font-size: 8px;
          line-height: 1;
          font-weight: 850;
          white-space: nowrap;
        }

        .ayca-briefing-level {
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #64748b;
        }

        .ayca-briefing-level.is-critical {
          color: #dc2626;
          border-color: #fecaca;
          background: #fff5f5;
        }

        .ayca-briefing-level.is-high {
          color: #d97706;
          border-color: #fed7aa;
          background: #fff8ed;
        }

        .ayca-briefing-level.is-medium {
          color: #4f46e5;
          border-color: #c7d2fe;
          background: #f5f7ff;
        }

        .ayca-briefing-level.is-opportunity {
          color: #0f8a6c;
          border-color: #bfeade;
          background: #f0fbf7;
        }

        .ayca-briefing-category {
          padding-left: 0;
          padding-right: 0;
          background: transparent;
          color: #94a3b8;
        }

        .ayca-briefing-copy {
          min-width: 0;
        }

        .ayca-briefing-copy strong {
          display: block;
          color: #172033;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 850;
          letter-spacing: -.01em;
          overflow-wrap: anywhere;
        }

        .ayca-briefing-copy p {
          margin: 4px 0 0;
          color: #7b879a;
          font-size: 9px;
          line-height: 1.5;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .ayca-briefing-action {
          min-width: 116px;
          padding: 8px 10px;
          border: 1px solid #dbe4eb;
          border-radius: 9px;
          background: #fff;
          color: #0b5558;
          font-size: 9px;
          line-height: 1.2;
          font-weight: 850;
          cursor: pointer;
          white-space: nowrap;
          transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
        }

        .ayca-briefing-action:hover {
          transform: translateY(-1px);
          border-color: rgba(6,78,82,.28);
          box-shadow: 0 6px 14px rgba(6,78,82,.07);
        }

        .ayca-briefing-action span {
          margin-left: 4px;
        }

        @media (max-width: 1180px) {
          .ayca-briefing-item {
            grid-template-columns: 105px minmax(0, 1fr);
          }

          .ayca-briefing-action {
            grid-column: 2;
            justify-self: start;
            min-width: 0;
          }
        }

        @media (max-width: 640px) {
          .ayca-briefing-item {
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 12px 13px;
          }

          .ayca-briefing-action {
            grid-column: auto;
            justify-self: stretch;
            width: 100%;
          }
        }


        /* AYÇA Briefing — full width dashboard row */
        .dashboard-command-grid {
          width: 100% !important;
          max-width: none !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 0 !important;
          align-items: stretch !important;
        }

        .dashboard-command-grid > .command-card {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .dashboard-command-grid .ayca-briefing-item {
          grid-template-columns: 126px minmax(0, 1fr) 132px;
          column-gap: 18px;
        }

        .dashboard-command-grid .ayca-briefing-copy strong {
          font-size: 13px;
        }

        .dashboard-command-grid .ayca-briefing-copy p {
          font-size: 10px;
          line-height: 1.55;
        }

        .dashboard-command-grid .ayca-briefing-action {
          min-width: 126px;
        }

        @media (max-width: 1180px) {
          .dashboard-command-grid .ayca-briefing-item {
            grid-template-columns: 112px minmax(0, 1fr);
          }

          .dashboard-command-grid .ayca-briefing-action {
            grid-column: 2;
            justify-self: start;
          }
        }

        @media (max-width: 640px) {
          .dashboard-command-grid .ayca-briefing-item {
            grid-template-columns: 1fr;
          }

          .dashboard-command-grid .ayca-briefing-action {
            grid-column: auto;
            width: 100%;
          }
        }


        /* Order Center V1 */
        .order-center {
          display: grid;
          gap: 16px;
        }

        .order-center-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          gap: 24px;
          align-items: stretch;
          padding: 22px 24px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background:
            radial-gradient(circle at 88% 10%, rgba(6,78,82,.07), transparent 30%),
            linear-gradient(180deg, #fff 0%, #fbfcfd 100%);
          box-shadow: 0 8px 26px rgba(15,23,42,.04);
        }

        .order-center-kicker {
          display: block;
          margin-bottom: 7px;
          color: #0b5558;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .12em;
        }

        .order-center-hero h2 {
          margin: 0;
          color: #172033;
          font-size: clamp(22px, 2.2vw, 31px);
          line-height: 1.12;
          letter-spacing: -.035em;
        }

        .order-center-hero p {
          max-width: 710px;
          margin: 9px 0 0;
          color: #7b879a;
          font-size: 11px;
          line-height: 1.6;
          font-weight: 600;
        }

        .order-center-budget {
          display: flex;
          min-width: 0;
          flex-direction: column;
          justify-content: center;
          padding: 17px 18px;
          border: 1px solid rgba(6,78,82,.10);
          border-radius: 14px;
          background: rgba(6,78,82,.035);
        }

        .order-center-budget span,
        .order-center-summary span,
        .order-result-column > span {
          color: #8a97a9;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .09em;
        }

        .order-center-budget strong {
          margin-top: 7px;
          overflow: hidden;
          color: #0b5558;
          font-size: 24px;
          line-height: 1.05;
          letter-spacing: -.04em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .order-center-budget small {
          margin-top: 6px;
          color: #8291a7;
          font-size: 9px;
          font-weight: 650;
        }

        .order-center-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 6px 20px rgba(15,23,42,.03);
        }

        .order-center-summary > div {
          min-width: 0;
          padding: 15px 18px;
          border-right: 1px solid #edf1f4;
        }

        .order-center-summary > div:last-child {
          border-right: 0;
        }

        .order-center-summary strong {
          display: block;
          margin-top: 6px;
          color: #172554;
          font-size: 19px;
          line-height: 1.1;
          font-weight: 850;
          letter-spacing: -.03em;
        }

        .order-center-summary small {
          display: block;
          margin-top: 5px;
          color: #94a3b8;
          font-size: 8px;
          line-height: 1.35;
          font-weight: 650;
        }

        .order-center-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          padding: 3px 2px 0;
        }

        .order-center-heading h3 {
          margin: 0;
          color: #172033;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -.02em;
        }

        .order-center-heading p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 650;
        }

        .order-center-heading > span {
          padding: 5px 8px;
          border: 1px solid #dfe6ec;
          border-radius: 7px;
          background: #fff;
          color: #64748b;
          font-size: 8px;
          font-weight: 850;
        }

        .order-center-list {
          display: grid;
          gap: 10px;
        }

        .order-recommendation {
          position: relative;
          display: grid;
          grid-template-columns: 104px minmax(0, 1fr) 170px;
          gap: 17px;
          align-items: center;
          min-width: 0;
          min-height: 118px;
          padding: 15px 17px 15px 19px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 5px 18px rgba(15,23,42,.025);
        }

        .order-recommendation::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: #0b5558;
        }

        .order-recommendation.priority-acil::before,
        .order-recommendation.priority-kritik::before,
        .order-recommendation.priority-critical::before {
          background: #ef4444;
        }

        .order-recommendation.priority-yuksek::before,
        .order-recommendation.priority-high::before {
          background: #f59e0b;
        }

        .order-recommendation.priority-orta::before,
        .order-recommendation.priority-medium::before {
          background: #6366f1;
        }

        .order-priority-column {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 9px;
        }

        .order-index {
          color: #b0bac7;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .order-priority-pill {
          display: inline-flex;
          align-items: center;
          min-height: 25px;
          padding: 5px 8px;
          border: 1px solid #dce4ea;
          border-radius: 7px;
          background: #f8fafc;
          color: #475569;
          font-size: 8px;
          font-weight: 900;
        }

        .order-product-column {
          min-width: 0;
        }

        .order-product-column > strong {
          display: block;
          color: #172033;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .order-product-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(72px, 1fr));
          gap: 11px;
          margin-top: 13px;
        }

        .order-product-metrics > span {
          min-width: 0;
          padding-right: 9px;
          border-right: 1px solid #edf1f4;
        }

        .order-product-metrics > span:last-child {
          border-right: 0;
        }

        .order-product-metrics small {
          display: block;
          color: #a0aaba;
          font-size: 7px;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: .06em;
        }

        .order-product-metrics b {
          display: block;
          margin-top: 5px;
          color: #4b5565;
          font-size: 10px;
          font-weight: 850;
        }

        .order-result-column {
          min-width: 0;
          padding: 12px 14px;
          border: 1px solid rgba(6,78,82,.10);
          border-radius: 12px;
          background: rgba(6,78,82,.035);
          text-align: right;
        }

        .order-result-column strong {
          display: block;
          margin-top: 6px;
          color: #0b5558;
          font-size: 19px;
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: -.03em;
        }

        .order-result-column small {
          display: block;
          margin-top: 6px;
          color: #64748b;
          font-size: 9px;
          font-weight: 750;
        }

        .order-center-empty {
          display: grid;
          place-items: center;
          min-height: 230px;
          padding: 30px;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          background: #fbfcfd;
          text-align: center;
        }

        .order-center-empty > span {
          color: #0b5558;
          font-size: 24px;
        }

        .order-center-empty strong {
          margin-top: 8px;
          color: #334155;
          font-size: 14px;
        }

        .order-center-empty p {
          max-width: 480px;
          margin: 6px 0 0;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.55;
        }

        @media (max-width: 1100px) {
          .order-center-hero {
            grid-template-columns: 1fr;
          }

          .order-center-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .order-center-summary > div:nth-child(2) {
            border-right: 0;
          }

          .order-center-summary > div:nth-child(-n+2) {
            border-bottom: 1px solid #edf1f4;
          }

          .order-recommendation {
            grid-template-columns: 92px minmax(0, 1fr);
          }

          .order-result-column {
            grid-column: 2;
            text-align: left;
          }

          .order-product-metrics {
            grid-template-columns: repeat(3, minmax(72px, 1fr));
          }
        }

        @media (max-width: 640px) {
          .order-center-hero {
            padding: 18px;
          }

          .order-center-summary {
            grid-template-columns: 1fr;
          }

          .order-center-summary > div {
            border-right: 0;
            border-bottom: 1px solid #edf1f4;
          }

          .order-center-summary > div:last-child {
            border-bottom: 0;
          }

          .order-recommendation {
            grid-template-columns: 1fr;
            gap: 11px;
            padding: 15px;
          }

          .order-priority-column {
            flex-direction: row;
            align-items: center;
          }

          .order-product-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .order-product-metrics > span {
            border-right: 0;
          }

          .order-result-column {
            grid-column: auto;
            text-align: left;
          }
        }


        /* AYÇA decision language — operation tabs */
        .ayca-decision-card {
          position: relative;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) auto;
          gap: 15px;
          align-items: center;
          width: 100%;
          min-width: 0;
          padding: 16px 18px;
          overflow: hidden;
          border: 1px solid rgba(6, 78, 82, .14);
          border-radius: 15px;
          background:
            radial-gradient(circle at 93% 12%, rgba(13, 148, 136, .09), transparent 28%),
            linear-gradient(135deg, rgba(240, 253, 250, .78), #ffffff 48%, #fbfcfd 100%);
          box-shadow: 0 7px 22px rgba(15, 23, 42, .035);
        }

        .ayca-decision-card::after {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: linear-gradient(180deg, #0b5558, #14b8a6);
        }

        .ayca-decision-mark {
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border: 1px solid rgba(6, 78, 82, .12);
          border-radius: 50%;
          background: #0b5558;
          color: #fff;
          font-size: 17px;
          box-shadow: 0 7px 18px rgba(6, 78, 82, .16);
        }

        .ayca-decision-content {
          min-width: 0;
        }

        .ayca-decision-content > span {
          display: block;
          margin-bottom: 5px;
          color: #0b5558;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .11em;
        }

        .ayca-decision-content > strong {
          display: block;
          color: #172033;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 900;
          letter-spacing: -.015em;
        }

        .ayca-decision-content > p {
          max-width: 900px;
          margin: 5px 0 0;
          color: #718096;
          font-size: 9px;
          line-height: 1.55;
          font-weight: 650;
        }

        .ayca-decision-card > button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 34px;
          padding: 8px 11px;
          border: 1px solid rgba(6, 78, 82, .14);
          border-radius: 9px;
          background: #fff;
          color: #0b5558;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .ayca-decision-card > button:hover {
          background: #f0fdfa;
          transform: translateY(-1px);
        }

        @media (max-width: 760px) {
          .ayca-decision-card {
            grid-template-columns: 38px minmax(0, 1fr);
          }

          .ayca-decision-card > button {
            grid-column: 2;
            justify-self: start;
          }
        }


        /* Premium Finance */
        .finance-premium-kpis {
          width: 100% !important;
          max-width: 1240px;
          margin: 0 auto !important;
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 18px !important;
          align-items: stretch;
        }

        .finance-premium-kpi {
          appearance: none;
          text-align: left;
          width: 100%;
          min-width: 0;
          min-height: 136px;
          padding: 20px 21px 17px;
          border: 1px solid #e4eaee;
          border-radius: 18px;
          background:
            radial-gradient(circle at 90% 88%, rgba(20,184,166,.10), transparent 24%),
            linear-gradient(145deg, #fff 0%, #fcfefe 100%);
          box-shadow: 0 9px 24px rgba(15,23,42,.045);
          color: inherit;
        }

        button.finance-premium-kpi { cursor: pointer; }

        .finance-premium-kpi > span {
          display: block;
          color: #66758b;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .08em;
        }

        .finance-premium-kpi > strong {
          display: block;
          margin-top: 13px;
          color: #0b1b42;
          font-size: clamp(24px, 2.25vw, 35px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -.045em;
          white-space: nowrap;
        }

        .finance-premium-kpi > p {
          margin: 10px 0 0;
          color: #8795aa;
          font-size: 10px;
          font-weight: 650;
        }

        .finance-premium-kpi > em {
          display: block;
          margin-top: 9px;
          color: #0b766f;
          font-size: 9px;
          font-style: normal;
          font-weight: 900;
        }

        .finance-margin-line {
          height: 3px;
          margin-top: 12px;
          overflow: hidden;
          border-radius: 99px;
          background: #edf2f4;
        }

        .finance-margin-line i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #0b5558, #2dd4bf);
        }

        .finance-ayca-decision {
          width: 100%;
          max-width: 1240px;
          margin: 18px auto 0;
        }

        .finance-premium-chart-card,
        .finance-premium-panel {
          border: 1px solid #e5ebef;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(15,23,42,.035);
        }

        .finance-premium-chart-card {
          width: 100%;
          max-width: 1240px;
          margin: 18px auto 0;
          padding: 21px 22px 16px;
        }

        .finance-premium-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .finance-premium-section-head > div:first-child > span {
          display: block;
          margin-bottom: 5px;
          color: #0b766f;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .12em;
        }

        .finance-premium-section-head h2 {
          margin: 0;
          color: #13213b;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -.025em;
        }

        .finance-premium-section-head p {
          margin: 5px 0 0;
          color: #8a97aa;
          font-size: 9px;
          font-weight: 650;
        }

        .finance-chart-legend {
          display: flex;
          gap: 13px;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
        }

        .finance-chart-legend span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .finance-chart-legend i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .revenue-dot { background: #0b5558; }
        .profit-dot { background: #14b8a6; }

        .finance-premium-chart {
          height: 300px !important;
          margin-top: 10px;
        }

        .finance-premium-bottom-grid {
          width: 100%;
          max-width: 1240px;
          margin: 18px auto 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .finance-premium-panel {
          min-width: 0;
          padding: 20px;
        }

        .finance-premium-section-head.compact {
          margin-bottom: 12px;
        }

        .finance-product-list {
          display: grid;
          gap: 4px;
        }

        .finance-product-row {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          min-width: 0;
          padding: 10px 5px;
          border-top: 1px solid #f0f3f5;
        }

        .finance-product-row > b {
          color: #a0adba;
          font-size: 9px;
          font-weight: 900;
        }

        .finance-product-row > div {
          min-width: 0;
        }

        .finance-product-row > div strong {
          display: block;
          overflow: hidden;
          color: #24324a;
          font-size: 10px;
          font-weight: 850;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .finance-product-row > div small {
          display: block;
          margin-top: 3px;
          color: #96a2b2;
          font-size: 8px;
          font-weight: 650;
        }

        .finance-product-row > span {
          color: #0b5558;
          font-size: 10px;
          font-weight: 950;
          white-space: nowrap;
        }

        .finance-empty {
          padding: 24px 0;
          color: #94a3b8;
          font-size: 10px;
        }

        .finance-premium-strip {
          width: 100%;
          max-width: 1240px;
          margin: 18px auto 0;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          overflow: hidden;
          border: 1px solid #e5ebef;
          border-radius: 15px;
          background: #fff;
        }

        .finance-premium-strip > div {
          min-width: 0;
          padding: 15px 18px;
          border-right: 1px solid #edf1f3;
        }

        .finance-premium-strip > div:last-child { border-right: 0; }

        .finance-premium-strip span,
        .finance-premium-strip small {
          display: block;
          color: #8b98aa;
          font-size: 8px;
          font-weight: 800;
        }

        .finance-premium-strip strong {
          display: block;
          margin: 6px 0 4px;
          color: #17233b;
          font-size: 17px;
          font-weight: 950;
        }

        @media (max-width: 1050px) {
          .finance-premium-kpis,
          .finance-premium-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .finance-premium-bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .finance-premium-kpis,
          .finance-premium-strip {
            grid-template-columns: 1fr !important;
          }

          .finance-premium-strip > div {
            border-right: 0;
            border-bottom: 1px solid #edf1f3;
          }

          .finance-premium-strip > div:last-child { border-bottom: 0; }

          .finance-premium-section-head {
            flex-direction: column;
          }

          .finance-premium-kpi > strong {
            white-space: normal;
          }
        }

        /* Dashboard V2 — finance trend emphasis */
        .dashboard-finance-kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .dashboard-finance-trend-card {
          grid-column: span 2;
        }

        /* Dashboard lower area now has only data center + opportunity radar. */
        .dashboard-lower-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        /* Finance lists keep the cards compact while allowing full exploration. */
        .finance-product-list {
          max-height: 310px;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding-right: 6px;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        .finance-product-list::-webkit-scrollbar {
          width: 7px;
        }

        .finance-product-list::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #cbd5e1;
        }

        .finance-product-list::-webkit-scrollbar-track {
          background: transparent;
        }

        /* Patient privacy control — compact, intentional KVKK switch. */
        .patient-privacy-control {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 7px 9px 7px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 5px 16px rgba(15, 23, 42, .05);
        }

        .patient-privacy-copy {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 92px;
        }

        .patient-privacy-copy span {
          color: #6d28d9;
          font-size: 10px;
          font-weight: 900;
          line-height: 1.2;
        }

        .patient-privacy-copy small {
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.2;
        }

        .patient-privacy-switch {
          position: relative;
          width: 42px;
          height: 24px;
          flex: 0 0 42px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: #cbd5e1;
          cursor: pointer;
          transition: background 160ms ease, box-shadow 160ms ease;
        }

        .patient-privacy-switch > span {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, .2);
          transition: transform 160ms ease;
        }

        .patient-privacy-switch.is-on {
          background: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, .10);
        }

        .patient-privacy-switch.is-on > span {
          transform: translateX(18px);
        }

        @media (max-width: 1050px) {
          .dashboard-finance-trend-card {
            grid-column: auto !important;
          }

          .dashboard-lower-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .dashboard-finance-kpis {
            grid-template-columns: 1fr !important;
          }

          .patient-privacy-control {
            width: max-content;
            max-width: 100%;
          }
        }

        /* Dashboard V5 — 4-up summary, full-width trend */
        .dashboard-finance-summary-grid {
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:16px;
          margin-bottom:18px;
          align-items:stretch;
        }
        .dashboard-finance-compact-kpi { min-height:174px !important; padding:18px 22px !important; }
        .dashboard-finance-compact-kpi > strong { font-size:clamp(26px,2vw,36px) !important; line-height:1.05 !important; margin-bottom:8px !important; }
        .dashboard-stock-risk-card,.dashboard-patient-summary-card,.dashboard-finance-trend-full {
          min-width:0; border:1px solid #e8edf5; border-radius:22px; background:#fff;
          box-shadow:0 10px 26px rgba(15,23,42,.055); text-align:left; cursor:pointer;
        }
        .dashboard-stock-risk-card,.dashboard-patient-summary-card {
          min-height:174px; padding:14px 16px 10px; display:flex; flex-direction:column; gap:4px;
        }
        .dashboard-mini-card-head { display:flex; justify-content:space-between; gap:10px; min-width:0; }
        .dashboard-mini-card-head > div { min-width:0; }
        .dashboard-mini-card-head > div > span { display:block; font-size:12px; font-weight:900; color:#475569; }
        .dashboard-mini-card-head strong { display:block; margin-top:7px; font-size:25px; color:#172554; line-height:1; }
        .dashboard-mini-card-head small { display:block; margin-top:6px; color:#94a3b8; font-weight:700; }
        .dashboard-card-arrow { color:#7c3aed; font-weight:900; }
        .dashboard-stock-risk-chart,.dashboard-patient-summary-chart { width:100%; height:108px; margin-top:auto; }
        .dashboard-dashboard-second-row { display:grid; grid-template-columns:1fr; gap:16px; margin-bottom:18px; }
        .dashboard-finance-trend-full { width:100%; min-height:410px; padding:22px 24px 18px; }
        .dashboard-trend-head { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; margin-bottom:8px; }
        .dashboard-trend-head > div:first-child > span { display:block; color:#0f766e; font-size:10px; font-weight:950; letter-spacing:.08em; }
        .dashboard-trend-head h2 { margin:7px 0 4px; color:#172554; font-size:23px; line-height:1.1; }
        .dashboard-trend-head small { color:#94a3b8; font-weight:700; }
        .dashboard-trend-legend { display:inline-flex; gap:16px; align-items:center; color:#64748b; font-size:11px; font-weight:800; }
        .dashboard-trend-legend span { display:inline-flex; align-items:center; gap:6px; }
        .dashboard-trend-legend i { width:9px; height:9px; border-radius:50%; display:inline-block; }
        .dashboard-trend-legend .turnover-dot { background:#0b5558; }
        .dashboard-trend-legend .profit-dot { background:#14b8a6; }
        .dashboard-finance-trend-chart { width:100%; height:318px; margin-top:10px; }
        .dashboard-trend-empty { height:100%; display:grid; place-items:center; color:#94a3b8; font-size:12px; font-weight:700; }

        /* Patient & Prescription V2 — balanced 4/3 KPI layout */
        .patient-kpi-grid {
          display:grid !important;
          grid-template-columns:repeat(8,minmax(0,1fr)) !important;
          gap:16px !important;
        }
        .patient-kpi-grid > .patient-kpi { grid-column:span 2; min-width:0; }
        .patient-kpi-grid > .patient-kpi:nth-child(5) { grid-column:2 / span 2; }
        .prescription-grid {
          display:grid !important;
          grid-template-columns:repeat(4,minmax(0,1fr)) !important;
          gap:14px !important;
        }

        @media (max-width:1180px) {
          .dashboard-finance-summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .patient-kpi-grid { grid-template-columns:repeat(4,minmax(0,1fr)) !important; }
          .patient-kpi-grid > .patient-kpi { grid-column:span 2; }
          .patient-kpi-grid > .patient-kpi:nth-child(5) { grid-column:auto / span 2; }
          .patient-kpi-grid > .patient-kpi:nth-child(7) { grid-column:2 / span 2; }
          .prescription-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        }
        @media (max-width:900px) {
          .dashboard-finance-summary-grid { grid-template-columns:1fr 1fr; }
        }
        @media (max-width:760px) {
          .dashboard-finance-summary-grid { grid-template-columns:1fr; gap:12px; }
          .dashboard-finance-trend-full { min-height:330px; padding:18px 14px 12px; }
          .dashboard-finance-trend-chart { height:235px; }
          .dashboard-trend-head { flex-direction:column; }
          .patient-kpi-grid { grid-template-columns:1fr !important; }
          .patient-kpi-grid > .patient-kpi,
          .patient-kpi-grid > .patient-kpi:nth-child(5),
          .patient-kpi-grid > .patient-kpi:nth-child(7) { grid-column:auto !important; }
          .prescription-grid { grid-template-columns:1fr !important; }
        }
      `}
      </style>
    </main>
  );
}

export default DashboardPage;
