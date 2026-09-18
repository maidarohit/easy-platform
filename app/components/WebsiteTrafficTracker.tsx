"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { websiteTrafficIdentity, type PublicationKind } from "@/app/lib/website-traffic";

export default function WebsiteTrafficTracker({ kind, publicationId, slug, pagePath }: { kind: PublicationKind; publicationId: string; slug: string; pagePath: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const expected = `/${kind === 'business' ? 'business' : 'published-sites'}/${encodeURIComponent(slug)}${pagePath === '/' ? '' : pagePath}`;
    if (pathname !== expected) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const site = `${kind}:${publicationId}`;
        const identify = () => websiteTrafficIdentity(localStorage, sessionStorage, site,
          { referrer: document.referrer, search: window.location.search, origin: window.location.origin });
        const identity = navigator.locks ? await navigator.locks.request(`website-traffic:${site}`, identify) : identify();
        if (cancelled) return;
        await fetch('/api/website-traffic/page-view', { method: 'POST', credentials: 'omit', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...identity, eventId: crypto.randomUUID(), kind, slug, pagePath }),
        });
      } catch { /* Tracking must never interrupt a customer website. */ }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pathname, kind, publicationId, slug, pagePath]);
  return null;
}
