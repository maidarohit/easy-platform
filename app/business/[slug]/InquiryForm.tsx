"use client";

import { useState } from "react";

export function InquiryForm({ slug, services, selectedService }: { slug: string; services: readonly string[]; selectedService: string }) {
  const [service, setService] = useState(selectedService); const [status, setStatus] = useState(""); const [sending, setSending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (sending) return; setSending(true); setStatus("");
    const formElement = event.currentTarget; const form = new FormData(formElement);
    const body = { slug, name: form.get("name"), email: form.get("email"), phone: form.get("phone"), service: form.get("service"), message: form.get("message"), company: form.get("company") };
    try {
      const response = await fetch("/api/public-business-inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to send your enquiry.");
      setStatus(data.message); formElement.reset(); setService("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to send your enquiry."); }
    finally { setSending(false); }
  }
  return <form onSubmit={submit} className="rounded-[2rem] bg-white p-6 text-left text-[#1B211E] sm:p-8">
    <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Name<input name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal" /></label><label className="text-sm font-semibold">Email<input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal" /></label><label className="text-sm font-semibold">Phone <span className="font-normal opacity-55">(optional)</span><input name="phone" type="tel" maxLength={32} autoComplete="tel" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal" /></label><label className="text-sm font-semibold">Service / project type<select name="service" value={service} onChange={(event) => setService(event.target.value)} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 font-normal"><option value="">General enquiry</option>{services.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
    <label className="mt-5 block text-sm font-semibold">How can we help?<textarea name="message" required minLength={10} maxLength={2000} rows={5} className="mt-2 w-full resize-y rounded-xl border border-black/15 px-4 py-3 font-normal" /></label><label className="hidden" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
    <button type="submit" disabled={sending} className="mt-5 min-h-12 rounded-full px-7 font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#173D32" }}>{sending ? "Sending…" : "Send enquiry"}</button>{status && <p role="status" className="mt-4 text-sm font-semibold">{status}</p>}
  </form>;
}
