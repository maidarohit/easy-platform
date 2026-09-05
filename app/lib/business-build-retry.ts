import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

type RequestImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RetryBusinessBuildTaskInput = Readonly<{
  runId: string;
  taskId: string;
  inFlightTaskIds: Set<string>;
  refreshBuild: () => Promise<void>;
  request?: RequestImplementation;
}>;

export async function retryBusinessBuildTask({
  runId,
  taskId,
  inFlightTaskIds,
  refreshBuild,
  request = authenticatedFetch,
}: RetryBusinessBuildTaskInput): Promise<void> {
  if (inFlightTaskIds.has(taskId)) return;
  inFlightTaskIds.add(taskId);

  try {
    const retryResponse = await request(
      `/api/easy-mode/runs/${encodeURIComponent(runId)}/tasks/${encodeURIComponent(taskId)}/retry`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
    );
    if (!retryResponse.ok) throw new Error("Unable to retry this step safely.");

    await refreshBuild();

    const continueResponse = await request(`/api/easy-mode/runs/${encodeURIComponent(runId)}/execute-next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!continueResponse.ok) throw new Error("Unable to continue this build safely.");

    await refreshBuild();
  } finally {
    inFlightTaskIds.delete(taskId);
  }
}
