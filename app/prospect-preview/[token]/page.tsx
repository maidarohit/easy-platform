import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createProspectPreviewStore } from "@/app/lib/prospect-preview-store";
import ProspectConcept from "../ProspectConcept";
import styles from "../concept.module.css";

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
  const snapshot = await createProspectPreviewStore().load(token).catch(() => null);
  if (!snapshot) notFound();
  const { document, render } = snapshot;
  return <ProspectConcept document={document} render={render} className={styles.site} />;
}
