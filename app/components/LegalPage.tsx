import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F7F4EC] px-5 py-12 text-[#1B211E] sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-[#173D32]/10 bg-[#FCFBF7] p-7 shadow-[0_20px_60px_rgba(40,52,45,0.07)] sm:p-12">
        <Link href="/" className="text-sm font-semibold text-[#173D32] hover:underline">← Easy Platform</Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-[-0.04em] text-[#0E2C24] sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-[#747B76]">Last updated: {updated}</p>
        <div className="mt-10 space-y-8 text-base leading-7 text-[#46514B] [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#0E2C24] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </div>
      </article>
    </main>
  );
}
