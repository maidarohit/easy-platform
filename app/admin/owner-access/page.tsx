"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import auth from "@/app/lib/auth";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

export default function OwnerAccessPage() {
  const [message, setMessage] = useState("Checking owner access…");
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      if (!user) { setMessage("Sign in with your Buzypeezy owner account, then return here."); return; }
      try {
        const response = await authenticatedFetch("/api/admin/platform-analytics/access", { method: "POST" });
        if (current !== generation) return;
        if (!response.ok) { setMessage("Access denied. A Buzypeezy platform owner account is required."); return; }
        window.location.replace("/admin/platform-analytics");
      } catch {
        if (current === generation) setMessage("Unable to verify owner access. Please sign in and try again.");
      }
    });
    return () => { generation++; unsubscribe(); };
  }, []);
  return <main className="mx-auto w-full max-w-6xl p-8"><p role="status">{message}</p><Link className="mt-4 inline-block underline" href="/login">Sign in</Link></main>;
}
