"use client";

import Image from "next/image";
import { useState } from "react";
import type { WebsiteMediaVisual as WebsiteMediaVisualData } from "@/app/lib/business-site-visuals";

export default function WebsiteMediaVisual({
  media,
  className = "",
}: {
  media: WebsiteMediaVisualData;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === media.src) return null;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={media.src}
        alt={media.alt}
        fill
        unoptimized
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        onError={() => setFailedSrc(media.src)}
      />
    </div>
  );
}
