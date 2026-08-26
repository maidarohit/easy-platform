import { createHash } from "node:crypto";
import { validateMarketingOutput } from "@/app/lib/easy-mode-execution-contracts";

export const SOCIAL_CONTENT_MAX_LENGTH = 2_200;
export const SOCIAL_DATE_TIMEZONE = "UTC";

export const SOCIAL_MARKETING_MODULES = ["marketing", "marketing-ai"] as const;
const CUSTOMER_USABLE_MARKETING_FIELDS = ["contentIdeas", "adCopy"] as const;

export function parseSavedOutput(result: string): Record<string, unknown> | null {
  try { return validateMarketingOutput(JSON.parse(result)) ?? null; } catch { return null; }
}

export function selectLatestSavedMarketing(rows: readonly Readonly<{ module: string; result: string }>[]) {
  for (const row of rows) {
    if (!SOCIAL_MARKETING_MODULES.includes(row.module.toLowerCase() as (typeof SOCIAL_MARKETING_MODULES)[number])) continue;
    const output = parseSavedOutput(row.result);
    if (output) return output;
  }
  return null;
}

function firstSavedIdea(text: string) {
  const normalized = text.replace(/\r/g, "").trim();
  const candidates = normalized.split(/\n+|(?=\s*\d+[.)]\s+)/).map((item) => item.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  const candidate = candidates[0] ?? normalized;
  return candidate.length <= SOCIAL_CONTENT_MAX_LENGTH ? candidate : candidate.slice(0, SOCIAL_CONTENT_MAX_LENGTH).trimEnd();
}

export function recommendationFromSavedData(marketing: Record<string, unknown> | null, dna: Record<string, unknown> | null) {
  for (const field of CUSTOMER_USABLE_MARKETING_FIELDS) {
    const value = marketing?.[field];
    if (typeof value === "string" && value.trim()) {
      const content = firstSavedIdea(value);
      return { content, source: `marketing:${field}`, sourceHash: createHash("sha256").update(`${field}:${content}`).digest("hex"), theme: field.replace(/([a-z])([A-Z])/g, "$1 $2") };
    }
  }
  const goals = dna?.goals && typeof dna.goals === "object" ? dna.goals as Record<string, unknown> : null;
  const conversation = dna?.conversation && typeof dna.conversation === "object" ? dna.conversation as Record<string, unknown> : null;
  const dnaCandidates = [
    ["primaryGoal", goals?.primaryGoal],
    ["vision", goals?.vision],
    ["originalVisionText", conversation?.originalVisionText],
  ] as const;
  for (const [field, value] of dnaCandidates) {
    if (typeof value !== "string" || !value.trim()) continue;
    const content = firstSavedIdea(value);
    return { content, source: `dna:${field}`, sourceHash: createHash("sha256").update(`${field}:${content}`).digest("hex"), theme: "Business direction" };
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
