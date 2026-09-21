import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createProspectPreviewStore } from "@/app/lib/prospect-preview-store";
import WebsiteSiteRenderer from "@/app/dashboard/components/WebsiteSiteRenderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Private concept preview",
  description: "A private, view-only website concept.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function ProspectPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const document = await createProspectPreviewStore().load(token).catch(() => null);
  if (!document) notFound();
  return <main className="min-h-screen bg-white">
    <p className="border-b bg-slate-50 px-6 py-3 text-center text-sm text-slate-700">Private website concept · View only</p>
    {/* Inert suppresses link activation and focus, including renderer branding links.
        No inquiry slug, contact actions, catalogue, editor or matched media is supplied. */}
    <div inert>
      <WebsiteSiteRenderer document={document} pagePath="/" basePath="#" preview
        publicPageOnly={false} editorMode={false} checkoutReady={false} />
    </div>
  </main>;
}
