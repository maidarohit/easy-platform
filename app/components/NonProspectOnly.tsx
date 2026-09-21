"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Do not mount global analytics, assistants or billing controls on private links.
export default function NonProspectOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname && /^\/prospect-preview(?:\/|$)/.test(pathname) ? null : children;
}
