"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  addWebsitePage,
  removeWebsitePage,
  renameWebsitePage,
  reorderWebsitePages,
  restoreWebsitePage,
  setWebsitePageNavigationVisibility,
  type WebsitePage,
  type WebsitePageType,
  type WebsiteSiteDocument,
} from "@/app/lib/website-site-document";

const PAGE_TYPES: Array<Exclude<WebsitePageType, "home">> = ["about", "services", "service", "portfolio", "project", "process", "faq", "contact", "custom"];

function PageRow({ page, document, selected, disabled, onSelect, onSave }: { page: WebsitePage; document: WebsiteSiteDocument; selected: boolean; disabled: boolean; onSelect: (path: string) => void; onSave: (document: WebsiteSiteDocument) => Promise<boolean> }) {
  const [title, setTitle] = useState(page.title);
  const [path, setPath] = useState(page.path);
  const ordered = [...document.pages].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((item) => item.id === page.id);
  const shownInNavigation = document.navigation.items.some((item) => item.pageId === page.id && item.visibility === "visible");
  const saveRename = async () => {
    const next = renameWebsitePage(document, page.id, { title, path });
    if (!next) toast.error("Use a unique, non-reserved page path.");
    if (!next || !await onSave(next)) { setTitle(page.title); setPath(page.path); }
  };
  const move = async (offset: number) => {
    const destination = index + offset;
    if (destination < 0 || destination >= ordered.length) return;
    const orderedIds = ordered.map((item) => item.id);
    const currentId = orderedIds[index];
    orderedIds[index] = orderedIds[destination];
    orderedIds[destination] = currentId;
    const next = reorderWebsitePages(document, orderedIds);
    if (next) await onSave(next);
  };
  return <li className={`rounded-xl border p-4 ${selected ? "border-cyan-400/50 bg-cyan-400/[0.08]" : "border-white/10 bg-slate-950/70"}`}>
    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
      <label><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Page title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} disabled={disabled} className="h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white" /></label>
      <label><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Page path</span><input value={path} onChange={(event) => setPath(event.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, "-"))} maxLength={160} disabled={disabled || page.type === "home"} className="h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white disabled:opacity-60" /></label>
      <button type="button" disabled={disabled || (title === page.title && path === page.path)} onClick={saveRename} className="self-end rounded-lg border border-cyan-400/25 px-3 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-40">Save name/path</button>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => onSelect(page.path)} disabled={disabled} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200">Preview</button>
      <button type="button" onClick={() => move(-1)} disabled={disabled || index === 0} aria-label={`Move ${page.title} up`} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40">Move up</button>
      <button type="button" onClick={() => move(1)} disabled={disabled || index === ordered.length - 1} aria-label={`Move ${page.title} down`} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40">Move down</button>
      <button type="button" onClick={async () => { const next = setWebsitePageNavigationVisibility(document, page.id, !shownInNavigation); if (next) await onSave(next); }} disabled={disabled} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">{shownInNavigation ? "Hide from navigation" : "Show in navigation"}</button>
      {page.type !== "home" && <button type="button" onClick={async () => { const next = removeWebsitePage(document, page.id); if (next) await onSave(next); }} disabled={disabled} className="rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-200">Remove</button>}
      {page.type === "home" && <span className="self-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Home is protected</span>}
    </div>
  </li>;
}

export default function WebsitePageManager({ document, selectedPath, saving, onSelect, onSave, onAddEssentialPages }: { document: WebsiteSiteDocument; selectedPath: string; saving: boolean; onSelect: (path: string) => void; onSave: (document: WebsiteSiteDocument) => Promise<boolean>; onAddEssentialPages?: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [type, setType] = useState<Exclude<WebsitePageType, "home">>("custom");
  const activePages = [...document.pages].filter((page) => page.visibility !== "removed").sort((a, b) => a.order - b.order);
  const removedPages = document.pages.filter((page) => page.visibility === "removed");
  const addPage = async () => {
    const next = addWebsitePage(document, { title, path, type });
    if (!next) { toast.error("Use a unique, non-reserved path beginning with /."); return; }
    if (!await onSave(next)) return;
    const added = next.pages.find((page) => !document.pages.some((current) => current.id === page.id));
    setTitle(""); setPath("");
    if (added) onSelect(added.path);
  };
  return <section className="mb-5 rounded-2xl border border-cyan-400/20 bg-slate-900/85 p-5" aria-labelledby="website-page-manager-title">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h4 id="website-page-manager-title" className="font-semibold text-white">Page Manager</h4><p className="mt-1 text-xs text-slate-400">Manage draft pages and preview them here. Live pages are unchanged until a supported republish.</p></div><div className="flex items-center gap-3">{onAddEssentialPages && <button type="button" disabled={saving} onClick={onAddEssentialPages} className="rounded-lg border border-cyan-400/25 px-3 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-40">Add essential business pages</button>}<span className="text-xs text-slate-500">{activePages.length} active page{activePages.length === 1 ? "" : "s"}</span></div></div>
    <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-4 md:grid-cols-[1fr_1fr_0.8fr_auto]">
      <input aria-label="New page title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Page title" maxLength={200} disabled={saving} className="h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white" />
      <input aria-label="New page path" value={path} onChange={(event) => setPath(event.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, "-"))} placeholder="/page-path" maxLength={160} disabled={saving} className="h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white" />
      <select aria-label="New page type" value={type} onChange={(event) => setType(event.target.value as Exclude<WebsitePageType, "home">)} disabled={saving} className="h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white">{PAGE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <button type="button" onClick={addPage} disabled={saving || !title.trim() || !path.trim()} className="rounded-lg border border-cyan-400/30 px-4 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-40">Add page</button>
    </div>
    <ul className="mt-4 space-y-3">{activePages.map((page) => <PageRow key={`${page.id}:${page.title}:${page.path}`} page={page} document={document} selected={selectedPath === page.path} disabled={saving} onSelect={onSelect} onSave={onSave} />)}</ul>
    {removedPages.length > 0 && <div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-semibold text-slate-400">Removed pages</p><ul className="mt-2 flex flex-wrap gap-2">{removedPages.map((page) => <li key={page.id} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400"><span>{page.title}</span><button type="button" disabled={saving} onClick={async () => { const next = restoreWebsitePage(document, page.id); if (next) await onSave(next); }} className="font-semibold text-cyan-300">Restore hidden</button></li>)}</ul></div>}
  </section>;
}
