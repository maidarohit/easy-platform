import { isUsableBusinessUploadedSrc } from "@/app/lib/business-site-visuals";

export type WorkspaceAtmosphereCategory =
  | "home-interiors"
  | "food-hospitality"
  | "beauty-wellness"
  | "professional-services"
  | "fashion-retail"
  | "technology-startup"
  | "automotive"
  | "fitness"
  | "education"
  | "general-business";

export type WorkspaceAtmosphereInput = Readonly<{
  projectId: string;
  businessName?: string | null;
  industry?: string | null;
  businessDescription?: string | null;
  brandStyle?: string | null;
  brandingOutput?: Record<string, unknown> | null;
  websiteOutput?: Record<string, unknown> | null;
  dayKey: string;
  sceneOffset?: number;
  reducedMotion?: boolean;
}>;

export type WorkspaceAtmosphereScene = Readonly<{
  id: string;
  label: string;
  background: string;
  orbA: string;
  orbB: string;
  orbC: string;
  mist: string;
}>;

export type WorkspaceAtmosphereModel = Readonly<{
  category: WorkspaceAtmosphereCategory;
  scene: WorkspaceAtmosphereScene;
  accentColors: readonly string[];
  image: WorkspaceAtmosphereImage | null;
  motionMode: "ambient" | "static";
}>;

export type WorkspaceAtmosphereImage = Readonly<{
  src: string;
  source: "uploaded" | "curated";
}>;

const SCENES: Readonly<Record<WorkspaceAtmosphereCategory, readonly WorkspaceAtmosphereScene[]>> = {
  "home-interiors": [
    {
      id: "atelier-morning",
      label: "Atelier Morning",
      background: "linear-gradient(140deg, #f6efe2 0%, #ebe1d1 34%, #d6e1db 100%)",
      orbA: "rgba(205, 167, 120, 0.28)",
      orbB: "rgba(108, 140, 127, 0.24)",
      orbC: "rgba(241, 223, 189, 0.36)",
      mist: "rgba(255, 248, 238, 0.56)",
    },
    {
      id: "gallery-stone",
      label: "Gallery Stone",
      background: "linear-gradient(145deg, #f4f1ec 0%, #e6dfd7 42%, #d9e5e0 100%)",
      orbA: "rgba(180, 145, 103, 0.26)",
      orbB: "rgba(129, 155, 142, 0.2)",
      orbC: "rgba(255, 250, 243, 0.38)",
      mist: "rgba(250, 246, 240, 0.58)",
    },
    {
      id: "lounge-sage",
      label: "Lounge Sage",
      background: "linear-gradient(155deg, #f7f2e8 0%, #e3ddd1 36%, #d7e6dd 100%)",
      orbA: "rgba(170, 135, 93, 0.24)",
      orbB: "rgba(90, 126, 112, 0.22)",
      orbC: "rgba(255, 244, 225, 0.34)",
      mist: "rgba(249, 246, 240, 0.54)",
    },
  ],
  "food-hospitality": [
    {
      id: "copper-bistro",
      label: "Copper Bistro",
      background: "linear-gradient(145deg, #fbf2e9 0%, #f1d7bd 40%, #dbe7dd 100%)",
      orbA: "rgba(193, 111, 58, 0.28)",
      orbB: "rgba(126, 141, 93, 0.22)",
      orbC: "rgba(255, 228, 185, 0.34)",
      mist: "rgba(255, 248, 239, 0.56)",
    },
    {
      id: "olive-table",
      label: "Olive Table",
      background: "linear-gradient(150deg, #faf2e8 0%, #e7d7b3 36%, #dbe7d8 100%)",
      orbA: "rgba(173, 116, 58, 0.24)",
      orbB: "rgba(99, 126, 88, 0.24)",
      orbC: "rgba(255, 233, 196, 0.34)",
      mist: "rgba(255, 247, 235, 0.58)",
    },
    {
      id: "night-cafe",
      label: "Night Cafe",
      background: "linear-gradient(155deg, #f8eee5 0%, #ecd2c0 38%, #d8e3dd 100%)",
      orbA: "rgba(128, 74, 52, 0.28)",
      orbB: "rgba(110, 137, 120, 0.2)",
      orbC: "rgba(255, 224, 176, 0.28)",
      mist: "rgba(251, 244, 236, 0.55)",
    },
  ],
  "beauty-wellness": [
    {
      id: "spa-bloom",
      label: "Spa Bloom",
      background: "linear-gradient(145deg, #fbf0ee 0%, #f0dedf 40%, #deebe3 100%)",
      orbA: "rgba(204, 150, 152, 0.28)",
      orbB: "rgba(127, 165, 145, 0.2)",
      orbC: "rgba(247, 223, 225, 0.34)",
      mist: "rgba(255, 248, 250, 0.56)",
    },
    {
      id: "linen-serenity",
      label: "Linen Serenity",
      background: "linear-gradient(150deg, #fcf4ef 0%, #eedccf 34%, #d9ebe0 100%)",
      orbA: "rgba(214, 175, 149, 0.24)",
      orbB: "rgba(122, 163, 147, 0.22)",
      orbC: "rgba(255, 232, 222, 0.34)",
      mist: "rgba(255, 247, 242, 0.58)",
    },
    {
      id: "botanical-glow",
      label: "Botanical Glow",
      background: "linear-gradient(150deg, #faf1ec 0%, #f0e2db 38%, #d7e8df 100%)",
      orbA: "rgba(196, 151, 124, 0.24)",
      orbB: "rgba(104, 154, 130, 0.24)",
      orbC: "rgba(250, 220, 225, 0.32)",
      mist: "rgba(253, 247, 243, 0.56)",
    },
  ],
  "professional-services": [
    {
      id: "boardroom-light",
      label: "Boardroom Light",
      background: "linear-gradient(145deg, #f4f0e8 0%, #dde5e5 44%, #d2ddd8 100%)",
      orbA: "rgba(123, 147, 167, 0.22)",
      orbB: "rgba(80, 113, 112, 0.18)",
      orbC: "rgba(233, 214, 181, 0.28)",
      mist: "rgba(248, 246, 242, 0.56)",
    },
    {
      id: "gold-standard",
      label: "Gold Standard",
      background: "linear-gradient(150deg, #f7f1e8 0%, #e8dfcf 38%, #d5e2dc 100%)",
      orbA: "rgba(170, 144, 100, 0.24)",
      orbB: "rgba(89, 117, 124, 0.18)",
      orbC: "rgba(250, 236, 205, 0.32)",
      mist: "rgba(250, 247, 241, 0.58)",
    },
    {
      id: "glass-office",
      label: "Glass Office",
      background: "linear-gradient(140deg, #f2efe9 0%, #e0e6e6 42%, #d6ddd9 100%)",
      orbA: "rgba(126, 149, 173, 0.2)",
      orbB: "rgba(111, 130, 121, 0.18)",
      orbC: "rgba(231, 220, 194, 0.3)",
      mist: "rgba(247, 248, 245, 0.57)",
    },
  ],
  "fashion-retail": [
    {
      id: "runway-ivory",
      label: "Runway Ivory",
      background: "linear-gradient(145deg, #f8f1eb 0%, #ead8d4 38%, #dce4df 100%)",
      orbA: "rgba(181, 123, 122, 0.24)",
      orbB: "rgba(124, 126, 137, 0.18)",
      orbC: "rgba(241, 218, 185, 0.32)",
      mist: "rgba(255, 248, 243, 0.56)",
    },
    {
      id: "atelier-rose",
      label: "Atelier Rose",
      background: "linear-gradient(150deg, #fbf2ed 0%, #efddd8 36%, #dbe6e0 100%)",
      orbA: "rgba(194, 139, 146, 0.26)",
      orbB: "rgba(111, 120, 124, 0.18)",
      orbC: "rgba(248, 228, 209, 0.32)",
      mist: "rgba(255, 248, 244, 0.58)",
    },
    {
      id: "midnight-boutique",
      label: "Midnight Boutique",
      background: "linear-gradient(150deg, #f7ecea 0%, #e1d0d6 40%, #d7e1de 100%)",
      orbA: "rgba(112, 92, 115, 0.24)",
      orbB: "rgba(100, 122, 118, 0.18)",
      orbC: "rgba(244, 208, 189, 0.28)",
      mist: "rgba(252, 244, 242, 0.56)",
    },
  ],
  "technology-startup": [
    {
      id: "signal-grid",
      label: "Signal Grid",
      background: "linear-gradient(145deg, #eff4f3 0%, #d9e9e7 34%, #d7e0ea 100%)",
      orbA: "rgba(68, 153, 154, 0.24)",
      orbB: "rgba(91, 122, 176, 0.22)",
      orbC: "rgba(209, 234, 233, 0.34)",
      mist: "rgba(244, 249, 249, 0.54)",
    },
    {
      id: "cloud-logic",
      label: "Cloud Logic",
      background: "linear-gradient(150deg, #f1f5f4 0%, #dbe8ef 38%, #d7e4df 100%)",
      orbA: "rgba(77, 132, 190, 0.2)",
      orbB: "rgba(59, 146, 136, 0.2)",
      orbC: "rgba(210, 230, 246, 0.32)",
      mist: "rgba(246, 250, 249, 0.56)",
    },
    {
      id: "teal-circuit",
      label: "Teal Circuit",
      background: "linear-gradient(150deg, #eef3f1 0%, #d7e7e2 38%, #d8dfee 100%)",
      orbA: "rgba(54, 162, 154, 0.22)",
      orbB: "rgba(98, 110, 181, 0.2)",
      orbC: "rgba(198, 232, 228, 0.34)",
      mist: "rgba(245, 249, 247, 0.56)",
    },
  ],
  automotive: [
    {
      id: "studio-slate",
      label: "Studio Slate",
      background: "linear-gradient(145deg, #f2efea 0%, #dde1e4 38%, #d5d9dc 100%)",
      orbA: "rgba(111, 124, 136, 0.24)",
      orbB: "rgba(61, 108, 122, 0.2)",
      orbC: "rgba(222, 214, 201, 0.34)",
      mist: "rgba(247, 245, 241, 0.54)",
    },
    {
      id: "chrome-motion",
      label: "Chrome Motion",
      background: "linear-gradient(150deg, #f4f1ed 0%, #e4e6e9 36%, #d4dade 100%)",
      orbA: "rgba(94, 111, 126, 0.24)",
      orbB: "rgba(55, 123, 140, 0.2)",
      orbC: "rgba(231, 224, 214, 0.3)",
      mist: "rgba(248, 246, 243, 0.56)",
    },
    {
      id: "velocity-shell",
      label: "Velocity Shell",
      background: "linear-gradient(155deg, #f5f2ee 0%, #dfe4e9 42%, #d8dddf 100%)",
      orbA: "rgba(89, 105, 128, 0.22)",
      orbB: "rgba(96, 130, 114, 0.18)",
      orbC: "rgba(235, 224, 206, 0.28)",
      mist: "rgba(248, 247, 243, 0.58)",
    },
  ],
  fitness: [
    {
      id: "momentum-mint",
      label: "Momentum Mint",
      background: "linear-gradient(145deg, #f0f4ee 0%, #dbebdf 36%, #d8e5e1 100%)",
      orbA: "rgba(82, 170, 132, 0.22)",
      orbB: "rgba(80, 128, 118, 0.2)",
      orbC: "rgba(205, 236, 223, 0.32)",
      mist: "rgba(245, 249, 245, 0.56)",
    },
    {
      id: "pulse-sunrise",
      label: "Pulse Sunrise",
      background: "linear-gradient(150deg, #f8f1e6 0%, #f0ddc5 34%, #d8e7dc 100%)",
      orbA: "rgba(210, 144, 88, 0.24)",
      orbB: "rgba(74, 154, 120, 0.2)",
      orbC: "rgba(255, 229, 191, 0.3)",
      mist: "rgba(252, 247, 238, 0.55)",
    },
    {
      id: "focus-court",
      label: "Focus Court",
      background: "linear-gradient(150deg, #eff2ed 0%, #dde7d8 38%, #d5e1e4 100%)",
      orbA: "rgba(117, 172, 96, 0.2)",
      orbB: "rgba(82, 132, 155, 0.2)",
      orbC: "rgba(212, 235, 205, 0.3)",
      mist: "rgba(246, 249, 244, 0.55)",
    },
  ],
  education: [
    {
      id: "library-glow",
      label: "Library Glow",
      background: "linear-gradient(145deg, #f4efe7 0%, #e5decc 36%, #d7e2dd 100%)",
      orbA: "rgba(164, 126, 81, 0.24)",
      orbB: "rgba(95, 131, 143, 0.18)",
      orbC: "rgba(241, 227, 188, 0.32)",
      mist: "rgba(249, 246, 240, 0.57)",
    },
    {
      id: "campus-sky",
      label: "Campus Sky",
      background: "linear-gradient(150deg, #f0f3f4 0%, #dfe8ef 38%, #d9e5de 100%)",
      orbA: "rgba(107, 142, 192, 0.2)",
      orbB: "rgba(91, 137, 125, 0.18)",
      orbC: "rgba(219, 232, 247, 0.3)",
      mist: "rgba(245, 249, 249, 0.56)",
    },
    {
      id: "scholar-stone",
      label: "Scholar Stone",
      background: "linear-gradient(150deg, #f5f0e8 0%, #e8dfd2 38%, #d8e2df 100%)",
      orbA: "rgba(146, 117, 78, 0.22)",
      orbB: "rgba(92, 126, 116, 0.18)",
      orbC: "rgba(240, 229, 204, 0.32)",
      mist: "rgba(248, 246, 240, 0.57)",
    },
  ],
  "general-business": [
    {
      id: "buzypeezy-neutral",
      label: "Buzypeezy Neutral",
      background: "linear-gradient(145deg, #f7f4ec 0%, #edf3eb 42%, #e9f0f0 100%)",
      orbA: "rgba(184, 154, 97, 0.2)",
      orbB: "rgba(46, 117, 99, 0.18)",
      orbC: "rgba(123, 200, 216, 0.2)",
      mist: "rgba(252, 251, 248, 0.58)",
    },
    {
      id: "green-gold-suite",
      label: "Green Gold Suite",
      background: "linear-gradient(150deg, #f8f5ed 0%, #ebe5d8 36%, #e4f0ea 100%)",
      orbA: "rgba(166, 137, 75, 0.22)",
      orbB: "rgba(55, 125, 97, 0.18)",
      orbC: "rgba(208, 230, 223, 0.28)",
      mist: "rgba(252, 250, 246, 0.58)",
    },
    {
      id: "calm-command",
      label: "Calm Command",
      background: "linear-gradient(150deg, #f6f2e9 0%, #e8e2d3 36%, #deece8 100%)",
      orbA: "rgba(165, 141, 97, 0.22)",
      orbB: "rgba(64, 120, 117, 0.18)",
      orbC: "rgba(201, 226, 229, 0.28)",
      mist: "rgba(251, 249, 245, 0.57)",
    },
  ],
};

const CATEGORY_KEYWORDS: ReadonlyArray<readonly [WorkspaceAtmosphereCategory, readonly string[]]> = [
  ["home-interiors", ["interior", "furniture", "decor", "home", "real estate", "property", "architecture", "staging", "construction"]],
  ["food-hospitality", ["restaurant", "cafe", "coffee", "bakery", "food", "kitchen", "catering", "hospitality", "bar", "dining"]],
  ["beauty-wellness", ["salon", "spa", "beauty", "wellness", "skincare", "cosmetic", "hair", "therapy", "massage"]],
  ["fashion-retail", ["fashion", "boutique", "retail", "apparel", "jewelry", "lifestyle", "ecommerce", "store"]],
  ["technology-startup", ["software", "technology", "tech", "startup", "saas", "ai", "automation", "platform", "app", "digital"]],
  ["automotive", ["automotive", "auto", "car", "garage", "detailing", "repair", "vehicle", "transport"]],
  ["fitness", ["fitness", "gym", "training", "yoga", "pilates", "nutrition", "sports", "coach"]],
  ["education", ["education", "school", "academy", "course", "training center", "tutor", "learning", "student"]],
  ["professional-services", ["consult", "consulting", "agency", "legal", "finance", "account", "insurance", "b2b", "advisory"]],
];

const CURATED_CATEGORY_IMAGES: Readonly<Record<WorkspaceAtmosphereCategory, readonly WorkspaceAtmosphereImage[]>> = {
  "home-interiors": [],
  "food-hospitality": [],
  "beauty-wellness": [],
  "professional-services": [],
  "fashion-retail": [],
  "technology-startup": [],
  automotive: [],
  fitness: [],
  education: [],
  "general-business": [],
};

function normalizedText(parts: ReadonlyArray<string | null | undefined>) {
  return parts
    .map((part) => typeof part === "string" ? part.trim().toLowerCase() : "")
    .filter(Boolean)
    .join(" ");
}

function containsKeyword(text: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(text);
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function uniqueHexColors(source: string) {
  const matches = source.match(/#[0-9a-f]{6}\b/gi) ?? [];
  return [...new Set(matches.map((match) => match.toUpperCase()))];
}

function collectUploadedWorkspaceImages(value: unknown, found: Set<string>, results: string[]) {
  if (results.length >= 12 || value === null || value === undefined) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || found.has(trimmed)) return;
    if (trimmed.startsWith("/uploads/")) {
      found.add(trimmed);
      results.push(trimmed);
      return;
    }
    if (isUsableBusinessUploadedSrc(trimmed) && !trimmed.startsWith("/business-visuals/")) {
      found.add(trimmed);
      results.push(trimmed);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUploadedWorkspaceImages(item, found, results);
    return;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) collectUploadedWorkspaceImages(entry, found, results);
  }
}

function brandingText(output: Record<string, unknown> | null | undefined) {
  if (!output) return "";
  return Object.values(output)
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

export function resolveWorkspaceAtmosphereCategory(input: Readonly<{
  businessName?: string | null;
  industry?: string | null;
  businessDescription?: string | null;
  brandStyle?: string | null;
}>): WorkspaceAtmosphereCategory {
  const text = normalizedText([
    input.businessName,
    input.industry,
    input.businessDescription,
    input.brandStyle,
  ]);
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => containsKeyword(text, keyword))) return category;
  }
  return "general-business";
}

export function extractWorkspaceBrandColors(
  brandingOutput?: Record<string, unknown> | null,
): readonly string[] {
  return uniqueHexColors(brandingText(brandingOutput)).slice(0, 3);
}

export function selectWorkspaceAtmosphereImage(input: Readonly<{
  projectId: string;
  category: WorkspaceAtmosphereCategory;
  dayKey: string;
  sceneOffset?: number;
  websiteOutput?: Record<string, unknown> | null;
  brandingOutput?: Record<string, unknown> | null;
}>): WorkspaceAtmosphereImage | null {
  const uploaded: string[] = [];
  const found = new Set<string>();
  collectUploadedWorkspaceImages(input.websiteOutput, found, uploaded);
  collectUploadedWorkspaceImages(input.brandingOutput, found, uploaded);
  if (uploaded.length > 0) {
    const index = (hashString(`${input.projectId}:${input.dayKey}:${input.category}:uploaded`) + (input.sceneOffset ?? 0)) % uploaded.length;
    return {
      src: uploaded[index],
      source: "uploaded",
    };
  }
  const curated = CURATED_CATEGORY_IMAGES[input.category];
  if (curated.length === 0) return null;
  const index = (hashString(`${input.projectId}:${input.dayKey}:${input.category}:curated`) + (input.sceneOffset ?? 0)) % curated.length;
  return curated[index] ?? null;
}

export function selectWorkspaceAtmosphereScene(input: Readonly<{
  projectId: string;
  category: WorkspaceAtmosphereCategory;
  dayKey: string;
  sceneOffset?: number;
}>): WorkspaceAtmosphereScene {
  const scenes = SCENES[input.category];
  const baseIndex = hashString(`${input.projectId}:${input.dayKey}:${input.category}`) % scenes.length;
  const index = (baseIndex + (input.sceneOffset ?? 0) + scenes.length) % scenes.length;
  return scenes[index];
}

export function buildWorkspaceAtmosphere(input: WorkspaceAtmosphereInput): WorkspaceAtmosphereModel {
  const category = resolveWorkspaceAtmosphereCategory(input);
  return {
    category,
    scene: selectWorkspaceAtmosphereScene({
      projectId: input.projectId,
      category,
      dayKey: input.dayKey,
      sceneOffset: input.sceneOffset,
    }),
    accentColors: extractWorkspaceBrandColors(input.brandingOutput),
    image: selectWorkspaceAtmosphereImage({
      projectId: input.projectId,
      category,
      dayKey: input.dayKey,
      sceneOffset: input.sceneOffset,
      websiteOutput: input.websiteOutput,
      brandingOutput: input.brandingOutput,
    }),
    motionMode: input.reducedMotion ? "static" : "ambient",
  };
}
