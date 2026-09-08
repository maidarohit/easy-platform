"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import auth from "@/app/lib/auth";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { shouldShowBusinessPlanBadge } from "@/app/lib/sidebar-entitlement";

type MenuItem = Readonly<{ label: string; href: string; icon: string; businessPlan?: boolean }>;
type Publication = Readonly<{ status: "unpublished" | "active" | "inactive"; publicUrl?: string }>;
type BillingAccess = Readonly<{ entitlements?: { paidAccess?: boolean } }>;

const PRIMARY_ITEMS: readonly MenuItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "⌂" },
  { label: "My Business", href: "/master-workspace", icon: "◇" },
  { label: "Preview", href: "/business-preview", icon: "◫" },
  { label: "Store", href: "/store", icon: "▣" },
  { label: "Automation", href: "/dashboard/automation", icon: "↻", businessPlan: true },
  { label: "Social & Content", href: "/social", icon: "◉" },
  { label: "Settings", href: "/settings", icon: "⚙" },
];

const ADVANCED_ITEMS: readonly MenuItem[] = [
  { label: "AI Manager", href: "/ai-manager", icon: "✦", businessPlan: true },
  { label: "Branding", href: "/branding-ai", icon: "◈", businessPlan: true },
  { label: "Website", href: "/dashboard/website-ai", icon: "⌘" },
  { label: "Marketing", href: "/marketing-ai", icon: "◎", businessPlan: true },
  { label: "SEO", href: "/seo-ai", icon: "⌕", businessPlan: true },
  { label: "UI/UX", href: "/uiux-ai", icon: "▫", businessPlan: true },
  { label: "Sales", href: "/sales-ai", icon: "↗", businessPlan: true },
  { label: "Analytics", href: "/analytics-ai", icon: "◰", businessPlan: true },
  { label: "Creative Tools", href: "/dashboard/creative-ai", icon: "✧", businessPlan: true },
  { label: "Logo", href: "/dashboard/logo-ai", icon: "△" },
  { label: "Images", href: "/dashboard/image-ai", icon: "▣" },
  { label: "Video", href: "/dashboard/video-ai", icon: "▶" },
  { label: "Content", href: "/dashboard/content-ai", icon: "≡" },
  { label: "Presentations", href: "/dashboard/presentation-ai", icon: "▱" },
];

function withProject(path: string, projectId: string) {
  if (!projectId || path === "/dashboard") return path;
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("projectId", projectId);
  return `${pathname}?${params.toString()}`;
}

function NavigationLink({ item, projectId, active, paidAccess }: { item: MenuItem; projectId: string; active: boolean; paidAccess: boolean | null }) {
  return <Link href={withProject(item.href, projectId)} aria-label={item.label} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61] ${active ? "bg-[#DDE3D8] text-[#173D32]" : "text-[#AEB8B2] hover:bg-white/10 hover:text-white"}`}>
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10">{item.icon}</span>
    <span className="hidden min-w-0 flex-1 sm:inline">{item.label}</span>
    {shouldShowBusinessPlanBadge(item.businessPlan, paidAccess) && <span title="Business Plan" aria-label="Business Plan" className="ml-auto rounded-full border border-[#B89A61]/35 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#D8C28F]"><span className="sm:hidden">🔒</span><span className="hidden sm:inline">Business Plan</span></span>}
  </Link>;
}

export default function Sidebar({ projectId: suppliedProjectId = "" }: { projectId?: string }) {
  const pathname = usePathname();
  const queryProjectId = useSearchParams().get("projectId")?.trim() ?? "";
  const projectId = suppliedProjectId.trim() || queryProjectId;
  const [publication, setPublication] = useState<Publication>({ status: "unpublished" });
  const [paidAccess, setPaidAccess] = useState<boolean | null>(null);
  const entitlementRequest = useRef(0);
  const advancedActive = ADVANCED_ITEMS.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    let active = true;
    let authenticated = false;
    const refreshPaidAccess = () => {
      if (!authenticated) return;
      const request = ++entitlementRequest.current;
      void authenticatedFetch("/api/billing/status", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json() as BillingAccess;
          if (active && response.ok && request === entitlementRequest.current) {
            setPaidAccess(data.entitlements?.paidAccess === true);
          }
        })
        .catch(() => undefined);
    };
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authenticated = Boolean(user);
      entitlementRequest.current += 1;
      if (!user) setPaidAccess(false);
      else {
        setPaidAccess(null);
        refreshPaidAccess();
      }
    });
    window.addEventListener("focus", refreshPaidAccess);
    return () => {
      active = false;
      entitlementRequest.current += 1;
      unsubscribe();
      window.removeEventListener("focus", refreshPaidAccess);
    };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void authenticatedFetch(`/api/business-publications?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok && active) setPublication(data.publication as Publication);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [projectId]);

  return <aside className="easy-intelligence-sidebar sticky top-0 flex h-screen w-20 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#07100d] sm:w-64">
    <div className="border-b border-white/10 px-3 py-5 sm:px-5">
      <Link href="/dashboard" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173D32] text-white">B</span>
        <span className="hidden sm:block"><strong className="text-white">Buzypeezy</strong><span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-[#839088]">Build your business</span></span>
      </Link>
    </div>
    <div className="easy-sidebar-scrollbar flex-1 overflow-y-auto px-2 py-4 sm:px-4">
      <p className="mb-2 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#718078] sm:block">Your business</p>
      <nav aria-label="Primary navigation" className="space-y-1">
        {PRIMARY_ITEMS.map((item) => <NavigationLink key={item.href} item={item} projectId={projectId} active={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))} paidAccess={paidAccess} />)}
        {publication.status === "active" && publication.publicUrl && <Link href={publication.publicUrl} target="_blank" rel="noopener noreferrer" aria-label="View Live Business" className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#D8C28F] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]"><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#B89A61]/30">↗</span><span className="hidden sm:inline">View Live Business</span></Link>}
      </nav>
      <details open={advancedActive} className="mt-5 border-t border-white/10 pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#AEB8B2] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]"><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10">⋯</span><span className="hidden sm:inline">Advanced Tools</span></summary>
        <nav aria-label="Advanced Tools" className="mt-2 space-y-1 border-l border-white/10 pl-1 sm:ml-4">
          {ADVANCED_ITEMS.map((item) => <NavigationLink key={item.href} item={item} projectId={projectId} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} paidAccess={paidAccess} />)}
        </nav>
      </details>
    </div>
    <div className="hidden border-t border-white/10 p-4 text-xs text-[#718078] sm:block">Your saved work stays connected.</div>
  </aside>;
}
