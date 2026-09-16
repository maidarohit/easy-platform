"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { persistentVisitorId, VISITOR_KEY } from "@/app/lib/platform-analytics";

const KEY = "buzypeezy:anonymous-session";
const SESSION_TIMEOUT = 30 * 60 * 1000;

export default function PlatformPageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || /^\/(admin|boss|api)(\/|$)/.test(pathname)) return;
    // Deferring also prevents duplicate effects during React development checks.
    const timer = window.setTimeout(async () => {
      try {
        // Serialize first creation across tabs where Web Locks are available.
        const visitorId = navigator.locks
          ? await navigator.locks.request(VISITOR_KEY, () => persistentVisitorId(localStorage))
          : persistentVisitorId(localStorage);
        const now = Date.now();
        let session: { id: string; lastSeen: number; referrer: string; source: string | null; medium: string | null; campaign: string | null } | null = null;
        try { session = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { /* Start a fresh session. */ }
        if (!session || typeof session.id !== "string" || !Number.isFinite(session.lastSeen) || now - session.lastSeen > SESSION_TIMEOUT) {
          const params = new URLSearchParams(window.location.search);
          session = { id: crypto.randomUUID(), lastSeen: now, referrer: document.referrer,
            source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign") };
        }
        session.lastSeen = now;
        sessionStorage.setItem(KEY, JSON.stringify(session));
        void fetch("/api/platform-analytics/page-view", {
          method: "POST", credentials: "omit", keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathname, visitorId, sessionId: session.id, referrer: session.referrer,
            utm_source: session.source, utm_medium: session.medium, utm_campaign: session.campaign }),
        }).catch(() => undefined);
      } catch { /* Storage restrictions or tracking failures must never affect the page. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  return null;
}
