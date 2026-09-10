 "use client";

import { Suspense, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import { downloadPaidBlob } from "@/app/lib/paid-download";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import WebsitePreview from "../components/WebsitePreview";
import WebsitePageManager from "../components/WebsitePageManager";
import type { WebsiteAiOutput, WebsiteEdits } from "../../lib/ai";
import auth from "../../lib/auth";
import { authenticatedFetch } from "../../lib/authenticated-fetch";
import { useProjectMemory } from "../../hooks/useProjectMemory";
import type { WebsiteMediaInput } from "@/app/lib/business-site-visuals";
import { adaptLegacyWebsiteToSiteDocument, buildWebsiteSiteDocumentWithTheme, validateWebsiteSiteDocument, type WebsiteSiteDocument } from "@/app/lib/website-site-document";
import { addEssentialWebsitePages, type VerifiedWebsiteService } from "@/app/lib/website-essential-pages";

type WebsiteDraftOutput = WebsiteAiOutput & { siteDocument?: WebsiteSiteDocument };

function legacyWebsiteOutput(result: WebsiteDraftOutput): WebsiteAiOutput {
  const { siteDocument: _siteDocument, ...legacy } = result;
  void _siteDocument;
  return legacy;
}

function withWebsiteTheme(document: WebsiteSiteDocument | null, template: string, colorPalette: string, typography: string) {
  return document ? validateWebsiteSiteDocument({ ...document, theme: { template, colorPalette, typography } }) : null;
}

function restoreWebsiteDraftOutput(value: unknown) {
  const savedResult =
    typeof value === "string"
      ? JSON.parse(value)
      : value;
  const restoredResult = savedResult as WebsiteDraftOutput;
  return {
    result: restoredResult,
    siteDocument: validateWebsiteSiteDocument(restoredResult.siteDocument),
  };
}

const WEBSITE_GOALS = [
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

const WEBSITE_TEMPLATES = ["Modern", "Luxury", "Corporate", "Creative", "Minimal", "Dark"] as const;
const WEBSITE_STYLE_OPTIONS = [
  { value: "Modern", label: "Clean and conversion-focused" },
  { value: "Luxury", label: "Refined editorial polish" },
  { value: "Minimal", label: "Quiet, spacious simplicity" },
  { value: "Creative", label: "Expressive and energetic" },
  { value: "Corporate", label: "Structured and trustworthy" },
  { value: "Dark", label: "Bold contrast and depth" },
] as const satisfies ReadonlyArray<{ value: (typeof WEBSITE_TEMPLATES)[number]; label: string }>;
const PALETTE_PRESETS = [
  {
    id: "forest-luxe",
    name: "Forest Luxe",
    label: "Premium green / cream",
    value: "#174A3A, #12372D, #789889, #F5F0E6, #C7A96B, #FFFDF8",
  },
  {
    id: "warm-minimal",
    name: "Warm Minimal",
    label: "Soft neutrals / clay warmth",
    value: "#463F3A, #BCB8B1, #F4F3EE, #E0AFA0, #8A817C, #FFFFFF",
  },
  {
    id: "modern-teal",
    name: "Modern Teal",
    label: "Fresh teal / airy neutrals",
    value: "#0F5257, #00A4A6, #9AA8B2, #F4F8F8, #D8E2E2, #FFFFFF",
  },
  {
    id: "dark-premium",
    name: "Dark Premium",
    label: "Charcoal / gold contrast",
    value: "#1F2933, #374151, #A67C52, #F5F0E6, #111827, #FFFFFF",
  },
] as const;
const DEFAULT_PALETTE_PRESET = "warm-minimal";
const FORBIDDEN_EDIT_CONTENT = /<\/?[a-z][^>]*>|(?:javascript|vbscript|data|file)\s*:/i;
const RESERVED_WEBSITE_SLUGS = new Set([
  "admin", "api", "assets", "billing", "boss", "contact-support", "dashboard", "favicon",
  "forgot-password", "help", "login", "logout", "onboarding", "privacy", "published-sites",
  "refund-cancellation", "robots", "signup", "sitemap", "support", "terms", "verify-email", "www", "_next",
]);

function extractPaletteColors(value: string) {
  return [...new Set(value.match(/#[0-9A-Fa-f]{6}\b/g) ?? [])].slice(0, 6).map((hex) => hex.toUpperCase());
}

function normalizePaletteValue(value: string) {
  return extractPaletteColors(value).join(",");
}

function paletteSwatches(value: string, fallbackValue = "") {
  const colors = extractPaletteColors(value);
  if (colors.length >= 5 || !fallbackValue) return colors;
  return [...new Set([...colors, ...extractPaletteColors(fallbackValue)])].slice(0, 6);
}

function uniqueWebsiteMedia(items: readonly (string | null | undefined)[]) {
  return [...new Set(items.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))];
}

function isValidWebsiteSlug(value: string) {
  return value.length >= 3 && value.length <= 63 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !RESERVED_WEBSITE_SLUGS.has(value);
}

function isValidCustomDomain(value: string) {
  if (!value || value.length > 253 || value.includes("://") || /[\s/?#]/.test(value)) return false;
  const labels = value.toLowerCase().replace(/\.$/, "").split(".");
  return labels.length >= 2 && labels.every((label) =>
    label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  ) && /^[a-z]{2,63}$/.test(labels.at(-1) || "");
}

function initialWebsiteEdits(
  companyName: string,
  industry: string,
  template: string,
  result: WebsiteAiOutput,
  primaryLanguage = "en"
): WebsiteEdits {
  return {
    companyName: companyName || "Your Business",
    heroHeadline: result.websiteGoal || companyName || industry,
    heroDescription: result.websiteOverview,
    aboutText: result.designRecommendations,
    servicesText: result.websiteFeatures,
    phone: "",
    email: "",
    address: "",
    whatsapp: "",
    primaryCtaLabel:
  ({
    en: "Get Started",
    es: "Empezar",
    fr: "Commencer",
    de: "Starten",
    pt: "Começar",
    ar: "ابدأ",
    hi: "शुरू करें",
    ja: "始める",
    ko: "시작하기",
    zh: "开始",
    kn: "ಪ್ರಾರಂಭಿಸಿ",
    ta: "தொடங்குங்கள்",
    te: "ప్రారంభించండి",
    ml: "തുടങ്ങുക",
  } as Record<string, string>)[primaryLanguage] || "Get Started",
    primaryCtaLink: "#contact",
    template: WEBSITE_TEMPLATES.includes(template as (typeof WEBSITE_TEMPLATES)[number]) ? template : "Modern",
  };
}

function WebsiteAIPageContent() {
    const { project, projectId } = useProjectMemory();
    const projectPrimaryLanguage =
  (project as { primaryLanguage?: string } | null)?.primaryLanguage ?? "en";
    const [companyName, setCompanyName] = useState("");
const [industry, setIndustry] = useState("");
const [targetAudience, setTargetAudience] = useState("");
const [brandStyle, setBrandStyle] = useState("Minimal");
const [brandDescription, setBrandDescription] = useState("");
const [loading, setLoading] = useState(false);
const [applyingIntelligence, setApplyingIntelligence] = useState(false);
const [intelligenceUpdate, setIntelligenceUpdate] = useState<{ changed: boolean; modules: string[] } | null>(null);
const [brandResult, setBrandResult] = useState<WebsiteDraftOutput | null>(null);
const [siteDocument, setSiteDocument] = useState<WebsiteSiteDocument | null>(null);
const [selectedPagePath, setSelectedPagePath] = useState("/");
const [savingPages, setSavingPages] = useState(false);
const [websiteEdits, setWebsiteEdits] = useState<WebsiteEdits | null>(null);
const [draftEdits, setDraftEdits] = useState<WebsiteEdits | null>(null);
const [editingWebsite, setEditingWebsite] = useState(false);
const [savingEdits, setSavingEdits] = useState(false);
const [publication, setPublication] = useState<{ status: "unpublished" | "active" | "inactive"; slug?: string; currentVersion?: number; internalUrl?: string; futureUrl?: string; source?: "website" | "business" } | null>(null);
const [publicationSlug, setPublicationSlug] = useState("");
const [publicationLoading, setPublicationLoading] = useState(false);
const [showGoLiveReview, setShowGoLiveReview] = useState(false);
const [publishingOption, setPublishingOption] = useState<"buzypeezy" | "custom">("buzypeezy");
const [customDomain, setCustomDomain] = useState("");
const [showOwnedDomainSetup, setShowOwnedDomainSetup] = useState(false);
const [savedBusinessDescription, setSavedBusinessDescription] = useState("");
const [websiteMedia, setWebsiteMedia] = useState<WebsiteMediaInput>({});
const [savedSecondaryPhoto, setSavedSecondaryPhoto] = useState("");
const [draftPalette, setDraftPalette] = useState("");
const [draftTypography, setDraftTypography] = useState("");
const [savedBrandingPalette, setSavedBrandingPalette] = useState("");
const [showCustomPaletteInput, setShowCustomPaletteInput] = useState(false);
const [uploadingPhoto, setUploadingPhoto] = useState<"hero" | "secondary" | null>(null);
const heroPhotoInput = useRef<HTMLInputElement>(null);
const projectPhotoInput = useRef<HTMLInputElement>(null);
const [verifiedServices, setVerifiedServices] = useState<VerifiedWebsiteService[]>([]);
const [previewMode, setPreviewMode] = useState<
  "desktop" | "tablet" | "mobile"
>("desktop");
useEffect(() => {
  let active = true;

  queueMicrotask(() => {
    if (!active) return;

    const activeProject = project?.id === projectId ? project : null;
    const projectGoal = activeProject?.goal || "";

    setBrandResult(null);
    setSiteDocument(null);
    setSelectedPagePath("/");
    setVerifiedServices([]);
    setWebsiteEdits(null);
    setDraftEdits(null);
    setEditingWebsite(false);
    setSavedSecondaryPhoto("");
    setSavedBrandingPalette("");
    setShowCustomPaletteInput(false);
    setShowGoLiveReview(false);
    setSavedBusinessDescription("");
    setCompanyName(activeProject?.companyName || "");
    setIndustry(activeProject?.industry || "");
    setBrandStyle(activeProject?.brandStyle || "Minimal");
    setTargetAudience(
      WEBSITE_GOALS.includes(projectGoal as (typeof WEBSITE_GOALS)[number])
        ? projectGoal
        : "",
    );
    setBrandDescription(
    activeProject?.businessDescription ||
    activeProject?.originalBrief ||
    ""
);
  });

  return () => {
    active = false;
  };
}, [project, projectId]);
useEffect(() => {
  if (!projectId) return;
  let active = true;
  const loadWebsiteMedia = async () => {
    try {
      const [response, imageResponse, serviceResponse] = await Promise.all([
        authenticatedFetch(`/api/business-preview?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
        authenticatedFetch(`/api/business-preview/images?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
        authenticatedFetch(`/api/store/products?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
      ]);
      const [data, imageData, serviceData] = await Promise.all([response.json(), imageResponse.json(), serviceResponse.json()]);
      if (!response.ok) throw new Error(data.error || "Unable to load project media.");
      if (!imageResponse.ok) throw new Error(imageData.error || "Unable to load saved website photos.");
      if (!active) return;
      setSavedBusinessDescription(typeof data.preview?.business?.description === "string" ? data.preview.business.description : "");
      setSavedBrandingPalette(typeof data.preview?.brand?.colourDirection === "string" ? data.preview.brand.colourDirection : "");
      const services = serviceResponse.ok && Array.isArray(serviceData.products) ? serviceData.products.filter((item: Record<string, unknown>) => item.kind === "service" && item.isActive === true).map((item: Record<string, unknown>) => ({
        id: String(item.id || ""), name: String(item.name || ""), slug: typeof item.slug === "string" ? item.slug : null,
        description: typeof item.description === "string" ? item.description : null, imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
      })).filter((item: VerifiedWebsiteService) => item.id && item.name) : [];
      const serviceImages = uniqueWebsiteMedia(services.map((service: VerifiedWebsiteService) => service.imageUrl));
      const heroImage = typeof imageData.heroImage === "string" ? imageData.heroImage : null;
      const secondaryImage = typeof imageData.secondaryImage === "string" ? imageData.secondaryImage : null;
      setVerifiedServices(services);
      setSavedSecondaryPhoto(secondaryImage || "");
      setWebsiteMedia({
        hero: heroImage,
        work: uniqueWebsiteMedia([secondaryImage, ...serviceImages]),
        services: serviceImages,
      });
    } catch {
      if (active) { setWebsiteMedia({}); setVerifiedServices([]); setSavedSecondaryPhoto(""); setSavedBrandingPalette(""); setSavedBusinessDescription(""); }
    }
  };
  loadWebsiteMedia();
  return () => { active = false; };
}, [projectId]);
useEffect(() => {
  if (!projectId || !project?.userId) return;

  let active = true;

  const loadSavedWebsiteOutput = async () => {
    try {
      const response = await authenticatedFetch(
        `/api/project-outputs?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(project.userId)}&module=website`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load Website AI output");
      }

      if (!active || !data.output?.result) return;

      const savedResult =
        typeof data.output.result === "string"
          ? JSON.parse(data.output.result)
          : data.output.result;

      const restoredResult = savedResult as WebsiteDraftOutput;
      const restoredSiteDocument = validateWebsiteSiteDocument(restoredResult.siteDocument);
      setBrandResult(restoredResult);
      setSiteDocument(restoredSiteDocument);
      setSelectedPagePath("/");
      setWebsiteEdits(restoredResult.websiteEdits || initialWebsiteEdits(
        project?.companyName || "",
        project?.industry || "",
        project?.brandStyle || "Modern",
        restoredResult,
        projectPrimaryLanguage,
      ));
    } catch (error) {
      console.error("Failed to restore Website AI output:", error);
    }
  };

  loadSavedWebsiteOutput();

  return () => {
    active = false;
  };
}, [projectId, project?.brandStyle, project?.companyName, project?.industry, project?.userId, projectPrimaryLanguage]);
useEffect(() => {
  if (!projectId) return;
  let active = true;
  const loadPublication = async () => {
    try {
      const response = await authenticatedFetch(`/api/website-publications?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load publication status.");
      if (!active) return;
      setPublication(data.publication);
      setPublicationSlug(data.publication.slug || data.suggestedSlug || "");
    } catch {
      if (active) setPublication({ status: "unpublished" });
    }
  };
  loadPublication();
  return () => { active = false; };
}, [projectId]);
const updatePublication = async (method: "POST" | "PATCH" | "DELETE") => {
  if (!projectId || !brandResult) return;
  setPublicationLoading(true);
  try {
    const usesBusinessPublication = publication?.source === "business";
    const endpoint = usesBusinessPublication ? "/api/business-publications" : "/api/website-publications";
    const requestMethod = usesBusinessPublication && method === "PATCH" ? "POST" : method;
    const body = usesBusinessPublication
      ? { projectId, ...(method === "PATCH" && { action: "republish" }) }
      : method === "POST"
      ? { projectId, slug: publicationSlug, template: websiteEdits?.template || brandStyle }
      : { projectId };
    const response = await authenticatedFetch(endpoint, {
      method: requestMethod,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Publication request failed.");
    setPublication(data.publication);
    setPublicationSlug(data.publication.slug || publicationSlug);
    setShowGoLiveReview(false);
    toast.success(method === "DELETE" ? "Website unpublished." : method === "PATCH" ? "Website republished." : "Website is live.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Publication request failed.");
  } finally {
    setPublicationLoading(false);
  }
};
const isStrongestInteriorsContext = [
  project?.companyName,
  project?.name,
  companyName,
  websiteEdits?.companyName,
].some((value) => /strongest\s+interiors/i.test(value || ""));
const fallbackPaletteValue = (isStrongestInteriorsContext
  ? PALETTE_PRESETS.find((preset) => preset.id === "forest-luxe")
  : PALETTE_PRESETS.find((preset) => preset.id === DEFAULT_PALETTE_PRESET)
)?.value || PALETTE_PRESETS[0].value;
const brandingPaletteValue = savedBrandingPalette || siteDocument?.theme.colorPalette || brandResult?.colourScheme || "";
const hasSavedBrandingPalette = extractPaletteColors(savedBrandingPalette).length > 0;
const paletteOptions = [
  ...PALETTE_PRESETS,
  {
    id: "branding-ai",
    name: "Branding AI Palette",
    label: hasSavedBrandingPalette
      ? "Saved Branding / project colors"
      : normalizePaletteValue(brandingPaletteValue)
      ? "Current saved website palette"
      : "Default starting palette",
    value: normalizePaletteValue(brandingPaletteValue) ? brandingPaletteValue : fallbackPaletteValue,
  },
] as const;
const paletteMatchesOption = (value: string) => {
  const normalized = normalizePaletteValue(value);
  return normalized
    ? paletteOptions.some((palette) => normalizePaletteValue(palette.value) === normalized)
    : false;
};
const beginEditingWebsite = () => {
  if (!brandResult) return;
  const nextPalette = siteDocument?.theme.colorPalette || brandResult.colourScheme || fallbackPaletteValue;
  setDraftEdits(
  websiteEdits ||
    initialWebsiteEdits(
      companyName,
      industry,
      brandStyle,
      brandResult,
      projectPrimaryLanguage
    )
);
  setDraftPalette(nextPalette);
  setDraftTypography(siteDocument?.theme.typography || brandResult.typography || "");
  setShowCustomPaletteInput(!paletteMatchesOption(nextPalette));
  setEditingWebsite(true);
  setShowGoLiveReview(false);
};
const cancelEditingWebsite = () => {
  setDraftEdits(null);
  setDraftPalette("");
  setDraftTypography("");
  setShowCustomPaletteInput(false);
  setEditingWebsite(false);
};
const updateDraftEdit = (field: keyof WebsiteEdits, value: string) => {
  setDraftEdits((current) => current ? { ...current, [field]: value } : current);
};
const saveWebsiteEdits = async () => {
  if (!projectId || !brandResult || !draftEdits || savingEdits) return;
  const values = Object.values(draftEdits);
  if ([draftEdits.companyName, draftEdits.heroHeadline, draftEdits.heroDescription, draftEdits.aboutText, draftEdits.servicesText, draftEdits.primaryCtaLabel, draftEdits.primaryCtaLink].some((value) => !value.trim())) {
    toast.error("Complete all required website fields.");
    return;
  }
  if (values.some((value) => value.length > 4_000 || FORBIDDEN_EDIT_CONTENT.test(value)) ||
      !/^(?:https?:\/\/|mailto:|tel:|\/|#)[^\s]*$/i.test(draftEdits.primaryCtaLink)) {
    toast.error("Use plain text and a safe CTA link.");
    return;
  }
  setSavingEdits(true);
  try {
    const nextDocument = buildWebsiteSiteDocumentWithTheme({
      siteDocument,
      companyName: draftEdits.companyName || companyName || "Your Business",
      template: draftEdits.template,
      colorPalette: draftPalette,
      typography: draftTypography,
      websiteOutput: legacyWebsiteOutput(brandResult),
      websiteEdits: draftEdits,
    });
    if (!nextDocument) throw new Error("The selected website theme is not valid.");
    const updatedResult: WebsiteDraftOutput = {
      ...brandResult,
      colourScheme: draftPalette,
      typography: draftTypography,
      websiteEdits: draftEdits,
      siteDocument: nextDocument,
    };
    const response = await authenticatedFetch("/api/project-outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        module: "website",
        result: JSON.stringify(updatedResult),
      }),
    });
    const data = await response.json() as { output?: { result?: unknown }; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to save website changes.");
    const restored = data.output?.result ? restoreWebsiteDraftOutput(data.output.result) : null;
    setBrandResult(restored?.result || updatedResult);
    setSiteDocument(restored?.siteDocument || nextDocument);
    setWebsiteEdits(restored?.result.websiteEdits || draftEdits);
    setEditingWebsite(false);
    setDraftEdits(null);
    setShowGoLiveReview(true);
    toast.success("Website changes saved.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to save website changes.");
  } finally {
    setSavingEdits(false);
  }
};
const applyLatestBusinessIntelligence = async () => {
  if (!projectId || !brandResult || applyingIntelligence) return;
  setIntelligenceUpdate(null);
  setApplyingIntelligence(true);
  try {
    const response = await authenticatedFetch("/api/website-ai/apply-intelligence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await response.json() as { output?: WebsiteDraftOutput; changed?: boolean; modules?: string[]; error?: string };
    if (!response.ok || !data.output) throw new Error(data.error || "Unable to update the website draft.");
    const update = { changed: data.changed === true, modules: Array.isArray(data.modules) ? data.modules : [] };
    setIntelligenceUpdate(update);
    if (update.changed) {
      setBrandResult(data.output);
      setSiteDocument(validateWebsiteSiteDocument(data.output.siteDocument));
      setSelectedPagePath("/");
      setWebsiteEdits(data.output.websiteEdits || null);
      setDraftEdits(null);
      setEditingWebsite(false);
      setShowGoLiveReview(false);
      setPreviewMode("desktop");
      toast.success("Your website draft has been updated according to your latest business changes.");
      queueMicrotask(() => document.querySelector(".easy-website-preview")?.scrollIntoView({ behavior: "smooth" }));
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to update the website draft.");
  } finally {
    setApplyingIntelligence(false);
  }
};
const saveSiteDocument = async (nextDocument: WebsiteSiteDocument) => {
  if (!projectId || !brandResult || savingPages) return false;
  const validated = validateWebsiteSiteDocument(nextDocument);
  if (!validated) { toast.error("That page change is not valid. Check for duplicate or reserved paths."); return false; }
  setSavingPages(true);
  try {
    const nextResult: WebsiteDraftOutput = { ...brandResult, siteDocument: validated };
    const response = await authenticatedFetch("/api/project-outputs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, module: "website", result: JSON.stringify(nextResult) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save page changes.");
    setBrandResult(nextResult);
    setSiteDocument(validated);
    setShowGoLiveReview(false);
    toast.success("Draft pages saved.");
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to save page changes.");
    return false;
  } finally { setSavingPages(false); }
};
const initializeMultiPageDraft = async () => {
  if (!brandResult) return;
  const document = adaptLegacyWebsiteToSiteDocument({ companyName: companyName || "Your Business", template: websiteEdits?.template || brandStyle, websiteOutput: brandResult, websiteEdits: websiteEdits || undefined });
  await saveSiteDocument(document);
};
const addEssentialBusinessPages = async () => {
  if (!siteDocument) return;
  const work = websiteMedia.work;
  const projectMedia = (Array.isArray(work) ? work : [work]).filter((value): value is string => typeof value === "string" && Boolean(value));
  const next = addEssentialWebsitePages(siteDocument, { projectDescription: project?.businessDescription || null, services: verifiedServices, projectMedia });
  if (!next) { toast.error("Essential pages could not be created safely."); return; }
  if (JSON.stringify(next) === JSON.stringify(siteDocument)) { toast.success("Essential business pages are already set up."); return; }
  await saveSiteDocument(next);
};
const updateWebsitePhoto = async (slot: "hero" | "secondary", file?: File) => {
  if (!projectId || uploadingPhoto) return;
  if (file && file.size > 4 * 1024 * 1024) { toast.error("That photo is too large. Use an image under 4 MB."); return; }
  setUploadingPhoto(slot);
  try {
    const response = file ? await (() => { const body = new FormData(); body.append("projectId", projectId); body.append("slot", slot); body.append("image", file); return authenticatedFetch("/api/business-preview/images", { method: "POST", body }); })()
      : await authenticatedFetch("/api/business-preview/images", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, slot }) });
    const data = await response.json() as { heroImage?: string | null; secondaryImage?: string | null; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to update that photo.");
    setSavedSecondaryPhoto(data.secondaryImage || "");
    setWebsiteMedia((current) => {
      const serviceImages = uniqueWebsiteMedia(
        Array.isArray(current.services) ? current.services : current.services ? [current.services] : [],
      );
      return {
        ...current,
        hero: data.heroImage || null,
        work: uniqueWebsiteMedia([data.secondaryImage || null, ...serviceImages]),
        services: serviceImages,
      };
    });
    setShowGoLiveReview(false);
    toast.success(file ? "Photo saved to the website draft." : "Photo removed from the website draft.");
  } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update that photo."); }
  finally {
    setUploadingPhoto(null);
    const input = slot === "hero" ? heroPhotoInput.current : projectPhotoInput.current;
    if (input) input.value = "";
  }
};
const activeWebsiteEdits = editingWebsite ? draftEdits : websiteEdits;
const activeSiteDocument = siteDocument && editingWebsite && draftEdits
  ? withWebsiteTheme(siteDocument, draftEdits.template, draftPalette, draftTypography) || siteDocument
  : siteDocument;
const selectedDraftPalette = normalizePaletteValue(draftPalette);
const usingCustomDraftPalette = Boolean(selectedDraftPalette) && !paletteMatchesOption(draftPalette);
const publicationSlugIsValid = isValidWebsiteSlug(publicationSlug);
const customDomainIsValid = isValidCustomDomain(customDomain.trim().toLowerCase());
const colors =
  brandResult?.colourScheme?.match(/#[0-9A-Fa-f]{6}/g) || [];
const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied!`);
};
const copyEntireBrand = () => {
  if (!brandResult) return;

  const content = `
Website Overview:
${brandResult.websiteOverview}

Website Goal:
${brandResult.websiteGoal}

Brand Story:
${brandResult.recommendedPages}

Mission:
${brandResult.siteStructure}

Website Features:
${brandResult.websiteFeatures}

Design Recommendations:
${brandResult.designRecommendations}

Colour Scheme:
${brandResult.colourScheme}

Typography:
${brandResult.typography}

Logo Concept:
${brandResult.recommendedTechStack}

SEO Recommendations:
${brandResult.seoRecommendations}
`;

  navigator.clipboard.writeText(content);
  toast.success("Website Plan copied!");
};
const downloadPDF = async () => {
  if (!brandResult) return;

  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("Website Strategy Report", 20, 20);

  let y = 35;

  const addSection = (title: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(title, 20, y);

    y += 7;

    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(value || "", 170);
    doc.text(lines, 20, y);

    y += lines.length * 7 + 8;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  };
 

  addSection("Website Overview", brandResult.websiteOverview);
  addSection("Website Goal", brandResult.websiteGoal);
  addSection("Recommended Pages", brandResult.recommendedPages);
  addSection("Site Structure", brandResult.siteStructure);
  addSection("Website Features", brandResult.websiteFeatures);
  addSection("Design Recommendations", brandResult.designRecommendations);
  addSection("Colour Scheme", brandResult.colourScheme);
  addSection("Typography", brandResult.typography);
  addSection("Recommended Tech Stack", brandResult.recommendedTechStack);
  addSection("SEO Recommendations", brandResult.seoRecommendations);

  if (await downloadPaidBlob(doc.output("blob"), `${companyName}-Website-Strategy.pdf`)) toast.success("PDF downloaded!");
};

const saveProject = async () => {
  if (!brandResult) {
    toast.error("Generate a website first.");
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    toast.error("Please log in first.");
    return;
  }

  try {
    const response = await authenticatedFetch("/api/projects", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    projectId,
    companyName,
    industry,
    goal: targetAudience,
    brandStyle,
    brandDescription,
    result: JSON.stringify(legacyWebsiteOutput(brandResult)),
  }),
});

    if (!response.ok) {
      throw new Error("Failed to save project");
    }

    const outputResponse = await authenticatedFetch("/api/project-outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, module: "website", result: JSON.stringify(brandResult) }),
    });
    if (!outputResponse.ok) throw new Error("Failed to save website draft");

    toast.success("Project saved successfully!");
  } catch (error) {
    console.error("Website project save error:", error);
    toast.error("Failed to save project");
  }
};
const handleGenerateBrand = async () => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    toast.error("Please log in first.");
    return;
  }

  if (!projectId) {
    toast.error("Please open a project before generating Website intelligence.");
    return;
  }

  if (
  !companyName ||
  !industry ||
  !targetAudience ||
  !brandDescription
) {
  toast.error("Please fill in all required fields.");
  return;
}
const briefSaveResponse = await authenticatedFetch("/api/projects", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    projectId,
    companyName,
    industry,
    goal: targetAudience,
    brandStyle,
    brandDescription,
  }),
});

if (!briefSaveResponse.ok) {
  toast.error("Unable to save website details.");
  return;
}
setLoading(true);
try {
  const response = await authenticatedFetch(
    "/api/website-ai",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await currentUser.getIdToken()}`,
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

const responseText = await response.text();

if (!responseText) {
  throw new Error("API returned an empty response");
}

const data: { output: WebsiteAiOutput } = JSON.parse(responseText);

console.log("Response:", data);
const parsed = data.output;

console.log("Parsed:", parsed);
setBrandResult(parsed);
setSiteDocument(null);
setSelectedPagePath("/");
setWebsiteEdits(
  initialWebsiteEdits(
    companyName,
    industry,
    brandStyle,
    parsed,
    projectPrimaryLanguage
  )
);
setDraftEdits(null);
setEditingWebsite(false);

if (projectId) {
  const saveOutputResponse = await authenticatedFetch("/api/project-outputs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      module: "website",
      result: JSON.stringify(parsed),
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save Website AI output");
  }
}
} catch (error) {
  const message =
    error instanceof Error ? error.message : String(error);

  console.error("FULL ERROR:", error);
  toast.error(message);
}
finally {
  setLoading(false);
}
};
const handleNewWebsite = () => {
  setCompanyName("");
  setIndustry("");
  setTargetAudience("");
  setBrandStyle("Minimal");
  setBrandDescription("");
  setBrandResult(null);
  setWebsiteEdits(null);
  setDraftEdits(null);
  setEditingWebsite(false);
  setShowGoLiveReview(false);
  setPreviewMode("desktop");
};

const copyIcon = <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>;
const copyButtonClass = "flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50";
const moduleClass = "group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/65 p-5 transition-all hover:border-red-400/30 hover:shadow-[0_0_24px_rgba(239,68,68,0.07)] sm:p-6";
const websiteSections = brandResult
  ? [
      { label: "Website Overview", code: "STRATEGY", value: brandResult.websiteOverview },
      { label: "Website Goal", code: "OBJECTIVE", value: brandResult.websiteGoal },
      { label: "Recommended Pages", code: "SITEMAP", value: brandResult.recommendedPages },
      { label: "Site Structure", code: "ARCHITECTURE", value: brandResult.siteStructure },
      { label: "Website Features", code: "FUNCTIONS", value: brandResult.websiteFeatures },
      { label: "Design Recommendations", code: "VISUAL SYSTEM", value: brandResult.designRecommendations },
      { label: "Colour Scheme", code: "COLOUR", value: brandResult.colourScheme },
      { label: "Typography", code: "TYPE SYSTEM", value: brandResult.typography },
      { label: "Recommended Tech Stack", code: "TECHNOLOGY", value: brandResult.recommendedTechStack },
      { label: "SEO Recommendations", code: "DISCOVERY", value: brandResult.seoRecommendations },
    ]
  : [];

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
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 6h.01M10 6h.01M7 12h5M7 16h10"/></svg>
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Web Intelligence</span></div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Website Intelligence</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Engineer complete conversion-focused websites, architecture, content systems and responsive digital experiences through one intelligent web engine.</p>
              </div>
            </div>
            <button type="button" onClick={handleNewWebsite} className="flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-gradient-to-r from-red-500/15 to-cyan-400/[0.05] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/55 hover:shadow-[0_0_22px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 sm:w-auto"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M10 3v14M3 10h14"/><circle cx="10" cy="10" r="7.5"/></svg>New Website</button>
          </header>

          <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
            <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent"/>
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15"/>
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Website Generation Matrix</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Configure the website brief</h2><p className="mt-1 text-xs leading-5 text-slate-500">Define business context, website objective, visual system and functional requirements.</p></div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M3 8h14M6 6h.01M9 6h.01"/></svg></div>
            </div>

            <div className="relative mt-6 grid gap-5 md:grid-cols-2">
              <label className="block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Business Name</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Identity / 01</span></span><input type="text" placeholder="Example: Buzypeezy" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
              <label className="group/industry block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Industry</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Sector / 02</span></span><span className="relative block"><select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="">Select Industry</option><option>AI & Technology</option><option>Digital Marketing</option><option>Healthcare</option><option>Finance</option><option>Education</option><option>Real Estate</option><option>E-commerce</option><option>Interior Design</option><option>Food & Beverage</option><option>Legal</option><option>Manufacturing</option><option>Other</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/industry:border-red-400/35 group-focus-within/industry:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              <label className="group/goal block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Website Goal</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Objective / 03</span></span><span className="relative block"><select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="">Select Website Goal</option><option>Generate Leads</option><option>Sell Products</option><option>Showcase Portfolio</option><option>Book Appointments</option><option>Build Brand Awareness</option><option>Provide Information</option><option>Grow Online Presence</option><option>Offer Online Services</option><option>Community & Membership</option><option>Other</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/goal:border-red-400/35 group-focus-within/goal:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              <div className="block md:col-span-2">
                <span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Website Style</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Aesthetic / 04</span></span>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {WEBSITE_STYLE_OPTIONS.map((option) => {
                    const selected = brandStyle === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setBrandStyle(option.value)}
                        className={selected
                          ? "rounded-2xl border border-red-300/60 bg-red-500/15 p-4 text-left shadow-[0_0_24px_rgba(239,68,68,0.14)]"
                          : "rounded-2xl border border-white/[0.08] bg-slate-950/80 p-4 text-left transition hover:border-red-500/25 hover:bg-slate-900/80"}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span>
                            <span className="block text-sm font-semibold text-white">{option.value}</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-400">{option.label}</span>
                          </span>
                          <span className={selected ? "flex h-6 w-6 items-center justify-center rounded-full border border-red-300/60 bg-red-500/20 text-red-100" : "flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-transparent"}>
                            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2">
                              <path d="m3.5 8.5 3 3 6-7" />
                            </svg>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Website Requirements</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Requirements / 05</span></span><textarea rows={5} placeholder="Describe your website, required pages, features, design preferences, and any special requirements..." value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} className="min-h-40 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_24px_rgba(239,68,68,0.1)]"/></label>
            </div>

            <button type="button" onClick={handleGenerateBrand} disabled={loading} className={loading ? "relative mt-6 flex min-h-12 cursor-not-allowed items-center gap-3 rounded-xl border border-red-500/15 bg-slate-950/80 px-6 py-3 text-sm font-semibold text-slate-400" : "group/button relative mt-6 flex min-h-12 items-center gap-3 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"}>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300"/> : <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M3 8h14M6 6h.01M9 6h.01"/></svg>}{loading ? "Generating Website Intelligence..." : "Generate Website Intelligence"}{!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}</button>
            {loading && <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/10 bg-slate-950/55 p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.18em]"><span className="text-cyan-300">Web synthesis active</span><span className="text-slate-600">Processing</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-300"/></div></div>}
          </section>

          {brandResult && (
            <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]"/>
              <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl"/>
              <div className="relative mb-6 flex flex-col gap-5 border-b border-white/[0.06] pb-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 12h5M7 16h10"/></svg></div><div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Web output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Generated Website Intelligence</h2></div></div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                  <button type="button" onClick={copyEntireBrand} className={copyButtonClass}>{copyIcon}Copy Entire Website Plan</button>
                  <button type="button" onClick={downloadPDF} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)]"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download PDF</button>
                  <button type="button" onClick={saveProject} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M4 3.5h10l2 2v11H4zM7 3.5v5h6v-5M7 13h6"/></svg>Save Project</button>
                  <button type="button" onClick={applyLatestBusinessIntelligence} disabled={applyingIntelligence} className={copyButtonClass}>{applyingIntelligence ? "Updating Website…" : "Apply latest business intelligence"}</button>
                  <button type="button" onClick={handleGenerateBrand} disabled={loading} className={copyButtonClass}><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M15.5 7A6 6 0 1 0 16 12"/><path d="M12.5 4.5H16V8"/></svg>Regenerate</button>
                  <button type="button" onClick={() => { if (!brandResult) { toast.error("Generate or open a website project first."); return; } window.location.href = projectId ? `/marketing-ai?projectId=${encodeURIComponent(projectId)}` : "/marketing-ai"; }} className={copyButtonClass}><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>Continue to Marketing AI</button>
                </div>
              </div>

              <div className="relative grid gap-5 md:grid-cols-2">
                {websiteSections.map((section, index) => (
                  <article key={section.label} className={index === 0 || [1, 2, 3, 4, 5, 8, 9].includes(index) ? moduleClass + " md:col-span-2" : moduleClass}>
                    <div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / {String(index + 1).padStart(2, "0")}</span><div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold text-white">{section.label}</h3><span className="rounded-md border border-cyan-400/15 bg-cyan-400/[0.04] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-300">{section.code}</span></div></div><button type="button" onClick={() => copyToClipboard(section.value, section.label)} className={copyButtonClass}>{copyIcon}Copy</button></div>
                    <p className={index === 0 ? "mt-4 whitespace-pre-wrap break-words text-xl font-semibold leading-[1.6] text-slate-100 sm:text-2xl" : "mt-4 whitespace-pre-wrap break-words text-[15px] leading-[1.8] text-slate-300 sm:text-base"}>{section.value}</p>
                    {section.label === "Colour Scheme" && <div className="mt-5 flex flex-wrap gap-4">{colors.map((color: string, colorIndex: number) => <div key={color + "-" + colorIndex} className="rounded-xl border border-white/[0.07] bg-slate-900/70 p-2 text-center"><div className="h-12 w-12 rounded-lg border border-white/20 shadow-[0_0_16px_rgba(255,255,255,0.06)]" style={{ backgroundColor: color }}/><span className="mt-2 block font-mono text-[9px] text-slate-400">{color}</span></div>)}</div>}
                  </article>
                ))}
              </div>

              {intelligenceUpdate && (
                <section className="relative mt-7 rounded-[24px] border border-cyan-400/25 bg-cyan-400/[0.06] p-5 text-cyan-50 sm:p-6" aria-live="polite">
                  <h3 className="text-lg font-semibold">
                    {intelligenceUpdate.changed
                      ? "Your website draft has been updated according to your latest business changes."
                      : "Your website is already up to date with your latest business settings."}
                  </h3>
                  {intelligenceUpdate.changed && (
                    <>
                      <p className="mt-3 text-sm font-semibold text-cyan-200">What changed</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {intelligenceUpdate.modules.map((module) => <li key={module} className="rounded-full border border-cyan-300/25 px-3 py-1 text-xs">{module}</li>)}
                      </ul>
                      <p className="mt-4 text-sm text-slate-300">Preview your updated website before publishing.</p>
                    </>
                  )}
                </section>
              )}

              <section className="relative mt-7 overflow-hidden rounded-[24px] border border-red-500/20 bg-slate-950/60 p-4 shadow-[0_0_30px_rgba(239,68,68,0.06)] sm:p-6">
                <div className="mb-5 flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Web preview / active</span></div><h3 className="mt-2 text-xl font-semibold text-white">Live Website Preview</h3><p className="mt-1 text-xs leading-5 text-slate-500">Inspect the generated experience across responsive viewport systems.</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={beginEditingWebsite} disabled={editingWebsite} className={copyButtonClass}>Edit Website</button>
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.07] bg-slate-900/70 p-1.5">
                      {(["desktop", "tablet", "mobile"] as const).map((mode) => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} className={previewMode === mode ? "flex items-center justify-center gap-2 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-semibold capitalize text-white shadow-[0_0_16px_rgba(239,68,68,0.12)]" : "flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-semibold capitalize text-slate-400 transition hover:border-cyan-400/20 hover:text-cyan-200"}><svg aria-hidden="true" viewBox="0 0 20 20" className="hidden h-4 w-4 fill-none stroke-cyan-300 sm:block" strokeWidth="1.5">{mode === "desktop" ? <><rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 16.5h6M10 13.5v3"/></> : mode === "tablet" ? <rect x="4.5" y="2" width="11" height="16" rx="1.5"/> : <rect x="6" y="2" width="8" height="16" rx="1.5"/>}</svg>{mode}</button>)}
                    </div>
                  </div>
                </div>

                {siteDocument ? <WebsitePageManager document={siteDocument} selectedPath={selectedPagePath} saving={savingPages} onSelect={setSelectedPagePath} onSave={saveSiteDocument} onAddEssentialPages={addEssentialBusinessPages} /> : (
                  <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-cyan-400/20 bg-slate-900/85 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="font-semibold text-white">Page Manager</h4><p className="mt-1 text-xs text-slate-400">Create a multi-page draft from this website. Your current website and live publication stay unchanged.</p></div><button type="button" onClick={initializeMultiPageDraft} disabled={savingPages} className={copyButtonClass}>{savingPages ? "Preparing pagesâ€¦" : "Set up pages"}</button></div>
                )}

                {editingWebsite && draftEdits && (
                  <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-slate-900/85 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div><h4 className="font-semibold text-white">Edit Website</h4><p className="mt-1 text-xs text-slate-400">Changes appear in the preview immediately. Save before publishing.</p></div>
                      <div className="flex gap-2"><button type="button" onClick={cancelEditingWebsite} disabled={savingEdits} className={copyButtonClass}>Cancel</button><button type="button" onClick={saveWebsiteEdits} disabled={savingEdits} className={copyButtonClass}>{savingEdits ? "Saving…" : "Save Changes"}</button></div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {([
                        ["companyName", "Business / company name", "text"],
                        ["heroHeadline", "Hero headline", "text"],
                        ["phone", "Phone number", "tel"],
                        ["email", "Email address", "email"],
                        ["address", "Address / location", "text"],
                        ["whatsapp", "WhatsApp number", "tel"],
                        ["primaryCtaLabel", "Primary CTA label", "text"],
                        ["primaryCtaLink", "Primary CTA link", "text"],
                      ] as const).map(([field, label, type]) => (
                        <label key={field} className="block"><span className="mb-2 block text-xs font-semibold text-slate-300">{label}</span><input type={type} value={draftEdits[field]} onChange={(event) => updateDraftEdit(field, event.target.value)} maxLength={field === "address" ? 4_000 : 200} required={!(["phone", "email", "address", "whatsapp"] as string[]).includes(field)} className="h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400/50" /></label>
                      ))}
                      {([[
                        "heroDescription", "Hero description",
                      ], ["aboutText", "About text"], ["servicesText", "Services text"]] as const).map(([field, label]) => (
                        <label key={field} className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold text-slate-300">{label}</span><textarea value={draftEdits[field]} onChange={(event) => updateDraftEdit(field, event.target.value)} maxLength={4_000} required rows={4} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/50" /></label>
                      ))}
                      <div className="block md:col-span-2">
                        <span className="mb-2 block text-xs font-semibold text-slate-300">Website template / style</span>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {WEBSITE_STYLE_OPTIONS.map((option) => {
                            const selected = draftEdits.template === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => updateDraftEdit("template", option.value)}
                                className={selected
                                  ? "rounded-2xl border border-cyan-300/60 bg-cyan-400/[0.08] p-4 text-left shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                                  : "rounded-2xl border border-white/10 bg-slate-950 p-4 text-left transition hover:border-cyan-400/30 hover:bg-slate-900"}
                              >
                                <span className="flex items-start justify-between gap-3">
                                  <span>
                                    <span className="block text-sm font-semibold text-white">{option.value}</span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-400">{option.label}</span>
                                  </span>
                                  <span className={selected ? "flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-400/15 text-cyan-100" : "flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-transparent"}>
                                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2">
                                      <path d="m3.5 8.5 3 3 6-7" />
                                    </svg>
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="block md:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-300">Brand palette</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomPaletteInput((current) => !current)}
                            className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-400/35 hover:text-white"
                          >
                            Advanced / Custom colors
                          </button>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-2">
                          {paletteOptions.map((palette) => {
                            const selected = selectedDraftPalette !== "" && selectedDraftPalette === normalizePaletteValue(palette.value);
                            const swatches = paletteSwatches(palette.value, fallbackPaletteValue);
                            const showBrandingRecommended = palette.id === "branding-ai" && hasSavedBrandingPalette;
                            const showForestRecommended = palette.id === "forest-luxe" && isStrongestInteriorsContext;
                            return (
                              <button
                                key={palette.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setDraftPalette(palette.value)}
                                className={selected
                                  ? "rounded-2xl border border-cyan-300/60 bg-cyan-400/[0.08] p-4 text-left shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                                  : "rounded-2xl border border-white/10 bg-slate-950 p-4 text-left transition hover:border-cyan-400/30 hover:bg-slate-900"}
                              >
                                <span className="flex items-start justify-between gap-3">
                                  <span>
                                    <span className="block text-sm font-semibold text-white">{palette.name}</span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-400">{palette.label}</span>
                                  </span>
                                  <span className={selected ? "flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-400/15 text-cyan-100" : "flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-transparent"}>
                                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2">
                                      <path d="m3.5 8.5 3 3 6-7" />
                                    </svg>
                                  </span>
                                </span>
                                {(showBrandingRecommended || showForestRecommended) && (
                                  <span className="mt-3 inline-flex rounded-full border border-amber-300/35 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">Recommended</span>
                                )}
                                <span className="mt-4 flex flex-wrap gap-2">
                                  {swatches.map((color, index) => (
                                    <span
                                      key={`${palette.id}-${color}-${index}`}
                                      className="h-9 w-9 rounded-full border border-white/15 shadow-[0_0_14px_rgba(255,255,255,0.08)]"
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {usingCustomDraftPalette && (
                          <p className="mt-3 text-xs text-amber-200">Custom palette active. You can keep it or pick a visual preset.</p>
                        )}
                        {showCustomPaletteInput && (
                          <label className="mt-4 block">
                            <span className="mb-2 block text-xs font-semibold text-slate-300">Custom palette value</span>
                            <input value={draftPalette} onChange={(event) => setDraftPalette(event.target.value)} placeholder="#173D32, #D4AF37, #F8F5EE, #102A23" maxLength={500} className="h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400/50" />
                          </label>
                        )}
                      </div>
                      <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold text-slate-300">Typography</span><input value={draftTypography} onChange={(event) => setDraftTypography(event.target.value)} maxLength={500} className="h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400/50" /></label>
                      <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
                        {([ ["hero", "Hero photo", heroPhotoInput, websiteMedia.hero], ["secondary", "Project / gallery photo", projectPhotoInput, savedSecondaryPhoto] ] as const).map(([slot, label, inputRef, current]) => <div key={slot} className="rounded-xl border border-white/10 p-4"><p className="text-sm font-semibold text-white">{label}</p><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void updateWebsitePhoto(slot, file); }} /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={Boolean(uploadingPhoto)} onClick={() => inputRef.current?.click()} className={copyButtonClass}>{uploadingPhoto === slot ? "Uploading…" : current ? "Replace Photo" : "Add Photo"}</button>{current && <button type="button" disabled={Boolean(uploadingPhoto)} onClick={() => void updateWebsitePhoto(slot)} className="min-h-9 rounded-xl border border-red-400/35 px-3.5 py-2 text-xs font-semibold text-red-200 disabled:opacity-50">Remove Photo</button>}</div></div>)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-black shadow-[0_25px_80px_rgba(0,0,0,0.5),0_0_25px_rgba(239,68,68,0.08)]">
                  <div className="flex items-center gap-3 border-b border-white/[0.08] bg-slate-900/95 px-4 py-3">
                    <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400"/><span className="h-2.5 w-2.5 rounded-full bg-slate-600"/><span className="h-2.5 w-2.5 rounded-full bg-cyan-300"/></div>
                    <div className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.07] bg-slate-950/80 px-3 py-1.5 text-center font-mono text-[9px] text-slate-500">https://{companyName.trim().toLowerCase().replace(/\s+/g, "-") || "your-business"}.com</div>
                    <span className="hidden items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-300 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/>Live</span>
                  </div>
                  <div className="relative flex min-h-[680px] items-start justify-center overflow-auto bg-slate-950/70 px-2 py-5 sm:px-4">
                    <WebsitePreview companyName={companyName} industry={industry} websiteGoal={targetAudience} websiteStyle={activeWebsiteEdits?.template || brandStyle} websiteRequirements={savedBusinessDescription || project?.businessDescription || brandDescription} previewMode={previewMode} brandResult={brandResult} websiteEdits={activeWebsiteEdits || undefined} siteDocument={activeSiteDocument || undefined} pagePath={selectedPagePath} previewSiteDocument onPageNavigate={setSelectedPagePath}
primaryLanguage={projectPrimaryLanguage}
media={websiteMedia}
serviceItems={verifiedServices.map((service) => ({ id: service.id, title: service.name, description: service.description, path: service.slug ? `/services/${service.slug}` : null }))}
contact={{ ...(activeWebsiteEdits?.email ? { email: activeWebsiteEdits.email } : {}), ...(activeWebsiteEdits?.phone ? { phone: activeWebsiteEdits.phone } : {}), ...(activeWebsiteEdits?.whatsapp ? { whatsapp: activeWebsiteEdits.whatsapp } : {}), ...(activeWebsiteEdits?.address ? { location: activeWebsiteEdits.address } : {}) }}
/>
                  </div>
                </div>
              </section>

              {publication?.status === "unpublished" && showGoLiveReview && websiteEdits && (
                <section className="relative mt-7 rounded-[24px] border border-cyan-400/25 bg-slate-950/80 p-5 sm:p-7">
                  <div className="border-b border-white/10 pb-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Final review</p>
                    <h3 className="mt-2 text-3xl font-semibold text-white">Your website is ready</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">Choose how customers will find your website.</p>
                  </div>

                  <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:grid-cols-3">
                    <div><p className="text-xs text-slate-500">Business name</p><p className="mt-1 font-semibold text-white">{websiteEdits.companyName}</p></div>
                    <div><p className="text-xs text-slate-500">Selected template</p><p className="mt-1 font-semibold text-white">{websiteEdits.template}</p></div>
                    <div><p className="text-xs text-slate-500">Website summary</p><p className="mt-1 text-sm text-slate-300">Your saved headline, business details, services and contact information are ready.</p></div>
                    <button type="button" onClick={beginEditingWebsite} className={`${copyButtonClass} sm:col-span-3 sm:w-fit`}>Edit Website</button>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <label className={`block cursor-pointer rounded-2xl border p-5 ${publishingOption === "buzypeezy" ? "border-cyan-400/45 bg-cyan-400/[0.06]" : "border-white/10 bg-slate-900/60"}`}>
                      <span className="flex items-start gap-3"><input type="radio" name="publishing-option" value="buzypeezy" checked={publishingOption === "buzypeezy"} onChange={() => setPublishingOption("buzypeezy")} className="mt-1" /><span><span className="block font-semibold text-white">Use my Buzypeezy website address</span><span className="mt-1 block text-xs leading-5 text-slate-400">Publish now using your included Buzypeezy address.</span></span></span>
                      <span className="mt-5 block text-xs font-semibold text-slate-300">Choose your address</span>
                      <span className="mt-2 flex overflow-hidden rounded-xl border border-white/10 bg-slate-950"><span className="hidden items-center border-r border-white/10 px-3 text-xs text-slate-500 sm:flex">sites.buzypeezy.ai/</span><input value={publicationSlug} onChange={(event) => setPublicationSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} onFocus={() => setPublishingOption("buzypeezy")} maxLength={63} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none" aria-label="Buzypeezy website address" /></span>
                      <span className={`mt-2 block text-xs ${publicationSlugIsValid ? "text-cyan-300" : "text-red-300"}`}>{publicationSlugIsValid ? `Final address: /published-sites/${publicationSlug}` : "Use 3–63 lowercase letters, numbers or single hyphens."}</span>
                    </label>

                    <label className={`block cursor-pointer rounded-2xl border p-5 ${publishingOption === "custom" ? "border-cyan-400/45 bg-cyan-400/[0.06]" : "border-white/10 bg-slate-900/60"}`}>
                      <span className="flex items-start gap-3"><input type="radio" name="publishing-option" value="custom" checked={publishingOption === "custom"} onChange={() => setPublishingOption("custom")} className="mt-1" /><span><span className="block font-semibold text-white">Connect my own domain</span><span className="mt-1 block text-xs leading-5 text-slate-400">Use an address you already own, such as www.mybusiness.com.</span></span></span>
                      <span className="mt-5 block text-xs font-semibold text-slate-300">Your domain</span>
                      <input value={customDomain} onChange={(event) => setCustomDomain(event.target.value.trim().toLowerCase())} onFocus={() => setPublishingOption("custom")} placeholder="www.mybusiness.com" maxLength={253} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400/50" aria-label="Custom domain" />
                      {customDomain && !customDomainIsValid && <span className="mt-2 block text-xs text-red-300">Enter a domain only, without http, paths or spaces.</span>}
                      <span className="mt-3 block text-xs leading-5 text-amber-200">Connecting a custom domain requires DNS verification. This domain is not connected yet, and Buzypeezy will not change your DNS automatically.</span>
                    </label>
                  </div>

                  {publishingOption === "custom" && customDomainIsValid && <p className="mt-4 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100">Your domain format looks valid. Custom-domain verification is not available yet, so it cannot be connected or published from this screen.</p>}

                  <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6">
                    <button type="button" onClick={beginEditingWebsite} className={copyButtonClass}>Back to Edit</button>
                    <button type="button" disabled={publicationLoading || publishingOption !== "buzypeezy" || !publicationSlugIsValid} onClick={() => updatePublication("POST")} className={copyButtonClass}>{publicationLoading ? "Publishing…" : "Approve & Go Live"}</button>
                  </div>
                </section>
              )}

              {!(publication?.status === "unpublished" && showGoLiveReview) && <section className="relative mt-7 rounded-[24px] border border-cyan-400/20 bg-slate-950/70 p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Website publication</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Status: {publication?.status === "active" ? "PUBLISHED" : "UNPUBLISHED"}</h3>
                    {publication?.status === "unpublished" ? (
                      <p className="mt-3 text-sm text-slate-400">Review your saved website and choose its address before going live.</p>
                    ) : (
                      <p className="mt-3 truncate text-sm text-slate-400">Future URL: {publication?.futureUrl}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={() => document.querySelector(".easy-website-preview")?.scrollIntoView({ behavior: "smooth" })} className={copyButtonClass}>Preview Website</button>
                    {publication?.status === "unpublished" && <button type="button" disabled={!websiteEdits} onClick={() => setShowGoLiveReview(true)} className={copyButtonClass}>Review &amp; Go Live</button>}
                    {publication?.status === "active" && <a href={publication.internalUrl} target="_blank" rel="noopener noreferrer" className={copyButtonClass}>View Live Site</a>}
                    {publication && publication.status !== "unpublished" && <button type="button" disabled={publicationLoading} onClick={() => updatePublication("PATCH")} className={copyButtonClass}>Republish Changes</button>}
                    {publication?.status === "active" && <button type="button" disabled={publicationLoading} onClick={() => updatePublication("DELETE")} className={copyButtonClass}>Unpublish</button>}
                  </div>
                </div>
              </section>}
            </section>
          )}

          <section className="relative mt-7 rounded-[24px] border border-cyan-400/20 bg-slate-950/70 p-5 sm:p-6">
            {project && project.id === projectId ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Domain setup</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Your Domain</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">Use your own domain for your Buzypeezy website.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={`https://www.godaddy.com/en-in/domains?domaintocheck=${encodeURIComponent(`${(project.companyName || companyName).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 59) || "yourbusiness"}.com`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={copyButtonClass}
                  >
                    Find &amp; Buy a Domain
                  </a>
                  <button type="button" onClick={() => setShowOwnedDomainSetup((current) => !current)} className={copyButtonClass}>
                    I Already Own a Domain
                  </button>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">Domain purchase and payment are completed securely with the domain provider.</p>

                {showOwnedDomainSetup && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Connection guidance / setup</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">Enter the domain you already own. Buzypeezy will guide you through connecting it to your website.</p>
                    <input
                      value={customDomain}
                      onChange={(event) => setCustomDomain(event.target.value.trim().toLowerCase())}
                      placeholder="yourbusiness.com"
                      maxLength={253}
                      className="mt-4 h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
                      aria-label="Domain you already own"
                    />
                    {customDomain && !customDomainIsValid && <p className="mt-2 text-xs text-red-300">Enter a domain only, without http, paths or spaces.</p>}
                    <p className="mt-3 text-xs leading-5 text-amber-200">This is a guidance step only. Your domain is not connected yet, and Buzypeezy will not change DNS automatically.</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">Select a business project first.</p>
            )}
          </section>

          {!brandResult && !loading && (
            <section className="relative mt-8 overflow-hidden rounded-[26px] border border-dashed border-red-500/20 bg-slate-900/45 p-8 text-center sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/[0.06] text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.1)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 12h10M7 16h6"/></svg></div>
              <div className="mt-5 flex items-center justify-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Awaiting website brief</span></div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Your Website Intelligence will appear here</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">Configure the website brief to generate a complete architecture, content direction, feature system, technical plan and responsive live preview.</p>
            </section>
          )}
        </div>
      </div>
    </section>
  </main>
);
}

export default function WebsiteAIPage() {
  return <Suspense fallback={null}><WebsiteAIPageContent /></Suspense>;
}
