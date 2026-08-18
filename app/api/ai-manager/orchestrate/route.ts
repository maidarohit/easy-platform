/**
 * Intentionally disabled legacy orchestration endpoint.
 *
 * Keep this route unavailable until its authentication, authorization, and
 * billing semantics are redesigned.
 */
export async function POST() {
  return Response.json(
    { error: "This endpoint is not available." },
    { status: 410 }
  );
}
