import "server-only";

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the configured limit.");
    this.name = "RequestBodyTooLargeError";
  }
}

export class MalformedJsonBodyError extends Error {
  constructor() {
    super("Request body is not valid JSON.");
    this.name = "MalformedJsonBodyError";
  }
}

function assertValidLimit(maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("Request body limit must be a non-negative safe integer.");
  }
}

function rejectAdvertisedOversize(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length")?.trim();
  if (!contentLength || !/^\d+$/.test(contentLength)) return;

  if (Number(contentLength) > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
}

export async function readLimitedRawBody(
  request: Request,
  maxBytes: number
): Promise<Buffer> {
  assertValidLimit(maxBytes);
  rejectAdvertisedOversize(request, maxBytes);

  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }

    chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
  }

  return Buffer.concat(chunks, totalBytes);
}

export async function readLimitedJson(
  request: Request,
  maxBytes: number
): Promise<unknown> {
  const rawBody = await readLimitedRawBody(request, maxBytes);

  try {
    return JSON.parse(rawBody.toString("utf8")) as unknown;
  } catch {
    throw new MalformedJsonBodyError();
  }
}
