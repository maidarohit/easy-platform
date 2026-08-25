import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projectMemory, projects } from "@/app/db/schema";
import type { TrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";

export async function loadOwnedProjectContext(context: TrustedModuleExecutionContext) {
  const [row] = await db.select({
    project: projects,
    memory: projectMemory,
  }).from(projects).leftJoin(projectMemory, and(
    eq(projectMemory.projectId, projects.id),
    eq(projectMemory.userId, context.userId),
  )).where(and(
    eq(projects.id, context.projectId),
    eq(projects.userId, context.userId),
  )).limit(1);

  return row ?? null;
}
