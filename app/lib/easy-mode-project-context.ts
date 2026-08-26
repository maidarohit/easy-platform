import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projectBusinessDna, projectMemory, projects } from "@/app/db/schema";
import { projectBusinessDnaToProjectMemory } from "@/app/lib/business-dna";
import type { TrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";

export async function loadOwnedProjectContext(context: TrustedModuleExecutionContext) {
  const [row] = await db.select({
    project: projects,
    memory: projectMemory,
    businessDna: projectBusinessDna,
  }).from(projects).leftJoin(projectMemory, and(
    eq(projectMemory.projectId, projects.id),
    eq(projectMemory.userId, context.userId),
  )).leftJoin(projectBusinessDna, and(
    eq(projectBusinessDna.projectId, projects.id),
    eq(projectBusinessDna.userId, context.userId),
  )).where(and(
    eq(projects.id, context.projectId),
    eq(projects.userId, context.userId),
  )).limit(1);

  if (!row) return null;
  return { ...row, businessDna: row.businessDna?.confirmed ? row.businessDna : null };
}

export function confirmedDnaExecutionContext(owned: Awaited<ReturnType<typeof loadOwnedProjectContext>>) {
  if (!owned?.businessDna) return null;
  const dna = owned.businessDna.dna;
  const projection = projectBusinessDnaToProjectMemory(dna);
  return {
    companyName: projection.businessName,
    industry: projection.industry,
    businessDescription: projection.businessDescription || dna.conversation?.originalVisionText?.trim(),
    targetAudience: projection.targetAudience,
    brandStyle: projection.brandStyle,
    brandVoice: projection.brandVoice,
    businessGoal: dna.goals?.primaryGoal?.trim() || dna.goals?.sixToTwelveMonthGoal?.trim() || dna.goals?.primaryLeadObjective?.trim(),
  };
}
