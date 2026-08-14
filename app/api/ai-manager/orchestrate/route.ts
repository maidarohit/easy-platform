import {
  createInternalModuleInvoker,
  InvalidOrchestrationRequestError,
  orchestrateAiModules,
  parseOrchestrationRequest,
} from "@/app/lib/ai/orchestrator";

export async function POST(request: Request) {
  if (request.headers.get("x-easy-orchestration-depth")) {
    return Response.json(
      { error: "Nested orchestration requests are not allowed." },
      { status: 409 }
    );
  }

  try {
    const body: unknown = await request.json();
    const orchestrationRequest = parseOrchestrationRequest(body);
    const result = await orchestrateAiModules(orchestrationRequest, {
      invoke: createInternalModuleInvoker(request.url, request.signal),
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof InvalidOrchestrationRequestError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error("AI orchestration error:", error);
    return Response.json(
      { error: "AI orchestration request failed." },
      { status: 500 }
    );
  }
}
