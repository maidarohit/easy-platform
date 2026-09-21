import "server-only";

import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { authorizeProspectRequest, buildProspectDraft, hashProspectValue, newProspectPreviewToken,
  PROSPECT_BODY_BYTES, PROSPECT_EXPIRY_MS, prospectPreviewAccessible, prospectWebsitePayload,
  validateProspectIdempotencyKey, validateProspectInput } from "@/app/lib/prospect-preview-core";
import type { createProspectPreviewStore, ProspectRecord } from "@/app/lib/prospect-preview-store";
import type { generateWebsiteAi } from "@/app/lib/website-ai-generation";

type Dependencies = {
  store: ReturnType<typeof createProspectPreviewStore>;
  configuration: () => { origin: string; webhook: { url: string; headers: Record<string, string> } } | null;
  generate: typeof generateWebsiteAi;
};

function respond(body: Record<string, unknown>, status: number, retryAfter?: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store",
    ...(retryAfter !== undefined && { "Retry-After": String(retryAfter) }) } });
}

export async function handleProspectPreview(request: Request, dependencies: Dependencies) {
  if (!authorizeProspectRequest(request)) return respond({ error: "Unauthorized." }, 401);
  let record: ProspectRecord | undefined;
  let category = "unavailable";
  const started = Date.now();
  try {
    const retryAfter = await dependencies.store.rateLimit();
    if (retryAfter) return respond({ error: "Request limit reached." }, 429, retryAfter);
    const key = validateProspectIdempotencyKey(request.headers.get("idempotency-key"));
    if (!key) return respond({ error: "A valid Idempotency-Key is required." }, 400);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return respond({ error: "Content-Type must be application/json." }, 415);
    }
    const input = validateProspectInput(await readLimitedJson(request, PROSPECT_BODY_BYTES));
    if (!input) return respond({ error: "Invalid prospect request." }, 400);
    const configuration = dependencies.configuration();
    if (!configuration) return respond({ error: "Preview service unavailable." }, 503);
    const claim = await dependencies.store.claim(key, hashProspectValue(JSON.stringify(input)), input);
    if (claim.kind === "conflict") return respond({ error: "Idempotency-Key has a different payload." }, 409);
    if (claim.kind === "limited") return respond({ error: "Generation limit reached." }, 429, claim.retryAfter);
    record = claim.record;
    if (claim.kind === "existing") {
      if (record.revokedAt || (record.status === "ready" && !prospectPreviewAccessible(record))) {
        return respond({ requestId: record.id, status: "unavailable" }, 410);
      }
      if (record.status === "ready") {
        // A successful retry acknowledges completion but cannot recover a one-time
        // secret. n8n must retain the original response; no token rotation on retries.
        return respond({ requestId: record.id, status: "ready", expiresAt: record.expiresAt?.toISOString(), previewUrlIssued: true }, 200);
      }
      return respond({ requestId: record.id, status: record.status }, record.status === "processing" ? 202 : 409,
        record.status === "processing" ? 10 : undefined);
    }
    category = "generation_failed";
    const result = await dependencies.generate(configuration.webhook, prospectWebsitePayload(input), { maxResponseBytes: 256 * 1024 });
    if (!result.ok) throw new Error("UPSTREAM_FAILED");
    category = "invalid_output";
    const draft = buildProspectDraft(input, JSON.parse(result.responseText));
    if (!draft) throw new Error("INVALID_DRAFT");
    category = "persistence_failed";
    const { token, hash } = newProspectPreviewToken();
    const expiresAt = new Date(Date.now() + PROSPECT_EXPIRY_MS);
    const saved = await dependencies.store.finish(record, draft, hash, expiresAt, Date.now() - started, result.usageMetadata?.components);
    if (!saved) throw new Error("RESERVATION_UNAVAILABLE");
    return respond({ requestId: record.id, status: "ready", previewUrl: `${configuration.origin}/prospect-preview/${token}`,
      expiresAt: expiresAt.toISOString() }, 201);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return respond({ error: "Request body is too large." }, 413);
    if (error instanceof MalformedJsonBodyError) return respond({ error: "Invalid JSON." }, 400);
    if (record) {
      await dependencies.store.fail(record, category, Date.now() - started).catch(() => undefined);
      console.error("Prospect preview failed.", { requestId: record.id, status: "failed", duration: Date.now() - started, category });
    } else {
      console.error("Prospect preview unavailable.", { category: "unavailable" });
    }
    return respond({ ...(record && { requestId: record.id, status: "failed" }), error: "Preview could not be completed." },
      category === "generation_failed" || category === "invalid_output" ? 502 : 503);
  }
}
