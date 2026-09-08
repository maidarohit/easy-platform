export type ProjectDeletionDependencies = {
  verify(request: Request): Promise<{ uid: string }>;
  deleteOwnedProject(input: {
    userId: string;
    projectId: string;
    confirmationName: string;
  }): Promise<"deleted" | "not_found" | "confirmation_mismatch">;
  deleteProjectStorage(userId: string, projectId: string): Promise<void>;
};

const MAX_DELETE_BODY_BYTES = 4 * 1024;

async function readDeleteBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_DELETE_BODY_BYTES) return null;

  let value: unknown;
  try {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let json = "";
    let byteLength = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      byteLength += chunk.byteLength;
      if (byteLength > MAX_DELETE_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      json += decoder.decode(chunk, { stream: true });
    }
    json += decoder.decode();
    value = JSON.parse(json) as unknown;
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["projectId", "confirmationName"].includes(key))) return null;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const confirmationName = typeof body.confirmationName === "string" ? body.confirmationName.trim() : "";
  if (!projectId || projectId.length > 128 || !confirmationName || confirmationName.length > 255) return null;
  return { projectId, confirmationName };
}

export async function handleProjectDelete(request: Request, dependencies: ProjectDeletionDependencies) {
  let userId: string;
  try {
    userId = (await dependencies.verify(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required" }, { status: 401 });
  }

  const body = await readDeleteBody(request);
  if (!body) return Response.json({ error: "Invalid deletion request" }, { status: 400 });

  try {
    const result = await dependencies.deleteOwnedProject({ userId, ...body });
    if (result === "not_found") return Response.json({ error: "Project not found" }, { status: 404 });
    if (result === "confirmation_mismatch") {
      return Response.json({ error: "Enter the business name exactly to confirm deletion" }, { status: 409 });
    }

    try {
      await dependencies.deleteProjectStorage(userId, body.projectId);
    } catch {
      // The database/publication deletion is authoritative. Storage cleanup is safely
      // scoped and may be retried operationally without restoring public access.
      console.error("Deleted project storage cleanup failed.");
    }
    return Response.json({ success: true, projectId: body.projectId });
  } catch {
    console.error("Delete project failed.");
    return Response.json({ error: "Unable to delete this business. Please try again." }, { status: 500 });
  }
}
