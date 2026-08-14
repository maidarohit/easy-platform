import { getInternalAiModule } from "./registry";
import type {
  AiApiResult,
  AiModuleInputMap,
  InternalAiModuleId,
} from "./types";

export interface CallAiModuleOptions {
  /** Required when this helper is called outside a browser. */
  baseUrl?: string | URL;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class AiModuleApiError extends Error {
  readonly moduleId: InternalAiModuleId;
  readonly status: number;
  readonly details: string;

  constructor(
    moduleId: InternalAiModuleId,
    status: number,
    details: string
  ) {
    super(details || `The ${moduleId} request failed with status ${status}.`);
    this.name = "AiModuleApiError";
    this.moduleId = moduleId;
    this.status = status;
    this.details = details;
  }
}

function resolveEndpoint(endpoint: `/api/${string}`, baseUrl?: string | URL) {
  if (baseUrl) {
    return new URL(endpoint, baseUrl).toString();
  }

  if (typeof window === "undefined") {
    throw new Error(
      "callAiModule requires baseUrl when it is called on the server."
    );
  }

  return endpoint;
}

export async function callAiModule<
  TModule extends InternalAiModuleId,
  TJsonOutput = unknown,
>(
  moduleId: TModule,
  input: AiModuleInputMap[TModule],
  options: CallAiModuleOptions = {}
): Promise<AiApiResult<TJsonOutput>> {
  const definition = getInternalAiModule(moduleId);
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort(options.signal?.reason);

  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");

    const response = await fetch(
      resolveEndpoint(definition.apiEndpoint, options.baseUrl),
      {
        method: "POST",
        headers,
        body: JSON.stringify(input),
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      }
    );

    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      const details = await response.text();
      throw new AiModuleApiError(moduleId, response.status, details);
    }

    if (
      definition.responseKind === "image" ||
      definition.responseKind === "video"
    ) {
      return {
        kind: "binary",
        data: await response.blob(),
        status: response.status,
        contentType,
      };
    }

    return {
      kind: "json",
      data: (await response.json()) as TJsonOutput,
      status: response.status,
      contentType,
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
