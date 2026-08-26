import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { projectBusinessDna, projectMemory, projects } from "@/app/db/schema";
import {
  BUSINESS_DNA_SCHEMA_VERSION,
  materializeBusinessDna,
  mergeBusinessDnaContent,
  projectBusinessDnaToProjectMemory,
  type BusinessDna,
  type BusinessDnaContent,
} from "@/app/lib/business-dna";

type StoredBusinessDna = typeof projectBusinessDna.$inferSelect;

function materialize(row: StoredBusinessDna): BusinessDna {
  return materializeBusinessDna({
    content: row.dna,
    confirmed: row.confirmed,
    confirmedAt: row.confirmedAt,
    revisionCount: row.revisionCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function readBusinessDnaForOwner(
  userId: string,
  projectId: string,
): Promise<BusinessDna | null | undefined> {
  const [ownedProject] = await db.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, projectId), eq(projects.userId, userId),
  )).limit(1);
  if (!ownedProject) return undefined;
  const [row] = await db.select().from(projectBusinessDna).where(and(
    eq(projectBusinessDna.projectId, projectId), eq(projectBusinessDna.userId, userId),
  )).limit(1);
  return row ? materialize(row) : null;
}

export async function updateBusinessDnaForOwner(input: {
  userId: string;
  projectId: string;
  patch: BusinessDnaContent;
  confirmed?: boolean;
}): Promise<BusinessDna | undefined> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`business-dna:${input.projectId}`}))`);
    const [ownedProject] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, input.projectId), eq(projects.userId, input.userId),
    )).limit(1);
    if (!ownedProject) return undefined;

    const [existing] = await transaction.select().from(projectBusinessDna).where(and(
      eq(projectBusinessDna.projectId, input.projectId), eq(projectBusinessDna.userId, input.userId),
    )).limit(1);
    const now = new Date();
    const dna = mergeBusinessDnaContent(existing?.dna ?? null, input.patch);
    const materiallyChanged = Object.keys(input.patch).some((section) => section !== "conversation");
    const confirmed = input.confirmed ?? (materiallyChanged ? false : existing?.confirmed ?? false);
    const confirmedAt = input.confirmed === true
      ? (existing?.confirmedAt ?? now)
      : input.confirmed === false || materiallyChanged ? null : (existing?.confirmedAt ?? null);
    const revisionCount = existing ? existing.revisionCount + 1 : 0;

    const [saved] = existing
      ? await transaction.update(projectBusinessDna).set({
          dna, confirmed, confirmedAt, revisionCount, updatedAt: now,
        }).where(and(
          eq(projectBusinessDna.projectId, input.projectId),
          eq(projectBusinessDna.userId, input.userId),
        )).returning()
      : await transaction.insert(projectBusinessDna).values({
          projectId: input.projectId,
          userId: input.userId,
          dna,
          schemaVersion: BUSINESS_DNA_SCHEMA_VERSION,
          confirmed,
          confirmedAt,
          revisionCount,
        }).returning();

    const projection = projectBusinessDnaToProjectMemory(dna);
    if (Object.keys(projection).length > 0) {
      const [memory] = await transaction.select({ id: projectMemory.id }).from(projectMemory).where(and(
        eq(projectMemory.projectId, input.projectId), eq(projectMemory.userId, input.userId),
      )).limit(1);
      if (memory) {
        await transaction.update(projectMemory).set({ ...projection, updatedAt: now }).where(eq(projectMemory.id, memory.id));
      } else {
        await transaction.insert(projectMemory).values({
          projectId: input.projectId, userId: input.userId, ...projection,
        });
      }
    }
    return materialize(saved);
  });
}
