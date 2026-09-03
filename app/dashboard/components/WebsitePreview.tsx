"use client";

import type { ReactNode } from "react";
import type { WebsiteAiOutput, WebsiteEdits } from "../../lib/ai";

import { websiteThemes } from "./websiteThemes";
import ModernTemplate from "./website-templates/ModernTemplate";
import LuxuryTemplate from "./website-templates/LuxuryTemplate";
import CorporateTemplate from "./website-templates/CorporateTemplate";
import CreativeTemplate from "./website-templates/CreativeTemplate";
import MinimalTemplate from "./website-templates/MinimalTemplate";
import DarkTemplate from "./website-templates/DarkTemplate";

type WebsitePreviewProps = {
  companyName: string;
  industry: string;
  websiteGoal: string;
  websiteStyle: string;
  previewMode: "desktop" | "tablet" | "mobile";
  websiteRequirements?: string;
  brandResult?: WebsiteAiOutput & { heroHeadline?: string };
  websiteEdits?: WebsiteEdits;
  primaryLanguage?: string;
};

export default function WebsitePreview({
  companyName,
  industry,
  websiteGoal,
  websiteStyle,
  previewMode,
  websiteRequirements,
  brandResult,
  websiteEdits,
  primaryLanguage = "en",
}: WebsitePreviewProps) {
  const theme = websiteThemes[websiteStyle] || websiteThemes.Modern;

  const primaryColor = theme.primaryColor;
  const businessName = websiteEdits?.companyName || companyName || "Your Business";
  const savedHeroHeadline = websiteEdits?.heroHeadline?.trim() || "";

const resolvedHeroHeadline =
  /^Build a stronger .+ presence online$/i.test(savedHeroHeadline)
    ? brandResult?.websiteGoal || savedHeroHeadline
    : savedHeroHeadline || brandResult?.websiteGoal;

const editedBrandResult =
  websiteEdits && brandResult
    ? {
        ...brandResult,
        heroHeadline: resolvedHeroHeadline,
        websiteOverview: websiteEdits.heroDescription,
      }
    : brandResult;
  const editedGoal = websiteEdits?.primaryCtaLabel || websiteGoal;
  const previewTranslations = {
  en: { home: "Home", services: "Services", about: "About", contact: "Contact", howWeCanHelp: "How we can help" },
  es: { home: "Inicio", services: "Servicios", about: "Acerca de", contact: "Contacto", howWeCanHelp: "Cómo podemos ayudar" },
  fr: { home: "Accueil", services: "Services", about: "À propos", contact: "Contact", howWeCanHelp: "Comment nous pouvons vous aider" },
  de: { home: "Startseite", services: "Leistungen", about: "Über uns", contact: "Kontakt", howWeCanHelp: "Wie wir helfen können" },
  pt: { home: "Início", services: "Serviços", about: "Sobre", contact: "Contato", howWeCanHelp: "Como podemos ajudar" },
  ar: { home: "الرئيسية", services: "الخدمات", about: "من نحن", contact: "اتصل بنا", howWeCanHelp: "كيف يمكننا مساعدتك" },
  hi: { home: "होम", services: "सेवाएँ", about: "हमारे बारे में", contact: "संपर्क", howWeCanHelp: "हम कैसे मदद कर सकते हैं" },
  ja: { home: "ホーム", services: "サービス", about: "私たちについて", contact: "お問い合わせ", howWeCanHelp: "私たちがお手伝いできること" },
  ko: { home: "홈", services: "서비스", about: "소개", contact: "문의", howWeCanHelp: "도움드릴 수 있는 방법" },
  zh: { home: "首页", services: "服务", about: "关于我们", contact: "联系我们", howWeCanHelp: "我们如何帮助您" },
  kn: { home: "ಮುಖಪುಟ", services: "ಸೇವೆಗಳು", about: "ನಮ್ಮ ಬಗ್ಗೆ", contact: "ಸಂಪರ್ಕ", howWeCanHelp: "ನಾವು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು" },
  ta: { home: "முகப்பு", services: "சேவைகள்", about: "எங்களைப் பற்றி", contact: "தொடர்பு", howWeCanHelp: "நாங்கள் எப்படி உதவலாம்" },
  te: { home: "హోమ్", services: "సేవలు", about: "మా గురించి", contact: "సంప్రదించండి", howWeCanHelp: "మేము ఎలా సహాయం చేయగలం" },
  ml: { home: "ഹോം", services: "സേവനങ്ങൾ", about: "ഞങ്ങളെക്കുറിച്ച്", contact: "ബന്ധപ്പെടുക", howWeCanHelp: "ഞങ്ങൾ എങ്ങനെ സഹായിക്കാം" },
} as const;

const ui =
  previewTranslations[
    primaryLanguage as keyof typeof previewTranslations
  ] || previewTranslations.en;

  const headline = `Build a stronger ${
    industry || "business"
  } presence online`;

  const description =
    "A modern website designed to help your business attract customers, build trust, and grow online.";

  const goalDescription =
    brandResult?.websiteGoal ||
    "Designed to support your business goals and convert visitors into customers.";

  const previewWidthClass =
    previewMode === "desktop"
      ? "w-full max-w-none"
      : previewMode === "tablet"
        ? "w-[760px] max-w-[88%]"
        : "w-[390px] max-w-[92%]";

  let selectedTemplate: ReactNode = null;

  switch (websiteStyle) {
    case "Modern":
      selectedTemplate = (
        <ModernTemplate
          companyName={businessName}
          industry={industry}
          websiteGoal={editedGoal}
          brandResult={editedBrandResult}
          previewMode={previewMode}
                  labels={ui}
        />
      );
      break;

    case "Luxury":
      selectedTemplate = (
        <LuxuryTemplate
          companyName={businessName}
          industry={industry}
          websiteGoal={editedGoal}
          websiteRequirements={websiteRequirements}
          previewMode={previewMode}
          brandResult={editedBrandResult}
                  labels={ui}
        />
      );
      break;

    case "Corporate":
      selectedTemplate = (
        <CorporateTemplate
          companyName={businessName}
          industry={industry}
          websiteGoal={editedGoal}
          brandResult={editedBrandResult}
                  labels={ui}
        />
      );
      break;

    case "Creative":
      selectedTemplate = (
        <CreativeTemplate
          companyName={businessName}
          industry={industry}
          websiteGoal={editedGoal}
          brandResult={editedBrandResult}
                  labels={ui}
        />
      );
      break;

    case "Minimal":
      selectedTemplate = (
        <MinimalTemplate
          companyName={businessName}
          industry={industry}
          websiteGoal={editedGoal}
          brandResult={editedBrandResult}
          labels={ui}
        />
      );
      break;

    case "Dark":
      selectedTemplate = (
        <DarkTemplate
          companyName={businessName}
          industry={industry}
          websiteGoal={editedGoal}
          brandResult={editedBrandResult}
                  labels={ui}
        />
      );
      break;

    default:
      selectedTemplate = null;
  }

  if (selectedTemplate) {
    return (
      <div
        className={`easy-website-preview mx-auto overflow-hidden rounded-[32px] border border-cyan-500/20 bg-slate-950/70 shadow-[0_0_70px_rgba(6,182,212,0.16)] backdrop-blur-xl transition-all duration-500 ${previewWidthClass}`}
      >
        {selectedTemplate}
        {websiteEdits && (
          <section className="grid gap-8 border-t border-slate-200 bg-white px-8 py-14 text-slate-900 lg:grid-cols-2 lg:px-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
  {ui.about}
</p>
<h2 className="mt-3 text-3xl font-bold">
  {ui.about} {businessName}
</h2>
              <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-600">{websiteEdits.aboutText}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
  {ui.services}
</p>
<h2 className="mt-3 text-3xl font-bold">
  {ui.howWeCanHelp}
</h2>
              <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-600">{websiteEdits.servicesText}</p>
            </div>
            <div className="lg:col-span-2 rounded-2xl bg-slate-950 p-7 text-white">
              <h2 className="text-2xl font-bold">
  {ui.contact} {businessName}
</h2>
              <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                {websiteEdits.phone && <p>Phone: {websiteEdits.phone}</p>}
                {websiteEdits.email && <p>Email: {websiteEdits.email}</p>}
                {websiteEdits.whatsapp && <p>WhatsApp: {websiteEdits.whatsapp}</p>}
                {websiteEdits.address && <p>Address: {websiteEdits.address}</p>}
              </div>
              <a href={websiteEdits.primaryCtaLink} className="mt-6 inline-flex rounded-xl px-5 py-3 font-semibold text-white" style={{ backgroundColor: primaryColor }}>
                {websiteEdits.primaryCtaLabel}
              </a>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div
      className={`easy-website-preview mx-auto overflow-hidden border transition-all duration-500 ${previewWidthClass}`}
      style={{
        backgroundColor: theme.pageBackground,
        color: theme.textColor,
        borderColor: theme.borderColor,
        borderRadius: theme.cardRadius,
        fontFamily: theme.bodyFont,
      }}
    >
      {/* Preview Navbar */}
      <nav className="flex items-center justify-between border-b border-slate-200 px-8 py-5">
        <div className="text-xl font-bold">{businessName}</div>

        <div className="hidden gap-6 text-sm font-medium md:flex">
          <span>Home</span>
          <span>About</span>
          <span>Services</span>
          <span>Contact</span>
        </div>

        <button
          type="button"
          className="rounded-lg px-5 py-2 font-semibold text-white transition duration-300 hover:-translate-y-0.5"
          style={{ backgroundColor: primaryColor }}
        >
          Get Started
        </button>
      </nav>

      {/* Hero Section */}
      <section className="grid gap-10 px-8 py-20 lg:grid-cols-2 lg:px-14">
        <div className="flex flex-col justify-center">
          <span
            className="mb-5 w-fit rounded-full px-4 py-2 text-sm font-semibold"
            style={{
              backgroundColor: `${primaryColor}20`,
              color: primaryColor,
            }}
          >
            {websiteStyle || "Modern"} Website
          </span>

          <h1 className="max-w-xl text-5xl font-extrabold leading-tight tracking-tight">
            {headline}
          </h1>

          <p className="mt-6 max-w-lg text-base leading-7 text-slate-600">
            {description}
          </p>

          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">
            {goalDescription.length > 170
              ? `${goalDescription.slice(0, 170)}...`
              : goalDescription}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              className="rounded-lg px-6 py-3 font-bold text-white transition duration-300 hover:-translate-y-0.5"
              style={{ backgroundColor: primaryColor }}
            >
              {websiteGoal || "Start Today"}
            </button>

            <button
              type="button"
              className="rounded-lg border border-slate-300 px-6 py-3 font-bold transition duration-300 hover:border-slate-500"
            >
              Learn More
            </button>
          </div>
        </div>

        <div className="flex min-h-[360px] items-center justify-center rounded-3xl bg-slate-100 p-8">
          <div className="w-full rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
            </div>

            <div className="h-32 rounded-xl bg-slate-200" />

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="h-20 rounded-lg bg-slate-100" />
              <div className="h-20 rounded-lg bg-slate-100" />
              <div className="h-20 rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 px-8 py-16 lg:px-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-semibold" style={{ color: primaryColor }}>
            Why Choose Us
          </p>

          <h2 className="mt-3 text-3xl font-bold">
            Everything your business needs
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Professional Design",
              text: "A modern and trustworthy website experience.",
            },
            {
              title: "Business Focused",
              text: "Designed around your audience and business goals.",
            },
            {
              title: "Ready to Grow",
              text: "Built to support marketing, sales, and future expansion.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: primaryColor }}
              >
                ✓
              </div>

              <h3 className="text-xl font-bold">{feature.title}</h3>

              <p className="mt-3 leading-7 text-slate-600">
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-8 py-16 lg:px-14">
        <div className="overflow-hidden rounded-[32px] bg-slate-950 px-8 py-16 text-center text-white shadow-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">
            Ready to get started?
          </p>

          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-medium tracking-[-0.04em] md:text-5xl">
            Ready to grow {businessName}?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl leading-7 text-slate-400">
            Start building a stronger online presence with a website created
            specifically for your business.
          </p>

          <button
            type="button"
            className="mt-8 rounded-full px-8 py-4 font-medium text-white shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{ backgroundColor: primaryColor }}
          >
            Get Started
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col justify-between gap-6 border-t border-slate-200 bg-white px-8 py-10 text-slate-900 md:flex-row md:items-center lg:px-14">
        <div>
          <p className="font-medium tracking-[-0.02em]">{businessName}</p>

          <p className="mt-2 text-sm text-slate-500">
            Built with Buzypeezy
          </p>
        </div>

        <p className="text-sm text-slate-400">
          © 2026 {businessName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
