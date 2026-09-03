"use client";

import { useState } from "react";

type BusinessSiteVisualProps = Readonly<{
  src: string;
  alt: string;
  className?: string;
  roundedClassName?: string;
  interactive?: boolean;
  overlay?: boolean;
}>;

export function BusinessSiteVisual({
  src,
  alt,
  className = "",
  roundedClassName = "rounded-[1.5rem]",
  interactive = false,
  overlay = false,
}: BusinessSiteVisualProps) {
  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!normalizedSrc || failedSrc === normalizedSrc) return null;

  return (
    <div className={`business-site-visual relative overflow-hidden ${interactive ? "business-site-card" : ""} ${roundedClassName} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={normalizedSrc} alt={alt} onError={() => setFailedSrc(normalizedSrc)} className="relative h-full w-full object-cover" />
      {overlay && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />}
    </div>
  );
}
