import { and, desc, eq, sql } from "drizzle-orm";

import { selectLatestWorkspaceOutputs, workspaceProjectPresentation } from "@/app/api/master-workspace/route";
import { db } from "@/app/db";
import { projectBusinessDna, projectOutputs, projectPreviewCustomizations, projects } from "@/app/db/schema";
import { OWNER_IMAGE_MAX_BYTES, OWNER_IMAGE_SLOTS, parseOwnerImageSlot, runBusinessOwnerImageUpload } from "@/app/lib/business-hero-image";
import { applyPreviewOverrides } from "@/app/lib/business-preview-edits";
import type { PreviewOverrides } from "@/app/lib/business-preview-edits";
import { buildBusinessPreview } from "@/app/lib/business-preview";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { saveBusinessHeroObject } from "@/app/lib/firebase-admin-storage";

function developmentStorageDebug(debug: unknown) {
  if (process.env.NODE_ENV !== "development" || !debug) {
    return undefined;
  }

  if (typeof debug !== "object") {
    return {
      value: String(debug).slice(0, 500),
    };
  }

  const record = debug as Record<string, unknown>;

  const cause =
    record.cause && typeof record.cause === "object"
      ? (record.cause as Record<string, unknown>)
      : undefined;

  return {
    type:
      debug instanceof Error
        ? debug.name
        : (debug as { constructor?: { name?: string } }).constructor?.name,

    keys: Object.getOwnPropertyNames(debug),

    message:
      debug instanceof Error
        ? debug.message.slice(0, 500)
        : typeof record.message === "string"
          ? record.message.slice(0, 500)
          : undefined,

    code: record.code,
    status: record.status,
    statusCode: record.statusCode,
    reason: record.reason,
    bucket: record.bucket,

    cause: cause
      ? {
          message:
            typeof cause.message === "string"
              ? cause.message.slice(0, 500)
              : undefined,
          code: cause.code,
          status: cause.status,
          statusCode: cause.statusCode,
          reason: cause.reason,
        }
      : undefined,
  };
}

async function authenticatedOwnedProject(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return { error: Response.json({ error: "Authentication is required." }, { status: 401 }) } as const;
  }
  const projectId = validateEasyModeProjectId(new URL(request.url).searchParams.get("projectId"));
  if (!projectId) return { error: Response.json({ error: "Invalid project." }, { status: 400 }) } as const;
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, projectId),
    eq(projects.userId, userId),
  )).limit(1);
  if (!project) return { error: Response.json({ error: "Project not found." }, { status: 404 }) } as const;
  return { userId, projectId } as const;
}

export async function GET(request: Request) {
  const owned = await authenticatedOwnedProject(request);
  if ("error" in owned) return owned.error;
  const [customization] = await db.select({ overrides: projectPreviewCustomizations.overrides }).from(projectPreviewCustomizations).where(and(
    eq(projectPreviewCustomizations.projectId, owned.projectId),
    eq(projectPreviewCustomizations.userId, owned.userId),
  )).limit(1);
  const overrides: PreviewOverrides = customization?.overrides && typeof customization.overrides === "object" && !Array.isArray(customization.overrides)
    ? customization.overrides
    : {};
  return Response.json({
    heroImage: overrides.heroImage ?? null,
    secondaryImage: overrides.secondaryImage ?? null,
    overrides,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Please choose a photo to upload." }, { status: 400 });
  }

  const projectId = validateEasyModeProjectId(form.get("projectId"));
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
  const slot = parseOwnerImageSlot(form.get("slot") || "hero");
  if (!slot) return Response.json({ error: "Choose the main photo or the second photo." }, { status: 400 });

  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, projectId),
    eq(projects.userId, userId),
  )).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const image = form.get("image");
  if (!(image instanceof File) || image.size <= 0) {
    return Response.json({ error: "Please choose a JPEG, PNG or WEBP photo." }, { status: 400 });
  }
  if (image.size > OWNER_IMAGE_MAX_BYTES) {
    return Response.json({ error: "That photo is too large. Use an image under 4 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await image.arrayBuffer());

  const [customization] = await db.select().from(projectPreviewCustomizations).where(and(
    eq(projectPreviewCustomizations.projectId, projectId),
    eq(projectPreviewCustomizations.userId, userId),
  )).limit(1);

  const result = await runBusinessOwnerImageUpload({
    slot,
    userId,
    projectId,
    bytes,
    declaredMime: image.type || null,
    previousOverrides: customization?.overrides ?? {},
    storage: { saveHeroObject: saveBusinessHeroObject },
    persistOverrides: async (overrides) => {
      const now = new Date();
      await db.insert(projectPreviewCustomizations).values({
        projectId,
        userId,
        overrides,
        approvedAt: null,
        revisionCount: 1,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: projectPreviewCustomizations.projectId,
        set: {
          overrides,
          approvedAt: null,
          revisionCount: sql`${projectPreviewCustomizations.revisionCount} + 1`,
          updatedAt: now,
        },
      });
      return overrides;
    },
  });

  if (!result.ok) {
    if (result.debug) {
      console.error("Business photo upload failed.", developmentStorageDebug(result.debug));
    }
    return Response.json({
      error: result.error,
      ...(developmentStorageDebug(result.debug) ? { debug: developmentStorageDebug(result.debug) } : {}),
    }, { status: result.status });
  }

  const [dnaRow, outputs] = await Promise.all([
    db.select({ dna: projectBusinessDna.dna }).from(projectBusinessDna).where(and(
      eq(projectBusinessDna.projectId, projectId),
      eq(projectBusinessDna.userId, userId),
      eq(projectBusinessDna.confirmed, true),
    )).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(projectOutputs).where(and(
      eq(projectOutputs.projectId, projectId),
      eq(projectOutputs.userId, userId),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)),
  ]);
  const originalPreview = buildBusinessPreview({
    project: workspaceProjectPresentation(project, dnaRow?.dna ?? null),
    outputs: selectLatestWorkspaceOutputs(outputs),
  });
  const preview = applyPreviewOverrides(originalPreview, result.overrides);
  preview.approval.approved = false;
  return Response.json({
    slot: result.slot,
    imageUrl: result.imageUrl,
    heroImage: result.overrides.heroImage,
    secondaryImage: result.overrides.secondaryImage,
    overrides: result.overrides,
    preview,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  let userId: string;
  try { userId = (await verifyFirebaseIdToken(request)).uid; }
  catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid photo request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "projectId" && key !== "slot")) {
    return Response.json({ error: "Invalid photo request." }, { status: 400 });
  }
  const projectId = validateEasyModeProjectId((body as { projectId?: unknown }).projectId);
  const slot = parseOwnerImageSlot((body as { slot?: unknown }).slot);
  if (!projectId || !slot) return Response.json({ error: "Invalid photo request." }, { status: 400 });
  const [project, customization] = await Promise.all([
    db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1).then((rows) => rows[0] ?? null),
    db.select({ overrides: projectPreviewCustomizations.overrides }).from(projectPreviewCustomizations).where(and(eq(projectPreviewCustomizations.projectId, projectId), eq(projectPreviewCustomizations.userId, userId))).limit(1).then((rows) => rows[0] ?? null),
  ]);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const overrides: PreviewOverrides = customization?.overrides && typeof customization.overrides === "object" && !Array.isArray(customization.overrides)
    ? { ...customization.overrides } as PreviewOverrides : {};
  delete overrides[OWNER_IMAGE_SLOTS[slot].overrideKey];
  await db.update(projectPreviewCustomizations).set({ overrides, approvedAt: null, revisionCount: sql`${projectPreviewCustomizations.revisionCount} + 1`, updatedAt: new Date() })
    .where(and(eq(projectPreviewCustomizations.projectId, projectId), eq(projectPreviewCustomizations.userId, userId)));
  return Response.json({ slot, overrides, heroImage: overrides.heroImage ?? null, secondaryImage: overrides.secondaryImage ?? null }, { headers: { "Cache-Control": "no-store" } });
}
