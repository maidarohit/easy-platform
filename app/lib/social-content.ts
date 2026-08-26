import { createHash } from "node:crypto";

export const SOCIAL_CONTENT_MAX_LENGTH = 2_200;
export const SOCIAL_DATE_TIMEZONE = "UTC";

const preferredFields = ["socialMediaStrategy", "contentStrategy", "campaignIdeas", "campaignStrategy", "positioningStatement", "marketingStrategy"];

function unwrap(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value) && value.length === 1) return unwrap(value[0]);
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return unwrap(record.output) ?? record;
}

export function parseSavedOutput(result: string): Record<string, unknown> | null {
  try { return unwrap(JSON.parse(result)); } catch { return null; }
}

function firstSavedIdea(text: string) {
  const normalized = text.replace(/\r/g, "").trim();
  const candidates = normalized.split(/\n+|(?=\s*\d+[.)]\s+)/).map((item) => item.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  const candidate = candidates[0] ?? normalized;
  return candidate.length <= SOCIAL_CONTENT_MAX_LENGTH ? candidate : candidate.slice(0, SOCIAL_CONTENT_MAX_LENGTH).trimEnd();
}

export function recommendationFromSavedData(marketing: Record<string, unknown> | null, dna: Record<string, unknown> | null) {
  for (const field of preferredFields) {
    const value = marketing?.[field];
    if (typeof value === "string" && value.trim()) {
      const content = firstSavedIdea(value);
      return { content, source: `marketing:${field}`, sourceHash: createHash("sha256").update(`${field}:${content}`).digest("hex"), theme: field.replace(/([a-z])([A-Z])/g, "$1 $2") };
    }
  }
  const conversation = dna?.conversation && typeof dna.conversation === "object" ? dna.conversation as Record<string, unknown> : null;
  const originalVision = conversation?.originalVisionText;
  if (typeof originalVision === "string" && originalVision.trim()) {
    const content = firstSavedIdea(originalVision);
    return { content, source: "dna:originalVisionText", sourceHash: createHash("sha256").update(`vision:${content}`).digest("hex"), theme: "Business direction" };
  }
  return null;
}

export function socialLocalDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function validateEditedContent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const content = value.trim();
  if (!content || content.length > SOCIAL_CONTENT_MAX_LENGTH || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content)) return null;
  return content;
}
