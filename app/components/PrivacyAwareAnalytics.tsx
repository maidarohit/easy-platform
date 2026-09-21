"use client";

import { Analytics } from "@vercel/analytics/next";

export default function PrivacyAwareAnalytics() {
  return <Analytics beforeSend={(event) => {
    // This filter remains installed if a normal-page session navigates to a
    // private preview after the analytics script has already been loaded.
    try {
      return /^\/prospect-preview(?:\/|$)/.test(new URL(event.url).pathname) ? null : event;
    } catch { return null; }
  }} />;
}
