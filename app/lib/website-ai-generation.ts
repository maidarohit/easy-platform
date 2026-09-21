import "server-only";

import { parseAiUsageMetadata } from "@/app/lib/ai-usage-metadata";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";

// Transport only: authorization, allowances, persistence and usage remain with callers.
export async function generateWebsiteAi(
  webhook: { url: string; headers: Record<string, string> },
  payload: Record<string, unknown>,
  options: { maxResponseBytes?: number; fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);
  try {
    const upstream = await (options.fetcher ?? fetch)(webhook.url, {
      method: "POST", headers: webhook.headers, body: JSON.stringify(payload),
      cache: "no-store", signal: controller.signal,
      // Internal callers can bound the response and disallow redirects carrying secrets.
      ...(options.maxResponseBytes !== undefined && { redirect: "error" as const }),
    });
    const usageMetadata = parseAiUsageMetadata(upstream.headers);
    const n8nExecutionId = parseN8nExecutionId(upstream.headers);
    let responseText: string;
    if (options.maxResponseBytes !== undefined && upstream.body) {
      const reader = upstream.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > options.maxResponseBytes) {
          controller.abort();
          await reader.cancel().catch(() => undefined);
          throw new Error("WEBSITE_RESPONSE_TOO_LARGE");
        }
        chunks.push(chunk.value);
      }
      responseText = Buffer.concat(chunks).toString("utf8");
    } else {
      responseText = await upstream.text();
    }
    return { ok: upstream.ok, status: upstream.status, responseText, usageMetadata, n8nExecutionId };
  } finally {
    clearTimeout(timeout);
  }
}
