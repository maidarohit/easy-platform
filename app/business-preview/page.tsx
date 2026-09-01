"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import type { BusinessPreview } from "@/app/lib/business-preview";
import { renderedBusinessPreviewSections } from "@/app/lib/business-preview-sections";
import { PUBLIC_CONTACT_FIELDS, type PublicContactSettings } from "@/app/lib/public-contact";
import {
  applyPreviewOverrides, PREVIEW_EDIT_RULES, previewFieldValue, validatePreviewOverrides,
  type PreviewEditableField, type PreviewOverrides,
} from "@/app/lib/business-preview-edits";
import { BusinessSiteVisual } from "@/app/components/BusinessSiteVisual";
import {
  businessServiceVisual,
  businessShowcaseVisuals,
  resolveBusinessVisual,
  uploadedSrcFromRecord,
} from "@/app/lib/business-site-visuals";

type Viewport = "desktop" | "tablet" | "mobile";
type Publication = { status: "unpublished" | "active" | "inactive"; publicUrl?: string; publishedPreviewRevision?: number; canPublish?: boolean };
const VIEWPORT_WIDTH: Readonly<Record<Viewport, string>> = {
  desktop: "max-w-6xl", tablet: "max-w-3xl", mobile: "max-w-sm",
};

function OptionalText({ value, className = "" }: { value: string | null; className?: string }) {
  return value ? <p className={className}>{value}</p> : null;
}

function ExpandableText({ value, className = "", previewLength = 220, inverse = false }: {
  value: string | null; className?: string; previewLength?: number; inverse?: boolean;
}) {
  if (!value) return null;
  if (value.length <= previewLength) return <p className={className}>{value}</p>;
  return <div><p className={className}>{value.slice(0, previewLength).trimEnd()}…</p><details className="mt-3"><summary className={`cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 ${inverse ? "text-white focus-visible:ring-white" : "text-current focus-visible:ring-current"}`}>View more</summary><p className={`${className} mt-3 whitespace-pre-wrap`}>{value}</p></details></div>;
}

function BusinessPreviewContent() {
  const projectId = useSearchParams().get("projectId")?.trim() ?? "";
  const [preview, setPreview] = useState<BusinessPreview | null>(null);
  const [originalPreview, setOriginalPreview] = useState<BusinessPreview | null>(null);
  const [savedOverrides, setSavedOverrides] = useState<PreviewOverrides>({});
  const [draftOverrides, setDraftOverrides] = useState<PreviewOverrides>({});
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [websiteStyle, setWebsiteStyle] = useState<"minimal" | "modern" | "luxury" | "bold">("modern");
const [colorTheme, setColorTheme] = useState<"modern-green" | "luxury-dark" | "minimal-light" | "warm-earth" | "bold-business">("modern-green");
const [backgroundStyle, setBackgroundStyle] = useState<"clean" | "industry" | "gradient" | "pattern">("industry");
const [visualIntensity, setVisualIntensity] = useState<"none" | "subtle" | "medium">("subtle");
  const [uploadingSlot, setUploadingSlot] = useState<"hero" | "secondary" | "video" | null>(null);
  const mainPhotoInputRef = useRef<HTMLInputElement>(null);
  const secondPhotoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

const siteTheme = {
  "modern-green": {
    background: "#F7F4EC",
    surface: "#FFFFFF",
    primary: "#173D32",
    accent: "#D8C8A7",
    text: "#173D32",
  },
  "luxury-dark": {
    background: "#111111",
    surface: "#1C1C1C",
    primary: "#0B0B0B",
    accent: "#C7A86B",
    text: "#F7F2E8",
  },
  "minimal-light": {
    background: "#F7F7F5",
    surface: "#FFFFFF",
    primary: "#202020",
    accent: "#D9D9D4",
    text: "#202020",
  },
  "warm-earth": {
    background: "#F3E9DC",
    surface: "#FFFDFC",
    primary: "#6B4435",
    accent: "#C98763",
    text: "#49352D",
  },
  "bold-business": {
    background: "#EEF3F8",
    surface: "#FFFFFF",
    primary: "#102A43",
    accent: "#2F80ED",
    text: "#102A43",
  },
}[colorTheme];

const visualOpacity =
  visualIntensity === "none"
    ? 0
    : visualIntensity === "medium"
      ? 0.24
      : 0.12;
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publication, setPublication] = useState<Publication>({ status: "unpublished" });
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [contact, setContact] = useState<PublicContactSettings>({});
  const [savingContact, setSavingContact] = useState(false);
  const [contactStatus, setContactStatus] = useState("");

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void authenticatedFetch(`/api/business-preview?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to open your preview.");
        if (active) {
          setPreview(data.preview as BusinessPreview);
          setOriginalPreview(data.originalPreview as BusinessPreview);
          setSavedOverrides(data.overrides as PreviewOverrides);
          setDraftOverrides(data.overrides as PreviewOverrides);
        }
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Unable to open your preview."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void authenticatedFetch(`/api/public-contact-settings?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) setContact(data.settings as PublicContactSettings); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [projectId]);

  async function saveContactSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (savingContact) return; setSavingContact(true); setContactStatus("");
    try {
      const response = await authenticatedFetch("/api/public-contact-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, settings: contact }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to save contact settings.");
      setContact(data.settings as PublicContactSettings); setContactStatus("Saved. These approved details will appear after you publish or republish.");
    } catch (saveError) { setContactStatus(saveError instanceof Error ? saveError.message : "Unable to save contact settings."); }
    finally { setSavingContact(false); }
  }

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void authenticatedFetch(`/api/business-publications?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) setPublication(data.publication as Publication); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [projectId]);

  async function approvePreview() {
    if (!projectId || approving || preview?.approval.approved) return;
    setApproving(true); setError("");
    try {
      const response = await authenticatedFetch("/api/business-preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to approve this preview.");
      setPreview((current) => current ? { ...current, approval: { ...current.approval, approved: true } } : current);
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Unable to approve this preview.");
    } finally { setApproving(false); }
  }

  function startEditing() {
    setDraftOverrides(savedOverrides);
    setEditing(true);
    setError("");
  }

  function updateDraft(field: PreviewEditableField, value: string) {
    if (!originalPreview) return;
    const next = { ...draftOverrides, [field]: value };
    setDraftOverrides(next);
    setPreview(applyPreviewOverrides(originalPreview, next));
  }

  function cancelEditing() {
    if (originalPreview) setPreview(applyPreviewOverrides(originalPreview, savedOverrides));
    setDraftOverrides(savedOverrides);
    setEditing(false);
    setError("");
  }

  function resetToOriginal() {
    const imageOnly = {
      ...(savedOverrides.heroImage ? { heroImage: savedOverrides.heroImage } : {}),
      ...(savedOverrides.secondaryImage ? { secondaryImage: savedOverrides.secondaryImage } : {}),
      ...(savedOverrides.businessVideo ? { businessVideo: savedOverrides.businessVideo } : {}),
    };
    if (originalPreview) setPreview(applyPreviewOverrides(originalPreview, imageOnly));
    setDraftOverrides(imageOnly);
    setError("");
  }

  async function saveChanges() {
    if (!projectId || !originalPreview || saving) return;
    const checked = validatePreviewOverrides(draftOverrides, originalPreview);
    if (!checked.valid) { setError(checked.error); return; }
    setSaving(true); setError("");
    try {
      const response = await authenticatedFetch("/api/business-preview/edits", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, overrides: checked.overrides }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save your preview changes.");
      setPreview(data.preview as BusinessPreview);
      setSavedOverrides(data.overrides as PreviewOverrides);
      setDraftOverrides(data.overrides as PreviewOverrides);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your preview changes.");
    } finally { setSaving(false); }
  }

  async function uploadBusinessPhoto(slot: "hero" | "secondary", file: File) {
    if (!projectId || uploadingSlot) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("That photo is too large. Use an image under 4 MB.");
      const input = slot === "hero" ? mainPhotoInputRef.current : secondPhotoInputRef.current;
      if (input) input.value = "";
      return;
    }
    setUploadingSlot(slot);
    setError("");
    try {
      const body = new FormData();
      body.append("projectId", projectId);
      body.append("slot", slot);
      body.append("image", file);
      const response = await authenticatedFetch("/api/business-preview/images", { method: "POST", body });
      const data = await response.json() as {
        preview?: BusinessPreview;
        overrides?: PreviewOverrides;
        error?: string;
        debug?: { reason?: string; message?: string; bucket?: string; code?: string | number };
      };
      if (!response.ok) {
        const debugHint = data.debug?.reason
          ? ` (${data.debug.reason}${data.debug.bucket ? `: ${data.debug.bucket}` : ""})`
          : "";
        throw new Error(`${data.error || "Unable to upload that photo."}${process.env.NODE_ENV === "development" ? debugHint : ""}`);
      }
      if (data.preview) setPreview(data.preview);
      if (data.overrides) {
        setSavedOverrides(data.overrides);
        setDraftOverrides((current) => ({
          ...current,
          heroImage: data.overrides?.heroImage,
          secondaryImage: data.overrides?.secondaryImage,
          businessVideo: data.overrides?.businessVideo,
        }));
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload that photo.");
    } finally {
      setUploadingSlot(null);
      const input = slot === "hero" ? mainPhotoInputRef.current : secondPhotoInputRef.current;
      if (input) input.value = "";
    }
  }

  async function uploadBusinessVideo(file: File) {
    if (!projectId || uploadingSlot) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("That video is too large. Use a file under 50 MB.");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setUploadingSlot("video");
    setError("");
    try {
      const signResponse = await authenticatedFetch("/api/business-preview/videos/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, contentType: file.type, byteSize: file.size }),
      });
      const signData = await signResponse.json() as {
        uploadUrl?: string;
        objectPath?: string;
        contentType?: string;
        requiredHeaders?: Record<string, string>;
        error?: string;
      };
      if (!signResponse.ok) throw new Error(signData.error || "Unable to start that video upload.");
      if (!signData.uploadUrl || !signData.objectPath || !signData.requiredHeaders) {
        throw new Error("Unable to start that video upload.");
      }
      const putResponse = await fetch(signData.uploadUrl, {
        method: "PUT",
        headers: signData.requiredHeaders,
        body: file,
      });
      if (!putResponse.ok) throw new Error("Unable to upload that video. Please try again.");
      const finalizeResponse = await authenticatedFetch("/api/business-preview/videos/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          objectPath: signData.objectPath,
          contentType: signData.contentType,
        }),
      });
      const data = await finalizeResponse.json() as {
        preview?: BusinessPreview;
        overrides?: PreviewOverrides;
        error?: string;
      };
      if (!finalizeResponse.ok) throw new Error(data.error || "Unable to save that video.");
      if (data.preview) setPreview(data.preview);
      if (data.overrides) {
        setSavedOverrides(data.overrides);
        setDraftOverrides((current) => ({
          ...current,
          heroImage: data.overrides?.heroImage,
          secondaryImage: data.overrides?.secondaryImage,
          businessVideo: data.overrides?.businessVideo,
        }));
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload that video.");
    } finally {
      setUploadingSlot(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  async function updatePublication(method: "POST" | "DELETE") {
    if (!projectId || publishing) return;
    setPublishing(true); setError("");
    try {
      const response = await authenticatedFetch("/api/business-publications", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update your live business.");
      setPublication(data.publication as Publication);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to update your live business.");
    } finally { setPublishing(false); }
  }

  if (!projectId) return <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] p-6 text-center text-red-700">Open a valid business project.</main>;
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] text-[#606A64]">Opening your business preview...</main>;
  if (!preview) return <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] p-6 text-center text-red-700">{error || "This preview is not available."}</main>;

  const brand = preview.brand;
  const website = preview.website;
  const renderedSections = renderedBusinessPreviewSections(preview);
  const visualContext = { industry: preview.business.industry, description: preview.business.description };
  const showVisuals = visualIntensity !== "none";
  const heroVisual = resolveBusinessVisual({ slot: "hero", ...visualContext, uploadedSrc: uploadedSrcFromRecord(website, "hero") });
  const aboutVisual = resolveBusinessVisual({ slot: "about", ...visualContext, uploadedSrc: uploadedSrcFromRecord(website, "about") });
  const ctaVisual = resolveBusinessVisual({ slot: "social", ...visualContext, uploadedSrc: uploadedSrcFromRecord(website, "social") });
  const showcaseVisuals = businessShowcaseVisuals({ ...visualContext, count: 4, uploadedSrcs: [uploadedSrcFromRecord(website, "showcase")] });
  return (
    <main className="min-h-screen bg-[#F7F4EC] px-4 py-6 text-[#1B211E] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[28px] border border-[#D8DCCF] bg-[#FCFBF7] p-6 shadow-[0_18px_60px_rgba(40,52,45,0.07)] sm:p-8">
          <nav aria-label="Business preview sections" className="flex flex-wrap gap-2 text-sm font-semibold text-[#173D32]">
            {renderedSections.map((section) => <a key={section.id} href={section.href} className="rounded-full border border-[#D8DCCF] bg-white px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">{section.label}</a>)}
            <a href="#contact-social" className="rounded-full border border-[#D8DCCF] bg-white px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">Contact &amp; Social</a>
          </nav>
          <div className="mt-8 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8A713F]">Business Preview</p>
              <h1 className="mt-3 text-[clamp(2.6rem,7vw,5.4rem)] font-semibold leading-none tracking-[-0.06em] text-[#173D32]">{preview.business.name}</h1>
              <p className="mt-5 text-xl text-[#606A64]">Here&apos;s how your business is coming together.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-sm text-[#4F5C55]">
                {preview.business.industry && <span className="rounded-full bg-[#EEE9DC] px-4 py-2">{preview.business.industry}</span>}
                {preview.business.goal && <span className="rounded-full bg-[#EEE9DC] px-4 py-2">{preview.business.goal}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" aria-expanded={editing} onClick={(event) => { event.preventDefault(); startEditing(); }} disabled={editing} className="inline-flex min-h-12 items-center rounded-[14px] border border-[#A8B8A7] bg-white px-6 font-semibold text-[#173D32] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">Edit</button>
              <button type="button" disabled={editing || approving || preview.approval.approved} onClick={() => void approvePreview()} className="min-h-12 rounded-[14px] bg-[#173D32] px-6 font-semibold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-4">{editing ? "Save before approval" : preview.approval.approved ? "Preview Approved" : approving ? "Approving..." : "Approve Preview"}</button>
            </div>
          </div>
          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </header>

        {!editing && <section className="mt-5 flex flex-col justify-between gap-5 rounded-[24px] border border-[#D8DCCF] bg-white p-5 sm:flex-row sm:items-center sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A713F]">Your business page</p><p className="mt-2 text-lg font-semibold text-[#173D32]">{publication.canPublish === false ? "Private preview" : publication.status === "active" ? preview.approval.approved ? "Published" : "Changes awaiting approval" : "Not published"}</p>{publication.canPublish === false && <p className="mt-2 text-sm text-[#606A64]">Subscribe to publish, share a public URL, download or use weekly reports and automations.</p>}</div><div className="flex flex-wrap gap-3">{publication.status === "active" && publication.publicUrl && <Link href={publication.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-[#A8B8A7] px-5 font-semibold text-[#173D32]">View Live Business</Link>}{preview.approval.approved && publication.canPublish !== false && <button type="button" disabled={publishing} onClick={() => void updatePublication("POST")} className="min-h-11 rounded-xl bg-[#173D32] px-5 font-semibold text-white disabled:opacity-60">{publishing ? "Publishing..." : "Publish My Business"}</button>}{preview.approval.approved && publication.canPublish === false && <Link href="/billing" className="inline-flex min-h-11 items-center rounded-xl bg-[#173D32] px-5 font-semibold text-white">Subscribe to Publish</Link>}{publication.status === "active" && <button type="button" disabled={publishing} onClick={() => void updatePublication("DELETE")} className="min-h-11 rounded-xl px-5 font-semibold text-[#8A4B3D] disabled:opacity-60">Unpublish</button>}<Link href={`/master-workspace?projectId=${encodeURIComponent(projectId)}`} className="inline-flex min-h-11 items-center px-3 font-semibold text-[#28705E]">Back to Business Workspace</Link></div></section>}

        {!editing && <section id="contact-social" className="mt-5 rounded-[24px] border border-[#D8DCCF] bg-white p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A713F]">Contact &amp; Social</p><h2 className="mt-2 text-2xl font-semibold text-[#173D32]">How can customers contact you?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#606A64]">Only details you enter and save here are approved for your public page. Your private account email and phone are never published automatically. The secure enquiry form remains available even if you add no direct details.</p><form onSubmit={saveContactSettings} className="mt-6 grid gap-4 sm:grid-cols-2">{PUBLIC_CONTACT_FIELDS.map((field) => <label key={field} className="text-sm font-semibold capitalize text-[#173D32]">{field === "linkedin" ? "LinkedIn URL" : field === "instagram" || field === "facebook" || field === "website" ? `${field} URL` : field === "location" ? "Location / service area" : `Public ${field}`}<input type={field === "email" ? "email" : field === "phone" || field === "whatsapp" ? "tel" : field === "location" ? "text" : "url"} value={contact[field] ?? ""} placeholder={field === "whatsapp" || field === "phone" ? "+919876543210" : undefined} onChange={(event) => setContact((current) => ({ ...current, [field]: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#C7CDBF] px-4 py-3 font-normal" /></label>)}<div className="sm:col-span-2"><button type="submit" disabled={savingContact} className="min-h-11 rounded-xl bg-[#173D32] px-5 font-semibold text-white disabled:opacity-60">{savingContact ? "Saving…" : "Save approved contact details"}</button>{contactStatus && <p role="status" className="mt-3 text-sm text-[#606A64]">{contactStatus}</p>}</div></form></section>}

        {editing && originalPreview && <section aria-label="Edit Preview" className="sticky top-3 z-20 mt-5 rounded-[26px] border border-[#A8B8A7] bg-white/95 p-5 shadow-xl backdrop-blur sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A713F]">Edit Preview</p><h2 className="mt-2 text-2xl font-semibold text-[#173D32]">Make simple text changes</h2><p className="mt-2 text-sm text-[#606A64]">Your generated originals stay unchanged.</p></div></div><div className="mt-6 grid max-h-[48vh] gap-4 overflow-y-auto pr-1 md:grid-cols-2">{(Object.keys(PREVIEW_EDIT_RULES) as PreviewEditableField[]).map((field) => { const baseline = previewFieldValue(originalPreview, field); if (!baseline) return null; const rule = PREVIEW_EDIT_RULES[field]; const edited = Object.hasOwn(draftOverrides, field); return <label key={field} className="block rounded-2xl border border-[#E4E5DD] bg-[#FCFBF7] p-4"><span className="flex items-center justify-between gap-3 text-sm font-semibold text-[#173D32]"><span>{rule.label}</span>{edited && <span className="text-xs font-medium text-[#8A713F]">Edited</span>}</span><textarea value={draftOverrides[field] ?? baseline} maxLength={rule.maximum} rows={field.includes("title") || field.includes("Headline") || field.includes("Cta") || field === "brand.tagline" ? 2 : 4} onChange={(event) => updateDraft(field, event.target.value)} className="mt-3 w-full resize-y rounded-xl border border-[#C7CDBF] bg-white p-3 text-sm leading-6 text-[#1B211E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]" /><span className="mt-1 block text-right text-xs text-[#7B847E]">{(draftOverrides[field] ?? baseline).length}/{rule.maximum}</span></label>; })}</div><div className="mt-5 flex flex-wrap gap-3 border-t border-[#E4E5DD] pt-5"><button type="button" disabled={saving} onClick={() => void saveChanges()} className="min-h-11 rounded-xl bg-[#173D32] px-5 font-semibold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-2">{saving ? "Saving..." : "Save Changes"}</button><button type="button" disabled={saving} onClick={cancelEditing} className="min-h-11 rounded-xl border border-[#A8B8A7] bg-white px-5 font-semibold text-[#173D32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">Cancel</button><button type="button" disabled={saving} onClick={resetToOriginal} className="min-h-11 rounded-xl px-5 font-semibold text-[#8A4B3D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A4B3D]">Reset to Original</button></div></section>}

        {brand && <section id="brand" className="scroll-mt-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8A713F]">Brand</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[30px] bg-[#173D32] p-7 text-white sm:p-10">
              <p className="text-sm uppercase tracking-[0.22em] text-white/60">Your brand direction</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">{brand.name}</h2>
              <OptionalText value={brand.tagline} className="mt-5 max-w-2xl text-xl leading-8 text-white/80" />
              {brand.colours.length > 0 && <div className="mt-8 flex flex-wrap gap-3" aria-label="Brand colours">{brand.colours.map((colour) => <div key={colour} className="flex items-center gap-2 rounded-full bg-white/10 py-2 pl-2 pr-4"><span className="h-8 w-8 rounded-full border border-white/30" style={{ backgroundColor: colour }} /><span className="text-xs">{colour}</span></div>)}</div>}
            </div>
            <div className="space-y-4">
              {brand.typography && <div className="rounded-[24px] border border-[#D8DCCF] bg-white p-6"><h3 className="font-semibold text-[#173D32]">Typography direction</h3><OptionalText value={brand.typography} className="mt-3 text-sm leading-6 text-[#606A64]" /></div>}
              {brand.voice && <div className="rounded-[24px] border border-[#D8DCCF] bg-white p-6"><h3 className="font-semibold text-[#173D32]">How your brand sounds</h3><OptionalText value={brand.voice} className="mt-3 text-sm leading-6 text-[#606A64]" /></div>}
              {brand.logoConcept && <div className="rounded-[24px] border border-dashed border-[#A8B8A7] bg-[#EEE9DC] p-6"><h3 className="font-semibold text-[#173D32]">Logo concept</h3><OptionalText value={brand.logoConcept} className="mt-3 text-sm leading-6 text-[#606A64]" /><p className="mt-3 text-xs text-[#7B847E]">Concept preview only — no logo asset was generated.</p></div>}
            </div>
          </div>
        </section>}

        {website && <section id="website" className="scroll-mt-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8A713F]">Website</p><h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#173D32]">Homepage direction</h2></div><div className="flex rounded-xl border border-[#D8DCCF] bg-white p-1" aria-label="Preview viewport">{(["desktop", "tablet", "mobile"] as Viewport[]).map((mode) => <button key={mode} type="button" aria-pressed={viewport === mode} onClick={() => setViewport(mode)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] ${viewport === mode ? "bg-[#173D32] text-white" : "text-[#606A64]"}`}>{mode}</button>)}</div></div>
          <div className="mt-6 rounded-[24px] border border-[#D8DCCF] bg-white p-5 sm:p-6">
  <div>
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A713F]">
      Customize Website
    </p>
    <h3 className="mt-2 text-xl font-semibold text-[#173D32]">
      Choose how your website should look
    </h3>
    <p className="mt-1 text-sm text-[#606A64]">
      Change the style, colours and background without regenerating your business.
    </p>
  </div>

  <div className="mt-6 grid gap-6 lg:grid-cols-2">
    <div>
      <p className="text-sm font-semibold text-[#173D32]">Website Style</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["minimal", "modern", "luxury", "bold"] as const).map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => setWebsiteStyle(style)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${
              websiteStyle === style
                ? "border-[#173D32] bg-[#173D32] text-white"
                : "border-[#D8DCCF] bg-white text-[#173D32]"
            }`}
          >
            {style}
          </button>
        ))}
      </div>
    </div>

    <div>
      <p className="text-sm font-semibold text-[#173D32]">Colour Palette</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            "modern-green",
            "luxury-dark",
            "minimal-light",
            "warm-earth",
            "bold-business",
          ] as const
        ).map((theme) => (
          <button
            key={theme}
            type="button"
            onClick={() => setColorTheme(theme)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${
              colorTheme === theme
                ? "border-[#173D32] bg-[#173D32] text-white"
                : "border-[#D8DCCF] bg-white text-[#173D32]"
            }`}
          >
            {theme.replace(/-/g, " ")}
          </button>
        ))}
      </div>
    </div>

    <div>
      <p className="text-sm font-semibold text-[#173D32]">Background Style</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["clean", "industry", "gradient", "pattern"] as const).map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => setBackgroundStyle(style)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${
              backgroundStyle === style
                ? "border-[#173D32] bg-[#173D32] text-white"
                : "border-[#D8DCCF] bg-white text-[#173D32]"
            }`}
          >
            {style}
          </button>
        ))}
      </div>
    </div>

    <div>
      <p className="text-sm font-semibold text-[#173D32]">Visual Intensity</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["none", "subtle", "medium"] as const).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setVisualIntensity(level)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${
              visualIntensity === level
                ? "border-[#173D32] bg-[#173D32] text-white"
                : "border-[#D8DCCF] bg-white text-[#173D32]"
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  </div>
</div>
          <div className="mt-7 overflow-x-auto rounded-[28px] bg-[#D8DCCF]/55 p-3 sm:p-6">
            {publication.canPublish === false && <div className="mx-auto mb-4 rounded-xl border border-[#D8C28F] bg-[#FFF8E7] px-4 py-3 text-center text-sm font-semibold text-[#6F5725]">Buzypeezy Preview — Subscribe to Publish</div>}
            <div
  className={`mx-auto overflow-hidden shadow-xl transition-all duration-300 ${VIEWPORT_WIDTH[viewport]}`}
  style={{
    backgroundColor: siteTheme.surface,
    color: siteTheme.text,
    borderRadius:
      websiteStyle === "minimal"
        ? "10px"
        : websiteStyle === "luxury"
          ? "30px"
          : websiteStyle === "bold"
            ? "18px"
            : "22px",
    backgroundImage:
      backgroundStyle === "clean" || visualOpacity === 0
        ? "none"
        : backgroundStyle === "gradient"
          ? `linear-gradient(135deg, ${siteTheme.background}, ${siteTheme.surface})`
          : backgroundStyle === "pattern"
            ? `repeating-linear-gradient(45deg, transparent 0 22px, color-mix(in srgb, ${siteTheme.accent} ${Math.round(
                visualOpacity * 100,
              )}%, transparent) 22px 23px)`
            : `repeating-linear-gradient(0deg, color-mix(in srgb, ${siteTheme.accent} ${Math.round(
                visualOpacity * 100,
              )}%, transparent) 0 1px, transparent 1px 32px),
               repeating-linear-gradient(90deg, color-mix(in srgb, ${siteTheme.accent} ${Math.round(
                 visualOpacity * 100,
               )}%, transparent) 0 1px, transparent 1px 32px)`,
  }}
>
              <div className="flex items-center justify-between border-b border-[#E8E5DC] px-5 py-4"><strong className="text-[#173D32]">{preview.business.name}</strong><span className="text-xs text-[#606A64]">Home&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span></div>
              <div className="grid items-center overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
  <div
  className="relative px-6 py-14 sm:px-10 sm:py-20"
  style={{
    background: `linear-gradient(165deg, ${siteTheme.primary} 0%, ${siteTheme.primary}F2 100%)`,
    color: "#FFFFFF",
  }}
>
    <div className="relative max-w-xl">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
      Designed around your business
    </p>

    <h3 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
      {website.heroHeadline || preview.business.name}
    </h3>

    <ExpandableText
      value={website.about || website.supportingText}
previewLength={170}
      inverse
      className="mt-5 max-w-2xl text-sm leading-7 text-white/75 sm:text-base"
    />

    {website.primaryCta && (
      <span className="mt-7 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#173D32] shadow-sm">
        {website.primaryCta}
      </span>
    )}
    </div>
  </div>

  <div className="relative p-6 sm:p-8" style={{ backgroundColor: siteTheme.background }}>
    {showVisuals ? (
      <BusinessSiteVisual src={heroVisual.src} alt={heroVisual.alt} interactive overlay className="aspect-[4/3] min-h-52 shadow-xl" roundedClassName="rounded-[1.75rem] border border-black/10" />
    ) : (
      <div className="min-h-52 rounded-[1.75rem] border border-black/10" style={{ backgroundColor: siteTheme.surface }} />
    )}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <input
        ref={mainPhotoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadBusinessPhoto("hero", file);
        }}
      />
      <button
        type="button"
        disabled={Boolean(uploadingSlot)}
        onClick={() => mainPhotoInputRef.current?.click()}
        className="min-h-11 rounded-xl border border-[#A8B8A7] bg-white px-5 text-sm font-semibold text-[#173D32] disabled:opacity-60"
      >
        {uploadingSlot === "hero" ? "Uploading…" : website.heroImage ? "Replace main photo" : "Upload main photo"}
      </button>
      {website.heroImage && <p className="text-sm text-[#606A64]">Main photo is saved with this business.</p>}
    </div>
  </div>
</div>

{showVisuals && (
  <div className="px-6 py-12 sm:px-10" style={{ backgroundColor: siteTheme.surface }}>
    <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A713F]">
          Visual showcase
        </p>

        <h4 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#173D32]">
          Your work should be seen, not just described.
        </h4>

        <p className="mt-3 max-w-md text-sm leading-6 text-[#606A64]">
          Add real project photos, product images, portfolio work or video when available.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={secondPhotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadBusinessPhoto("secondary", file);
            }}
          />
          <button
            type="button"
            disabled={Boolean(uploadingSlot)}
            onClick={() => secondPhotoInputRef.current?.click()}
            className="min-h-11 rounded-xl border border-[#A8B8A7] bg-white px-5 text-sm font-semibold text-[#173D32] disabled:opacity-60"
          >
            {uploadingSlot === "secondary" ? "Uploading…" : website.secondaryImage ? "Replace second photo" : "Upload second photo"}
          </button>
          {website.secondaryImage && <p className="text-sm text-[#606A64]">Second photo is saved with this business.</p>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadBusinessVideo(file);
            }}
          />
          <button
            type="button"
            disabled={Boolean(uploadingSlot)}
            onClick={() => videoInputRef.current?.click()}
            className="min-h-11 rounded-xl border border-[#A8B8A7] bg-white px-5 text-sm font-semibold text-[#173D32] disabled:opacity-60"
          >
            {uploadingSlot === "video" ? "Uploading…" : website.businessVideo ? "Replace business video" : "Upload business video"}
          </button>
          {website.businessVideo && <p className="text-sm text-[#606A64]">Business video is saved with this business.</p>}
        </div>
        {website.businessVideo && (
          <video
            src={website.businessVideo}
            controls
            playsInline
            preload="metadata"
            className="mt-6 w-full rounded-[1.25rem] border border-black/10 bg-black"
          />
        )}
    </div>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-12">
          {showcaseVisuals.map((visual, index) => (
            <div key={`${visual.src}-${index}`} className={`business-site-card overflow-hidden ${index === 0 || index === 3 ? "col-span-2 aspect-[16/9] md:col-span-8 md:aspect-[16/10]" : "aspect-[4/3] md:col-span-4"}`}>
              <BusinessSiteVisual src={visual.src} alt={visual.alt} className="h-full min-h-full" roundedClassName="rounded-[1.25rem]" />
            </div>
          ))}
        </div>
  </div>
)}

{website.services && (
  <div className="px-6 py-12 sm:px-10" style={{ backgroundColor: siteTheme.background }}>
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A713F]">
        What we offer
      </p>
      <h4 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#173D32]">
        Services built around what customers actually need
      </h4>
    </div>

    {website.serviceCards.length > 0 ? (
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {website.serviceCards.map((card, index) => (
          <article
            key={`${card.title}-${card.description}`}
            className="business-site-card overflow-hidden rounded-[24px] border p-0"
style={{
  backgroundColor: siteTheme.surface,
  borderColor: siteTheme.accent,
}}
          >
            {showVisuals && (
              <BusinessSiteVisual
                src={businessServiceVisual({ index, ...visualContext, uploadedSrc: uploadedSrcFromRecord(card, "services") }).src}
                alt=""
                className="h-28"
                roundedClassName="rounded-none"
              />
            )}
            <div className="p-6">
            <div
  className="mb-5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
  style={{ backgroundColor: siteTheme.primary }}
>
              {String(index + 1).padStart(2, "0")}
            </div>

            <h5
  className="font-semibold"
  style={{ color: siteTheme.text }}
>
              {card.title}
            </h5>

            <ExpandableText
              value={card.description}
              previewLength={100}
              className="mt-2 text-sm leading-6"
            />
            </div>
          </article>
        ))}
      </div>
    ) : (
      <ExpandableText
        value={website.services}
        previewLength={260}
        className="mt-6 max-w-3xl text-sm leading-7 text-[#606A64]"
      />
    )}
  </div>
)}

{website.about && (
  <div
    className="px-6 py-12 sm:px-10"
    style={{ backgroundColor: siteTheme.surface }}
  >
    <div
      className="mx-auto grid max-w-5xl overflow-hidden rounded-[24px] border lg:grid-cols-[0.9fr_1.1fr]"
      style={{
        backgroundColor: siteTheme.background,
        borderColor: siteTheme.accent,
        color: siteTheme.text,
      }}
    >
      {showVisuals && <BusinessSiteVisual src={aboutVisual.src} alt={aboutVisual.alt} className="min-h-52 lg:min-h-full" roundedClassName="rounded-none" />}
      <div className="flex flex-col justify-center p-6 sm:p-8">
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em]"
        style={{ color: siteTheme.accent }}
      >
        Our approach
      </p>

      <h4
        className="mt-3 text-2xl font-semibold tracking-[-0.03em]"
        style={{ color: siteTheme.text }}
      >
        Thoughtful work, clear process, better results
      </h4>

      <ExpandableText
        value={website.about}
        previewLength={220}
        className="mt-4 text-sm leading-7"
      />
      </div>
    </div>
  </div>
)}

<div
  className="relative overflow-hidden px-6 py-12 text-center text-white sm:px-10"
  style={{ backgroundColor: siteTheme.primary }}
>
  <div aria-hidden="true" className="business-site-cta-pattern pointer-events-none absolute inset-0 opacity-40" />
  {showVisuals && <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 opacity-25 lg:block"><BusinessSiteVisual src={ctaVisual.src} alt="" className="h-full min-h-full" roundedClassName="rounded-none" /></div>}
  <div className="relative">
  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
    Start your project
  </p>

  <h4 className="mx-auto mt-3 max-w-xl text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
    Ready to turn the idea into something real?
  </h4>

  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/70">
    Tell us what you need and take the next step with the business.
  </p>

  {website.primaryCta && (
    <span
      className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold"
      style={{
        backgroundColor: siteTheme.surface,
        color: siteTheme.text,
      }}
    >
      {website.primaryCta}
    </span>
  )}
  </div>
</div>

<div
  className="px-6 py-4 text-center text-xs"
  style={{
    backgroundColor: siteTheme.background,
    color: siteTheme.text,
  }}
>
  {preview.business.name} · Business preview
</div>
</div>
</div>
</section>}
        {preview.marketing && <section id="marketing" className="scroll-mt-6 py-14" style={{ backgroundColor: siteTheme.background, color: siteTheme.text }}><p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: siteTheme.accent }}>Marketing</p><h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]" style={{ color: siteTheme.text }}>How you can show up</h2><div className="mt-7 grid gap-5 lg:grid-cols-2"><div
  className="rounded-[26px] border p-7"
  style={{
    backgroundColor: siteTheme.surface,
    borderColor: siteTheme.accent,
    color: siteTheme.text,
  }}
><h3 className="text-xl font-semibold" style={{ color: siteTheme.text }}>Positioning</h3><ExpandableText value={preview.marketing.positioning} className="mt-4 text-sm leading-7" />{preview.marketing.audience && <><h3 className="mt-7 font-semibold"style={{ color: siteTheme.text }}>Who it speaks to</h3><ExpandableText value={preview.marketing.audience} className="mt-3 text-sm leading-7 text-[#606A64]" /></>}</div><div className="grid gap-4">{preview.marketing.sections.map((section) => <article
  key={section.key}
  className="rounded-[24px] p-6 text-white"
  style={{ backgroundColor: siteTheme.primary }}
><p className="text-xs uppercase tracking-[0.18em] text-white/55">{section.label}</p><ExpandableText value={section.value} previewLength={180} inverse className="mt-3 text-sm leading-7 text-white/80" /></article>)}</div></div></section>}

        {preview.search && <section id="search" className="scroll-mt-6 py-14" style={{ backgroundColor: siteTheme.background, color: siteTheme.text }}><p className="text-xs font-semibold uppercase tracking-[0.22em]"style={{ color: siteTheme.accent }}>Search</p><h2
  className="mt-3 text-4xl font-semibold tracking-[-0.04em]"
  style={{ color: siteTheme.text }}
>How customers can find you</h2><div className="mt-7 grid gap-5 lg:grid-cols-2"><div
  className="rounded-[26px] border p-7"
  style={{
    backgroundColor: siteTheme.surface,
    borderColor: siteTheme.accent,
    color: siteTheme.text,
  }}
><ExpandableText value={preview.search.positioning} className="text-sm leading-7" />{preview.search.keywordTags.length > 0 && <div className="mt-5 flex flex-wrap gap-2" aria-label="Important search themes">{preview.search.keywordTags.map((keyword) => <span key={keyword} className="rounded-full border px-3 py-2 text-sm" style={{ backgroundColor: siteTheme.surface, borderColor: siteTheme.accent, color: siteTheme.text }}>{keyword}</span>)}</div>}{preview.search.keywords && <details className="mt-4"><summary
  className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
  style={{ color: siteTheme.accent }}
>View saved keyword list</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#606A64]">{preview.search.keywords}</p></details>}</div>{(preview.search.title || preview.search.description) && <div
  className="rounded-[26px] border p-7"
  style={{
    backgroundColor: siteTheme.surface,
    borderColor: siteTheme.accent,
  }}
><p className="text-xs" style={{ color: siteTheme.accent }}>Search preview</p><p className="mt-3 text-xl" style={{ color: siteTheme.text }}>{preview.search.title || preview.business.name}</p><p className="mt-1 text-sm" style={{ color: siteTheme.accent }}>buzypeezy.preview › {preview.business.name.toLowerCase().replace(/\s+/g, "-")}</p><OptionalText value={preview.search.description} className="mt-2 text-sm leading-6" /></div>}</div></section>}

        {preview.journey && (
  <section id="customer-journey" className="scroll-mt-6 py-14" style={{ backgroundColor: siteTheme.background, color: siteTheme.text }}>
    <p
      className="text-xs font-semibold uppercase tracking-[0.22em]"
      style={{ color: siteTheme.accent }}
    >
      Customer Journey
    </p>

    <h2
      className="mt-3 text-4xl font-semibold tracking-[-0.04em]"
      style={{ color: siteTheme.text }}
    >
      From interest to enquiry
    </h2>

    <div className="mt-7 grid gap-5 lg:grid-cols-3">
      {preview.journey.leadAction && (
        <div
          className="rounded-[26px] p-7 text-white"
          style={{ backgroundColor: siteTheme.primary }}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-white/55">
            Primary lead action
          </p>
          <OptionalText
            value={preview.journey.leadAction}
            className="mt-4 text-sm leading-7 text-white/80"
          />
        </div>
      )}

      {preview.journey.enquiryPath && (
        <div
          className="rounded-[26px] border p-7"
          style={{
            backgroundColor: siteTheme.surface,
            borderColor: siteTheme.accent,
            color: siteTheme.text,
          }}
        >
          <p
            className="text-xs uppercase tracking-[0.18em]"
            style={{ color: siteTheme.accent }}
          >
            Enquiry pathway
          </p>
          <OptionalText
            value={preview.journey.enquiryPath}
            className="mt-4 text-sm leading-7"
          />
        </div>
      )}

      {preview.journey.customerJourney && (
        <div
          className="rounded-[26px] border p-7"
          style={{
            backgroundColor: siteTheme.surface,
            borderColor: siteTheme.accent,
            color: siteTheme.text,
          }}
        >
          <p
            className="text-xs uppercase tracking-[0.18em]"
            style={{ color: siteTheme.accent }}
          >
            Customer experience
          </p>
          <OptionalText
            value={preview.journey.customerJourney}
            className="mt-4 text-sm leading-7"
          />
        </div>
      )}
    </div>

    {preview.journey.primaryCta && (
      <div
        className="mt-6 rounded-[26px] p-8 text-center text-white"
        style={{ backgroundColor: siteTheme.primary }}
      >
        <p className="text-sm text-white/65">Your lead invitation</p>
        <p className="mx-auto mt-3 max-w-3xl text-xl font-semibold">
          {preview.journey.primaryCta}
        </p>
      </div>
    )}
  </section>
)}
      </div>
    </main>
  );
}

export default function BusinessPreviewPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F7F4EC]" />}><BusinessPreviewContent /></Suspense>;
}
