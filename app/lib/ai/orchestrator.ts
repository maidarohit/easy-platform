import { callAiModule, AiModuleApiError } from "./api-client";
import { AI_MODULE_REGISTRY, getAiModule } from "./registry";
import type {
  AiApiResult,
  AiModuleInputMap,
  AiOrchestrationRequest,
  AiOrchestrationResult,
  AiOrchestrationStepResult,
  InternalAiModuleId,
  OrchestratableAiModuleId,
} from "./types";

const MAX_ORCHESTRATION_STEPS = 20;

type ModuleInvoker = (
  moduleId: OrchestratableAiModuleId,
  input: AiModuleInputMap[OrchestratableAiModuleId]
) => Promise<AiApiResult>;

export interface OrchestratorOptions {
  invoke?: ModuleInvoker;
}

export class InvalidOrchestrationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrchestrationRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrchestratableModuleId(
  value: unknown
): value is OrchestratableAiModuleId {
  if (typeof value !== "string" || value === "ai-manager") return false;

  const definition =
    AI_MODULE_REGISTRY[value as keyof typeof AI_MODULE_REGISTRY];

  return Boolean(
    definition?.orchestrationReady && definition.integration === "internal-api"
  );
}

export function parseOrchestrationRequest(
  value: unknown
): AiOrchestrationRequest {
  if (!isRecord(value) || !Array.isArray(value.steps)) {
    throw new InvalidOrchestrationRequestError(
      "The request must contain a steps array."
    );
  }

  if (value.steps.length === 0) {
    throw new InvalidOrchestrationRequestError(
      "At least one orchestration step is required."
    );
  }

  if (value.steps.length > MAX_ORCHESTRATION_STEPS) {
    throw new InvalidOrchestrationRequestError(
      `An orchestration request can contain at most ${MAX_ORCHESTRATION_STEPS} steps.`
    );
  }

  if (value.context !== undefined && !isRecord(value.context)) {
    throw new InvalidOrchestrationRequestError(
      "Orchestration context must be an object."
    );
  }

  const stepIds = new Set<string>();
  const parsedSteps = value.steps.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new InvalidOrchestrationRequestError(
        `Step ${index + 1} must be an object.`
      );
    }

    if (typeof candidate.id !== "string" || !candidate.id.trim()) {
      throw new InvalidOrchestrationRequestError(
        `Step ${index + 1} must have a non-empty id.`
      );
    }

    if (stepIds.has(candidate.id)) {
      throw new InvalidOrchestrationRequestError(
        `Duplicate step id: ${candidate.id}.`
      );
    }

    if (!isOrchestratableModuleId(candidate.moduleId)) {
      throw new InvalidOrchestrationRequestError(
        candidate.moduleId === "ai-manager"
          ? "AI Manager cannot invoke itself."
          : `Module ${String(candidate.moduleId)} is not available for orchestration.`
      );
    }

    if (!isRecord(candidate.input)) {
      throw new InvalidOrchestrationRequestError(
        `Step ${candidate.id} input must be an object.`
      );
    }

    let includeOutputsFrom: string[] | undefined;
    if (candidate.includeOutputsFrom !== undefined) {
      if (
        !Array.isArray(candidate.includeOutputsFrom) ||
        candidate.includeOutputsFrom.some((id) => typeof id !== "string")
      ) {
        throw new InvalidOrchestrationRequestError(
          `Step ${candidate.id} includeOutputsFrom must be an array of step ids.`
        );
      }

      for (const dependencyId of candidate.includeOutputsFrom) {
        if (!stepIds.has(dependencyId)) {
          throw new InvalidOrchestrationRequestError(
            `Step ${candidate.id} can only include output from an earlier step; ${dependencyId} is unavailable.`
          );
        }
      }
      includeOutputsFrom = [...candidate.includeOutputsFrom];
    }

    stepIds.add(candidate.id);

    return {
      id: candidate.id,
      moduleId: candidate.moduleId,
      input: candidate.input,
      ...(includeOutputsFrom ? { includeOutputsFrom } : {}),
    };
  });

  return {
    steps: parsedSteps as AiOrchestrationRequest["steps"],
    ...(value.context ? { context: value.context } : {}),
  };
}

function serializeError(error: unknown): NonNullable<
  AiOrchestrationStepResult["error"]
> {
  if (error instanceof AiModuleApiError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown module failure.",
  };
}

function responseOutput(response: AiApiResult): unknown {
  if (response.kind === "json") return response.data;

  return {
    kind: "binary",
    contentType: response.contentType,
    size: response.data.size,
  };
}

export async function orchestrateAiModules(
  request: AiOrchestrationRequest,
  options: OrchestratorOptions = {}
): Promise<AiOrchestrationResult> {
  const parsedRequest = parseOrchestrationRequest(request);
  const startedAt = new Date().toISOString();
  const results: AiOrchestrationStepResult[] = [];
  const successfulOutputs = new Map<string, unknown>();

  if (!options.invoke) {
    throw new Error("An internal module invoker is required.");
  }

  for (const step of parsedRequest.steps) {
    const stepStartedAt = new Date().toISOString();
    const definition = getAiModule(step.moduleId);
    const selectedOutputs = Object.fromEntries(
      (step.includeOutputsFrom ?? [])
        .filter((stepId) => successfulOutputs.has(stepId))
        .map((stepId) => [stepId, successfulOutputs.get(stepId)])
    );
    const hasOrchestrationContext =
      parsedRequest.context !== undefined || step.includeOutputsFrom !== undefined;
    const input = {
      ...step.input,
      ...(hasOrchestrationContext
        ? {
            orchestrationContext: {
              ...(parsedRequest.context ?? {}),
              upstreamOutputs: selectedOutputs,
            },
          }
        : {}),
    } as AiModuleInputMap[OrchestratableAiModuleId];

    try {
      const response = await options.invoke(step.moduleId, input);
      const output = responseOutput(response);
      successfulOutputs.set(step.id, output);
      results.push({
        stepId: step.id,
        moduleId: step.moduleId,
        moduleName: definition.name,
        status: "succeeded",
        output,
        startedAt: stepStartedAt,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        stepId: step.id,
        moduleId: step.moduleId,
        moduleName: definition.name,
        status: "failed",
        error: serializeError(error),
        startedAt: stepStartedAt,
        completedAt: new Date().toISOString(),
      });
    }
  }

  const succeeded = results.filter((result) => result.status === "succeeded");
  const status =
    succeeded.length === results.length
      ? "succeeded"
      : succeeded.length > 0
        ? "partial"
        : "failed";

  return {
    status,
    results,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

export function createInternalModuleInvoker(
  baseUrl: string | URL,
  signal?: AbortSignal
): ModuleInvoker {
  return (moduleId, input) =>
    callAiModule(moduleId as InternalAiModuleId, input, {
      baseUrl,
      signal,
      headers: { "X-Easy-Orchestration-Depth": "1" },
    });
}
