import "server-only";

import { db } from "@/app/db";
import { projectOutputs } from "@/app/db/schema";
import { validateBrandingOutput } from "@/app/lib/easy-mode-execution-contracts";
import { loadOwnedMarketingContext } from "@/app/lib/marketing-business-context";
import { and, desc, eq } from "drizzle-orm";

export async function loadOwnedUiuxContext(userId: string, projectId: string) {
  const [context, brandingRows] = await Promise.all([
    loadOwnedMarketingContext(userId, projectId),
    db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId), eq(projectOutputs.module, "branding"),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(20),
  ]);
  if (!context) return null;
  const branding = brandingRows.map((row) => {
    try { return validateBrandingOutput(JSON.parse(row.result)); } catch { return null; }
  }).find(Boolean);
  return {
    website: context.website,
    business: context.business,
    branding: branding ? {
      palette: branding.colorPalette,
      typography: branding.typography,
      direction: branding.brandStyleGuide,
    } : null,
  };
}

export type UiuxBusinessContext = NonNullable<Awaited<ReturnType<typeof loadOwnedUiuxContext>>>;
