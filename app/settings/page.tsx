"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import auth from "@/app/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    setUser(currentUser);
    setCheckingAuth(false);
  }), [router]);

  async function handleSignOut() {
    setSigningOut(true);
    setError("");
    try {
      await signOut(auth);
      window.location.replace("/login");
    } catch {
      setError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  if (checkingAuth || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] text-[#46534D]">Checking your account…</main>;
  }

  return (
    <main className="min-h-screen bg-[#F7F4EC] px-5 py-12 text-[#1B211E] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-semibold text-[#173D32] hover:underline">← Back to Dashboard</Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-[-0.04em] text-[#0E2C24]">Settings</h1>
        <p className="mt-3 text-[#626A64]">Manage your account and access billing or support.</p>

        <section className="mt-10 rounded-[24px] border border-[#173D32]/10 bg-[#FCFBF7] p-6 shadow-[0_16px_45px_rgba(40,52,45,0.06)] sm:p-8">
          <h2 className="text-xl font-semibold text-[#0E2C24]">Account</h2>
          <p className="mt-5 text-sm font-medium text-[#747B76]">Signed-in email</p>
          <p className="mt-1 break-all text-base text-[#27332E]">{user.email ?? "Email unavailable"}</p>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link href="/billing" className="rounded-[20px] border border-[#173D32]/10 bg-[#FCFBF7] p-6 transition hover:border-[#173D32]/30 hover:bg-white"><h2 className="font-semibold text-[#0E2C24]">Plans and Billing</h2><p className="mt-2 text-sm leading-6 text-[#626A64]">View subscription status and available plans.</p></Link>
          <Link href="/contact-support" className="rounded-[20px] border border-[#173D32]/10 bg-[#FCFBF7] p-6 transition hover:border-[#173D32]/30 hover:bg-white"><h2 className="font-semibold text-[#0E2C24]">Contact and Support</h2><p className="mt-2 text-sm leading-6 text-[#626A64]">Get help with your account or subscription.</p></Link>
        </section>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <button type="button" onClick={handleSignOut} disabled={signingOut} className="mt-8 rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">{signingOut ? "Signing out…" : "Sign out"}</button>
      </div>
    </main>
  );
}
