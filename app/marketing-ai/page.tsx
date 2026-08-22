"use client";

import { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import Sidebar from "../dashboard/components/Sidebar";
import Navbar from "../dashboard/components/Navbar";
import auth from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { useProjectMemory } from "../hooks/useProjectMemory";

const MARKETING_GOALS = [
  "Generate Leads",
  "Sell Products",
  "Showcase Portfolio",
  "Book Appointments",
  "Build Brand Awareness",
  "Provide Information",
  "Grow Online Presence",
  "Offer Online Services",
  "Community & Membership",
  "Other",
] as const;

type MarketingResult = Record<string, unknown> & {
  adCopy?: string;
  bestChannels?: string;
  campaignTimeline?: string;
  contentCalendar?: string;
  contentIdeas?: string;
  contentMix?: string;
  customerJourney?: string;
  emailMarketing?: string;
  funnelSuggestions?: string;
  growthRecommendations?: string;
  kpis?: string;
  marketingDashboard?: {
    channels?: Array<{ label: string; value: string | number }>;
    conversionRate?: string;
    marketingScore?: string;
    monthlyTraffic?: string;
    projectedLeads?: string;
  };
  marketingScore?: string;
  marketingStrategy?: string;
  paidAdsStrategy?: string;
  recommendedTechStack?: string;
  seoRecommendations?: string;
  socialMediaStrategy?: string;
  targetAudienceAnalysis?: string;
  typography?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

function MarketingAIPageContent() {
  const { project, projectId } = useProjectMemory();
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandStyle, setBrandStyle] = useState("Minimal");
  const [brandDescription, setBrandDescription] = useState("");
  const [marketingGoal, setMarketingGoal] = useState("Sell Products");
  const [loading, setLoading] = useState(false);
  const [brandResult, setBrandResult] = useState<MarketingResult | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
const [editInstruction, setEditInstruction] = useState("");
const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      const activeProject = project?.id === projectId ? project : null;
      const projectGoal = activeProject?.goal || "";

      setBrandResult(null);
      setCompanyName(activeProject?.companyName || "");
      setIndustry(activeProject?.industry || "");
      setTargetAudience(activeProject?.targetAudience || "");
      setMarketingGoal(
        MARKETING_GOALS.includes(projectGoal as (typeof MARKETING_GOALS)[number])
          ? projectGoal
          : "",
      );
      setBrandDescription(activeProject?.businessDescription || activeProject?.originalBrief || "");
    });

    return () => {
      active = false;
    };
  }, [project, projectId]);
  useEffect(() => {
  if (!projectId || !project?.userId) return;

  let active = true;

  const loadSavedMarketingOutput = async () => {
    try {
      const response = await authenticatedFetch(
        `/api/project-outputs?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(project.userId)}&module=marketing`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load Marketing AI output");
      }

      if (!active || !data.output?.result) return;

      const savedResult =
        typeof data.output.result === "string"
          ? JSON.parse(data.output.result)
          : data.output.result;

      setBrandResult(savedResult as MarketingResult);
    } catch (error) {
      console.error("Failed to restore Marketing AI output:", error);
    }
  };

  loadSavedMarketingOutput();

  return () => {
    active = false;
  };
}, [projectId, project?.userId]);
  const channelPerformance =
  brandResult?.marketingDashboard?.channels?.map((item) => ({
    label: item.label,
    value: Number(item.value) || 0,
  })) || [];
const kpiCards = [
  {
    title: "Estimated Monthly Leads",
    value: brandResult?.marketingDashboard?.projectedLeads || "0",
  },
  {
    title: "Marketing Score",
    value: brandResult?.marketingDashboard?.marketingScore || "0",
  },
  {
    title: "Conversion Rate",
    value: brandResult?.marketingDashboard?.conversionRate || "0%",
  },
  {
    title: "Monthly Traffic",
    value: brandResult?.marketingDashboard?.monthlyTraffic || "0",
  },
];
const funnelStages = [
  { label: "Awareness", value: 100 },
  { label: "Interest", value: 76 },
  { label: "Consideration", value: 54 },
  { label: "Conversion", value: 31 },
];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };
  const copyEntireBrand = () => {
  if (!brandResult) return;

  const content = `
MARKETING PLAN
${brandResult.marketingStrategy}

CAMPAIGN IDEAS
${brandResult.contentIdeas}

AD COPY
${brandResult.adCopy}

SOCIAL MEDIA CALENDAR
${ brandResult.contentCalendar}

EMAIL MARKETING
${brandResult.emailMarketing}

CONTENT STRATEGY
${ brandResult.targetAudienceAnalysis}

FUNNEL SUGGESTIONS
${brandResult.funnelSuggestions}

KPIs
${brandResult.kpis}

GROWTH RECOMMENDATIONS
${brandResult.growthRecommendations}

MARKETING SCORE
${brandResult.marketingScore}

BEST CHANNELS
${brandResult.bestChannels}

CAMPAIGN TIMELINE
${brandResult.campaignTimeline}

CUSTOMER JOURNEY
${brandResult.customerJourney}

CONTENT MIX
${brandResult.contentMix}
  `.trim();

  copyToClipboard(content, "Complete Marketing Plan");
};
  const downloadPDF = () => {
    if (!brandResult) return;

    const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
});

const pageWidth = doc.internal.pageSize.getWidth();

doc.setFillColor(15, 23, 42);
doc.rect(0, 0, pageWidth, 48, "F");

doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(22);
doc.text("AI Marketing Strategy", 20, 22);

doc.setFont("helvetica", "normal");
doc.setFontSize(11);
doc.setTextColor(148, 163, 184);
doc.text(companyName || "Marketing Strategy Report", 20, 31);

doc.setFontSize(9);
doc.text(
  `Generated on ${new Date().toLocaleDateString()}`,
  20,
  38
);

doc.setTextColor(15, 23, 42);

let y = 60;

    const addSection = (title: string, value?: string) => {
  if (!value) return;

  const lines = doc.splitTextToSize(value, 170);

  // Check if we need a new page BEFORE printing
  if (y + (lines.length * 6) + 20 > 280) {
    doc.addPage();
    y = 20;
  }

  // Section heading
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(15, y - 4, 180, 8, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 20, y + 1);

  y += 10;

  // Section body
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(lines, 20, y);

  y += lines.length * 5 + 10;
};

    addSection("Marketing Plan", brandResult.marketingStrategy);
addSection("Campaign Ideas", brandResult.contentIdeas);
addSection("Ad Copy", brandResult.socialMediaStrategy);
addSection("Social Media Calendar",  brandResult.contentCalendar);
addSection("Email Marketing", brandResult.emailMarketing);
addSection("Content Strategy",  brandResult.targetAudienceAnalysis);
addSection("Funnel Suggestions", brandResult.funnelSuggestions);
addSection("KPIs", brandResult.kpis);
addSection("Growth Recommendations", brandResult.growthRecommendations);
addSection("Marketing Score", brandResult.marketingScore);
addSection("Best Channels", brandResult.bestChannels);
addSection("Campaign Timeline", brandResult.campaignTimeline);
addSection("Customer Journey", brandResult.customerJourney);
addSection("Content Mix", brandResult.contentMix);

    // Add page numbers
const pageCount = doc.getNumberOfPages();

for (let i = 1; i <= pageCount; i++) {
  doc.setPage(i);

  doc.setDrawColor(220, 220, 220);
  doc.line(20, 286, 190, 286);

  doc.setFontSize(9);
  doc.setTextColor(120);

  doc.text(
    `${companyName} Marketing Strategy`,
    20,
    292
  );

  doc.text(
    `Page ${i} of ${pageCount}`,
    190,
    292,
    { align: "right" }
  );
}


doc.save(`${companyName}-Marketing-Strategy.pdf`);

    toast.success("PDF downloaded!");
  };
  const saveProject = async () => {
  if (!brandResult) {
    toast.error("Generate a marketing strategy first.");
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    toast.error("You must be logged in to save a project.");
    return;
  }

  try {
    const response = await authenticatedFetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        userId: user.uid,
        name: `${companyName} Marketing Project`,
        companyName,
        industry,
        targetAudience,
        goal: "",
        brandStyle,
        brandDescription,
        result: JSON.stringify(brandResult),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Project save failed:", data);
      toast.error("Failed to save project.");
      return;
    }

    toast.success("Project saved successfully!");
  } catch (error) {
    console.error("Save project error:", error);
    toast.error("Failed to save project.");
  }
};
  const getAuthenticatedMarketingRequest = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("Authentication is required.");
    }

    if (!projectId) {
      throw new Error("A project is required.");
    }

    return {
      currentUser,
      idToken: await currentUser.getIdToken(),
    };
  };

  const handleGenerateBrand = async () => {
    if (
      !companyName ||
      !industry ||
      !marketingGoal ||
      !brandDescription
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      const { currentUser, idToken } = await getAuthenticatedMarketingRequest();
      const response = await fetch(
        "/api/marketing-ai",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            companyName,
            industry,
            targetAudience,
            brandStyle,
            brandDescription,
            projectId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const text = await response.text();

      console.log("RAW RESPONSE:", text);
      console.log("STATUS:", response.status);

      if (!text.trim()) {
        throw new Error("n8n returned EMPTY response");
      }

      let parsed;

      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      console.log("PARSED:", parsed);

      let result: unknown = parsed;

while (true) {
  if (typeof result === "string") {
    result = JSON.parse(result);
    continue;
  }

  if (
    isRecord(result) &&
    "text" in result &&
    isRecord(result.text)
  ) {
    result = result.text;
    continue;
  }

  if (
  isRecord(result) &&
  "output" in result
) {
  if (typeof result.output === "string") {
    result = JSON.parse(result.output);
  } else {
    result = result.output;
  }
  continue;
}

  break;
}


console.log("FINAL RESULT:", result);

const finalMarketingResult = isRecord(result)
  ? (result as MarketingResult)
  : null;

setBrandResult(finalMarketingResult);

if (projectId && currentUser && finalMarketingResult) {
  const saveOutputResponse = await authenticatedFetch("/api/project-outputs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      userId: currentUser.uid,
      module: "marketing",
      result: finalMarketingResult,
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save Marketing AI output");
  }
}
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

const regenerateSection = async (section: string) => {
  if (!brandResult) return;

  toast.loading(`Regenerating ${section}...`, {
    id: "regen",
  });

  try {
   const { currentUser, idToken } = await getAuthenticatedMarketingRequest();
   const response = await fetch("/api/marketing-ai", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  },
  body: JSON.stringify({
    companyName,
    industry,
    targetAudience,
    brandStyle,
    brandDescription,
    regenerateSection: section,
    currentResult: brandResult,
    projectId,
  }),
});

if (!response.ok) {
  throw new Error(`HTTP Error: ${response.status}`);
}

const data = await response.json();

let regenerated: unknown = data.output ?? data;

if (typeof regenerated === "string") {
  regenerated = JSON.parse(regenerated);
}

if (isRecord(regenerated) && regenerated.output) {
  regenerated =
    typeof regenerated.output === "string"
      ? JSON.parse(regenerated.output)
      : regenerated.output;
}

console.log("REGENERATED RESULT:", regenerated);
console.log(
  "NEW MARKETING STRATEGY:",
  isRecord(regenerated) ? regenerated.marketingStrategy : undefined,
);

const updatedMarketingResult = {
  ...(brandResult ?? {}),
  ...(regenerated as MarketingResult),
} as MarketingResult;

setBrandResult(updatedMarketingResult);

if (projectId && currentUser) {
  const saveOutputResponse = await authenticatedFetch("/api/project-outputs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      userId: currentUser.uid,
      module: "marketing",
      result: updatedMarketingResult,
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save regenerated Marketing AI output");
  }
}

    toast.success(`${section} regenerated successfully`, {
      id: "regen",
    });
  } catch (error) {
    console.error(error);

    toast.error("Failed to regenerate section.", {
      id: "regen",
    });
  }
};
const editWithAI = async () => {
  if (!brandResult || !editingSection || !editInstruction.trim()) return;

  setIsEditing(true);

  try {
    const { currentUser, idToken } = await getAuthenticatedMarketingRequest();
    const response = await fetch("/api/marketing-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        companyName,
        industry,
        targetAudience,
        brandStyle,
        brandDescription,
        regenerateSection: editingSection,
        currentResult: brandResult,
        editInstruction: editInstruction.trim(),
        mode: "edit",
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    let updated: unknown = data.output ?? data;

    if (typeof updated === "string") {
      updated = JSON.parse(updated);
    }

    if (isRecord(updated) && updated.output) {
      updated =
        typeof updated.output === "string"
          ? JSON.parse(updated.output)
          : updated.output;
    }

    const editedMarketingResult = {
  ...(brandResult ?? {}),
  ...(updated as MarketingResult),
} as MarketingResult;

setBrandResult(editedMarketingResult);

if (projectId && currentUser) {
  const saveOutputResponse = await authenticatedFetch("/api/project-outputs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      userId: currentUser.uid,
      module: "marketing",
      result: editedMarketingResult,
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save edited Marketing AI output");
  }
}

    toast.success("Section updated!");

    setEditingSection(null);
    setEditInstruction("");
  } catch (error) {
    console.error(error);
    toast.error("Failed to edit section.");
  } finally {
    setIsEditing(false);
  }
};
const handleNewStrategy = () => {
  setCompanyName("");
  setIndustry("");
  setMarketingGoal("Sell Products");
  setBrandStyle("Minimal");
  setBrandDescription("");
  setBrandResult(null);
  setEditingSection(null);
  setEditInstruction("");
};

const copyIcon = <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>;
const copyButtonClass = "flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50";
const moduleClass = "group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/65 p-5 transition-all hover:border-red-400/30 hover:shadow-[0_0_24px_rgba(239,68,68,0.07)] sm:p-6";
const strategySections = brandResult
  ? [
      { key: "marketingStrategy", label: "Marketing Blueprint", value: brandResult.marketingStrategy, actionable: true },
      { key: "contentIdeas", label: "Campaign Ideas", value: brandResult.contentIdeas, actionable: true },
      { key: "socialMediaStrategy", label: "Social Media Strategy", value: brandResult.socialMediaStrategy, actionable: true },
      { key: "adCopy", label: "Ad Copy", value: brandResult.adCopy, actionable: true },
      { key: "contentCalendar", label: "Content Calendar", value: brandResult.contentCalendar, actionable: true },
      { key: "targetAudienceAnalysis", label: "Target Audience Analysis", value: brandResult.targetAudienceAnalysis, actionable: true },
      { key: "emailMarketing", label: "Email Marketing", value: brandResult.emailMarketing, actionable: true },
      { key: "paidAdsStrategy", label: "Paid Ads Strategy", value: brandResult.paidAdsStrategy, actionable: true },
      { key: "typography", label: "Typography", value: brandResult.typography, actionable: true },
      { key: "recommendedTechStack", label: "Recommended Tech Stack", value: brandResult.recommendedTechStack, actionable: true },
      { key: "seoRecommendations", label: "SEO Recommendations", value: brandResult.seoRecommendations, actionable: true },
      { key: "funnelSuggestions", label: "Funnel Suggestions", value: brandResult.funnelSuggestions, actionable: true },
      { key: "kpis", label: "KPIs", value: brandResult.kpis, actionable: true },
      { key: "growthRecommendations", label: "Growth Recommendations", value: brandResult.growthRecommendations, actionable: true },
      { key: "marketingScore", label: "Marketing Score", value: brandResult.marketingScore, actionable: true },
      { key: "bestChannels", label: "Best Channels", value: brandResult.bestChannels, actionable: true },
      { key: "campaignTimeline", label: "Campaign Timeline", value: brandResult.campaignTimeline, actionable: true },
      { key: "customerJourney", label: "Customer Journey", value: brandResult.customerJourney, actionable: true },
      { key: "contentMix", label: "Content Mix", value: brandResult.contentMix, actionable: true },
    ].filter((section) => section.value !== undefined && section.value !== null && section.value !== "")
  : [];

const knownResultKeys = new Set([
  ...strategySections.map((section) => section.key),
  "marketingDashboard",
]);

const additionalStrategySections = brandResult
  ? Object.entries(brandResult)
      .filter(([key, value]) => !knownResultKeys.has(key) && value !== undefined && value !== null && value !== "")
      .map(([key, value]) => ({
        key,
        label: key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()),
        value,
      }))
  : [];

const allStrategySections = [...strategySections, ...additionalStrategySections];
const sectionText = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);

return (
  <main className="flex min-h-screen bg-slate-950 text-white">
    <Sidebar />
    <section className="min-w-0 flex-1">
      <Navbar />
      <div className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-red-500/[0.05] blur-3xl" />
        <div className="pointer-events-none absolute bottom-24 left-0 h-72 w-72 rounded-full bg-cyan-400/[0.025] blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <header className="relative mb-9 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M4 18V9m5 9V5m5 13v-7m5 7V3"/><path d="m3 8 6-4 5 5 6-7"/></svg>
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Growth Intelligence</span></div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Marketing Intelligence</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Engineer complete channel-ready marketing strategies, campaign systems, audience intelligence and scalable growth plans through one intelligent growth engine.</p>
              </div>
            </div>
            <button type="button" onClick={handleNewStrategy} className="flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-gradient-to-r from-red-500/15 to-cyan-400/[0.05] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/55 hover:shadow-[0_0_22px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 sm:w-auto"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M10 3v14M3 10h14"/><circle cx="10" cy="10" r="7.5"/></svg>New Strategy</button>
          </header>

          <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
            <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent"/>
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15"/>
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Marketing Generation Matrix</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Configure the growth brief</h2><p className="mt-1 text-xs leading-5 text-slate-500">Define the market, objective, strategic style and business context.</p></div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><path d="M3 16V9h4v7M8 16V5h4v11M13 16V2h4v14M2 16h16"/></svg></div>
            </div>

            <div className="relative mt-6 grid gap-5 md:grid-cols-2">
              <label className="block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Business Name</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Market / 01</span></span><input type="text" placeholder="Example: Buzypeezy" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
              <label className="group/industry block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Industry</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Sector / 02</span></span><span className="relative block"><select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="">Select Industry</option><option>AI & Technology</option><option>Digital Marketing</option><option>Healthcare</option><option>Finance</option><option>Education</option><option>Real Estate</option><option>E-commerce</option><option>Interior Design</option><option>Food & Beverage</option><option>Legal</option><option>Manufacturing</option><option>Other</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/industry:border-red-400/35 group-focus-within/industry:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              <label className="group/goal block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Marketing Goal</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Goal / 03</span></span><span className="relative block"><select value={marketingGoal} onChange={(e) => setMarketingGoal(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="">Select Marketing Goal</option><option>Generate Leads</option><option>Sell Products</option><option>Showcase Portfolio</option><option>Book Appointments</option><option>Build Brand Awareness</option><option>Provide Information</option><option>Grow Online Presence</option><option>Offer Online Services</option><option>Community & Membership</option><option>Other</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/goal:border-red-400/35 group-focus-within/goal:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              <label className="group/style block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Marketing Style</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Style / 04</span></span><span className="relative block"><select value={brandStyle} onChange={(e) => setBrandStyle(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Minimal</option><option>Modern</option><option>Corporate</option><option>Luxury</option><option>Creative</option><option>Dark</option><option>Light</option><option>Glassmorphism</option><option>Neumorphism</option><option>Futuristic</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/style:border-red-400/35 group-focus-within/style:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Business Description</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Context / 05</span></span><textarea rows={5} placeholder="Describe your business, products or services, target customers, marketing goals, and current challenges..." value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} className="min-h-40 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_24px_rgba(239,68,68,0.1)]"/></label>
            </div>

            <button type="button" onClick={handleGenerateBrand} disabled={loading} className={loading ? "relative mt-6 flex min-h-12 cursor-not-allowed items-center gap-3 rounded-xl border border-red-500/15 bg-slate-950/80 px-6 py-3 text-sm font-semibold text-slate-400" : "group/button relative mt-6 flex min-h-12 items-center gap-3 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"}>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300"/> : <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><path d="M3 15V9h4v6M8 15V5h4v10M13 15V2h4v13"/></svg>}{loading ? "Generating Growth Intelligence..." : "Generate Marketing Strategy"}{!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}</button>
            {loading && <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/10 bg-slate-950/55 p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.18em]"><span className="text-cyan-300">Growth synthesis active</span><span className="text-slate-600">Processing</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-300"/></div></div>}
          </section>

          {brandResult && (
            <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]"/>
              <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl"/>
              <div className="relative mb-6 flex flex-col gap-5 border-b border-white/[0.06] pb-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><path d="M4 18V9m5 9V5m5 13v-7m5 7V3"/></svg></div><div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Growth output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Generated Marketing Intelligence</h2></div></div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap"><button type="button" onClick={copyEntireBrand} className={copyButtonClass}>{copyIcon}Copy Entire Marketing Strategy</button><button type="button" onClick={downloadPDF} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)]"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download PDF</button><button type="button" onClick={saveProject} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M4 3.5h10l2 2v11H4zM7 3.5v5h6v-5M7 13h6"/></svg>Save Project</button><button type="button" onClick={() => window.location.href = projectId ? `/marketing-ai/projects?projectId=${encodeURIComponent(projectId)}` : "/marketing-ai/projects"} className={copyButtonClass}><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M3 5h5l1.5 2H17v9H3z"/></svg>Project History</button><button type="button" onClick={() => { if (!brandResult) { toast.error("Generate a marketing strategy first."); return; } window.location.href = projectId ? `/seo-ai?projectId=${encodeURIComponent(projectId)}` : "/seo-ai"; }} className={copyButtonClass}><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>Continue to SEO AI</button></div>
              </div>

              <div className="relative grid gap-5 md:grid-cols-2">
                {allStrategySections.map((section, index) => {
                  const text = sectionText(section.value);
                  const useFullWidthCard =
                    index === 0 ||
                    text.length > 700 ||
                    ["typography", "marketingScore", "growthRecommendations", "bestChannels", "campaignTimeline", "contentMix"].includes(section.key);
                  return (
                    <article key={section.key} className={useFullWidthCard ? moduleClass + " md:col-span-2" : moduleClass}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / {String(index + 1).padStart(2, "0")}</span><h3 className="mt-1 text-lg font-semibold text-white">{section.label}</h3></div>
                        <div className="flex flex-wrap gap-2">
                          {"actionable" in section && section.actionable === true && <><button type="button" onClick={() => regenerateSection(section.label)} className={copyButtonClass}><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M15.5 7A6 6 0 1 0 16 12"/><path d="M12.5 4.5H16V8"/></svg>Regenerate</button><button type="button" onClick={() => setEditingSection(section.label)} className="flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-100"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="m4 14.5-.5 2 2-.5L15 6.5 13.5 5zM12.5 6l1.5 1.5"/></svg>Edit with AI</button></>}
                          <button type="button" onClick={() => copyToClipboard(text, section.label)} className={copyButtonClass}>{copyIcon}Copy</button>
                        </div>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-[1.8] text-slate-300 sm:text-base">{text}</p>
                    </article>
                  );
                })}
              </div>

              {brandResult.marketingDashboard && (
                <section className="relative mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/60 p-5 sm:p-6">
                  <div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">PERFORMANCE SYSTEM</span><h3 className="mt-1 text-xl font-semibold text-white">Marketing Performance Overview</h3></div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpiCards.map((item, index) => <div key={item.title} className="rounded-xl border border-red-500/15 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><span className="font-mono text-[9px] text-red-300">KPI / {String(index + 1).padStart(2, "0")}</span><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"/></div><p className="mt-4 text-sm text-slate-400">{item.title}</p><p className="mt-2 text-3xl font-semibold text-white">{item.value}</p></div>)}
                  </div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.07] bg-slate-900/60 p-5"><h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Channel Performance</h4><div className="mt-5 space-y-5">{channelPerformance.map((item: { label: string; value: number }) => <div key={item.label}><div className="mb-2 flex justify-between text-sm text-slate-300"><span>{item.label}</span><span>{item.value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-cyan-300" style={{ width: Math.min(100, Math.max(0, item.value)) + "%" }}/></div></div>)}</div></div>
                    <div className="rounded-xl border border-white/[0.07] bg-slate-900/60 p-5"><h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Marketing Funnel</h4><div className="mt-5 space-y-5">{funnelStages.map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-sm text-slate-300"><span>{item.label}</span><span>{item.value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-cyan-300" style={{ width: item.value + "%" }}/></div></div>)}</div></div>
                  </div>
                </section>
              )}
            </section>
          )}

          {!brandResult && !loading && (
            <section className="relative mt-8 overflow-hidden rounded-[26px] border border-dashed border-red-500/20 bg-slate-900/45 p-8 text-center sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/[0.06] text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.1)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current" strokeWidth="1.5"><path d="M4 18V9m5 9V5m5 13v-7m5 7V3"/><path d="m3 8 6-4 5 5 6-7"/></svg></div>
              <div className="mt-5 flex items-center justify-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Awaiting growth brief</span></div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Your Marketing Strategy will appear here</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">Configure your business and generate a complete AI-powered campaign strategy, channel plan, audience analysis, performance system and scalable growth roadmap.</p>
            </section>
          )}
        </div>
      </div>
    </section>

    {editingSection && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
        <div className="relative w-full max-w-xl overflow-hidden rounded-[26px] border border-red-500/25 bg-slate-950 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.55),0_0_30px_rgba(239,68,68,0.1)]">
          <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent"/>
          <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Intelligence editor</p><h2 className="mt-2 text-2xl font-semibold text-white">Edit {editingSection}</h2><p className="mt-2 text-sm text-slate-400">Describe how you want this section changed.</p></div><button type="button" onClick={() => { setEditingSection(null); setEditInstruction(""); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:border-red-400/30 hover:text-white"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5"><path d="m5 5 10 10M15 5 5 15"/></svg><span className="sr-only">Close</span></button></div>
          <textarea value={editInstruction} onChange={(event) => setEditInstruction(event.target.value)} placeholder="Example: Make it more premium, concise, and focused on luxury clients." className="mt-6 min-h-36 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-900/80 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-red-400/50"/>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={isEditing} onClick={() => { setEditingSection(null); setEditInstruction(""); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button><button type="button" onClick={editWithAI} disabled={isEditing || !editInstruction.trim()} className="flex items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-red-300/55 disabled:cursor-not-allowed disabled:opacity-50">{isEditing && <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300"/>}{isEditing ? "Editing..." : "Apply AI Edit"}</button></div>
        </div>
      </div>
    )}
  </main>
);
}

export default function MarketingAIPage() {
  return <Suspense fallback={null}><MarketingAIPageContent /></Suspense>;
}
