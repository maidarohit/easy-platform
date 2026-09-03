export type BusinessVisualSlot = "hero" | "showcase" | "services" | "about" | "social";
export type BusinessVisualFamily = "digital" | "local" | "product" | "creative" | "consulting" | "professional";
export type WebsiteMediaSlot = "hero" | "work" | "about" | "services";
export type WebsiteMediaSource = "uploaded" | "business" | "matched";
export type WebsiteMediaVisual = { src: string; alt: string; source: WebsiteMediaSource };
export type WebsiteMediaInput = Partial<Record<WebsiteMediaSlot, string | readonly string[] | null>>;
export type ResolvedWebsiteMedia = {
  hero: WebsiteMediaVisual | null;
  work: readonly WebsiteMediaVisual[];
  about: WebsiteMediaVisual | null;
  services: readonly WebsiteMediaVisual[];
};

const VISUALS = {
  analytics: "/business-visuals/analytics.svg",
  workspace: "/business-visuals/workspace.svg",
  collaboration: "/business-visuals/collaboration.svg",
  growth: "/business-visuals/growth.svg",
  social: "/business-visuals/social.svg",
  hospitality: "/business-visuals/hospitality.svg",
  retail: "/business-visuals/retail.svg",
  studio: "/business-visuals/studio.svg",
} as const;

const FAMILY_SET: Readonly<Record<BusinessVisualFamily, readonly string[]>> = {
  digital: [VISUALS.analytics, VISUALS.workspace, VISUALS.collaboration, VISUALS.growth, VISUALS.social],
  consulting: [VISUALS.collaboration, VISUALS.workspace, VISUALS.analytics, VISUALS.growth, VISUALS.social],
  professional: [VISUALS.workspace, VISUALS.collaboration, VISUALS.growth, VISUALS.analytics, VISUALS.social],
  local: [VISUALS.hospitality, VISUALS.collaboration, VISUALS.workspace, VISUALS.growth, VISUALS.social],
  product: [VISUALS.retail, VISUALS.workspace, VISUALS.growth, VISUALS.social, VISUALS.analytics],
  creative: [VISUALS.studio, VISUALS.workspace, VISUALS.collaboration, VISUALS.growth, VISUALS.social],
};

const SLOT_INDEX: Readonly<Record<BusinessVisualSlot, number>> = {
  hero: 0, showcase: 1, about: 2, services: 3, social: 4,
};

const SLOT_ALT: Readonly<Record<BusinessVisualFamily, Readonly<Record<BusinessVisualSlot, string>>>> = {
  digital: {
    hero: "Analytics dashboard illustration",
    showcase: "Laptop workspace and marketing scene",
    about: "Team collaboration illustration",
    services: "Growth and performance chart illustration",
    social: "Social and content strategy visual",
  },
  consulting: {
    hero: "Collaborative strategy illustration",
    showcase: "Professional workspace illustration",
    about: "Team working together",
    services: "Performance and progress illustration",
    social: "Content and communication visual",
  },
  professional: {
    hero: "Professional workspace illustration",
    showcase: "Team collaboration illustration",
    about: "People working together",
    services: "Growth illustration",
    social: "Content strategy visual",
  },
  local: {
    hero: "Warm local business interior",
    showcase: "Welcoming customer experience",
    about: "People together in a local space",
    services: "Thoughtful service illustration",
    social: "Community and content visual",
  },
  product: {
    hero: "Product range illustration",
    showcase: "Workspace for making and presenting products",
    about: "Collaborative product work",
    services: "Growth of a product offer",
    social: "Content and catalogue visual",
  },
  creative: {
    hero: "Creative studio illustration",
    showcase: "Design workspace",
    about: "Collaborative creative work",
    services: "Creative progress illustration",
    social: "Portfolio and content visual",
  },
};

function isUsableUploadedSrc(value: string | null | undefined) {
  if (!value || typeof value !== "string") return false;
  const src = value.trim();
  if (!src || src.length > 2_048) return false;
  if (src.startsWith("/business-visuals/") || src.startsWith("/uploads/") || src.startsWith("/images/")) return true;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return url.hostname === "firebasestorage.googleapis.com"
      || url.hostname.endsWith(".firebasestorage.app")
      || url.hostname === "storage.googleapis.com";
  } catch {
    return false;
  }
}

export { isUsableUploadedSrc as isUsableBusinessUploadedSrc };

const WEBSITE_MATCHES: readonly {
  pattern: RegExp;
  visuals: Partial<Record<WebsiteMediaSlot, readonly [string, string][]>>;
}[] = [
  {
    pattern: /\b(?:digital marketing|marketing agency|seo|saas|software|technology|tech company|analytics|advertising agency|web development)\b/i,
    visuals: {
      hero: [[VISUALS.analytics, "Business analytics and digital growth illustration"]],
      work: [[VISUALS.workspace, "Digital work and project workspace illustration"]],
      about: [[VISUALS.collaboration, "Business team collaboration illustration"]],
      services: [[VISUALS.growth, "Digital growth services illustration"]],
    },
  },
  {
    pattern: /\b(?:consulting|consultant|business coach|advisor|advisory|professional services)\b/i,
    visuals: {
      hero: [[VISUALS.collaboration, "Professional strategy and collaboration illustration"]],
      work: [[VISUALS.growth, "Client results and business progress illustration"]],
      about: [[VISUALS.workspace, "Professional business workspace illustration"]],
      services: [[VISUALS.analytics, "Business advisory and analysis illustration"]],
    },
  },
  {
    pattern: /\b(?:restaurant|cafe|café|bakery|hospitality|hotel|catering)\b/i,
    visuals: { hero: [[VISUALS.hospitality, "Welcoming hospitality business interior illustration"]] },
  },
  {
    pattern: /\b(?:retail|ecommerce|e-commerce|online store|product brand|shop)\b/i,
    visuals: { hero: [[VISUALS.retail, "Retail products and customer shopping illustration"]] },
  },
  {
    pattern: /\b(?:photography|photographer|creative studio|design studio|interior design|artist|art studio)\b/i,
    visuals: { hero: [[VISUALS.studio, "Creative studio and project work illustration"]] },
  },
];

function uploadedMediaValues(value: WebsiteMediaInput[WebsiteMediaSlot]) {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === "string" && isUsableUploadedSrc(item));
}

export function resolveWebsiteMedia(input: Readonly<{
  industry?: string | null;
  description?: string | null;
  uploaded?: WebsiteMediaInput | null;
}>): ResolvedWebsiteMedia {
  const context = `${input.industry ?? ""} ${input.description ?? ""}`;
  const matched = WEBSITE_MATCHES.find((entry) => entry.pattern.test(context));
  const used = new Set<string>();

  const resolveSlot = (slot: WebsiteMediaSlot): WebsiteMediaVisual[] => {
    // Only media explicitly assigned to a semantic slot is eligible. Legacy
    // secondary/gallery uploads have no subject metadata, so they remain saved
    // but are not auto-promoted into Work or About.
    const uploaded = slot === "hero" || slot === "services"
      ? uploadedMediaValues(input.uploaded?.[slot])
      : [];
    const candidates: WebsiteMediaVisual[] = uploaded.map((src) => ({
      src: src.trim(),
      alt: `${slot === "work" ? "Project work" : slot} visual for ${input.industry || "the business"}`,
      source: "uploaded",
    }));
    for (const [src, alt] of matched?.visuals[slot] ?? []) candidates.push({ src, alt, source: "matched" });
    return candidates.filter((visual) => {
      if (used.has(visual.src)) return false;
      used.add(visual.src);
      return true;
    });
  };

  const hero = resolveSlot("hero");
  const work = resolveSlot("work");
  const about = resolveSlot("about");
  const services = resolveSlot("services");
  return { hero: hero[0] ?? null, work, about: about[0] ?? null, services };
}

export function businessVisualFamily(industry?: string | null, description?: string | null): BusinessVisualFamily {
  const context = `${industry ?? ""} ${description ?? ""}`.toLowerCase();
  if (/\b(?:digital|marketing agency|seo|social media|content marketing|analytics|advertising agency|performance marketing|ppc|paid ads?)\b/.test(context)) return "digital";
  if (/artist|art |painting|photograph|creative studio|interior design/.test(context)) return "creative";
  if (/cafe|restaurant|salon|spa|bakery|local shop/.test(context)) return "local";
  if (/shop|store|ecommerce|e-commerce|retail|product brand/.test(context)) return "product";
  if (/consult|coach|advisor|professional service/.test(context)) return "consulting";
  if (/agency|b2b|enterprise/.test(context)) return "digital";
  return "professional";
}

export function uploadedSrcFromRecord(record: unknown, slot: BusinessVisualSlot) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const keys = {
    hero: ["heroImage", "heroImageUrl", "coverImage", "imageUrl"],
    showcase: ["secondaryImage", "showcaseImage", "galleryImage", "imageUrl"],
    services: ["serviceImage", "imageUrl"],
    about: ["aboutImage", "storyImage", "imageUrl"],
    social: ["socialImage", "contentImage", "imageUrl"],
  } as const;
  const source = record as Record<string, unknown>;
  for (const key of keys[slot]) {
    const value = source[key];
    if (typeof value === "string" && isUsableUploadedSrc(value)) return value.trim();
  }
  return null;
}

export function resolveBusinessVisual(input: Readonly<{
  slot: BusinessVisualSlot;
  industry?: string | null;
  description?: string | null;
  uploadedSrc?: string | null;
}>) {
  if (isUsableUploadedSrc(input.uploadedSrc)) {
    return { src: input.uploadedSrc!.trim(), alt: SLOT_ALT.professional[input.slot], source: "uploaded" as const };
  }
  const family = businessVisualFamily(input.industry, input.description);
  return {
    src: FAMILY_SET[family][SLOT_INDEX[input.slot]],
    alt: SLOT_ALT[family][input.slot],
    source: "fallback" as const,
  };
}

export function businessShowcaseVisuals(input: Readonly<{
  industry?: string | null;
  description?: string | null;
  count?: number;
  uploadedSrcs?: readonly (string | null | undefined)[];
}>) {
  const family = businessVisualFamily(input.industry, input.description);
  const count = Math.min(Math.max(input.count ?? 4, 1), 5);
  const set = FAMILY_SET[family];
  const uploaded = (input.uploadedSrcs ?? []).filter(isUsableUploadedSrc);
  return Array.from({ length: count }, (_, index) => {
    const uploadedSrc = uploaded[index];
    if (uploadedSrc) return { src: uploadedSrc, alt: SLOT_ALT[family].showcase, source: "uploaded" as const };
    return {
      src: set[(index + 1) % set.length],
      alt: Object.values(SLOT_ALT[family])[(index + 1) % 5],
      source: "fallback" as const,
    };
  });
}

export function businessServiceVisual(input: Readonly<{
  index: number;
  industry?: string | null;
  description?: string | null;
  uploadedSrc?: string | null;
}>) {
  if (isUsableUploadedSrc(input.uploadedSrc)) {
    return { src: input.uploadedSrc!.trim(), alt: "Service visual", source: "uploaded" as const };
  }
  const family = businessVisualFamily(input.industry, input.description);
  const set = FAMILY_SET[family];
  return { src: set[input.index % set.length], alt: SLOT_ALT[family].services, source: "fallback" as const };
}
