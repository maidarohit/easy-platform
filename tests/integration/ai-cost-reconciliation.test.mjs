import assert from "node:assert/strict";
import test from "node:test";

import {
  canClaimReconciliation,
  retryStatus,
} from "../../app/lib/ai-reconciliation-policy.ts";
import { calculateTokenComponentsCostUsd } from "../../app/lib/ai-cost.ts";
import {
  extractOpenAiUsageComponent,
  N8N_EXECUTION_ID_HEADER,
  parseN8nExecutionId,
} from "../../app/lib/n8n-executions.ts";

const workflowId = "content-workflow";
const nodeName = "OpenAI Chat Model";

function execution(overrides = {}) {
  return {
    workflowId,
    status: "success",
    finished: true,
    data: {
      resultData: {
        runData: {
          [nodeName]: [
            {
              data: {
                main: [[{
                  json: {
                    response: {
                      model_name: "gpt-5-mini",
                      tokenUsageEstimate: {
                        promptTokens: 1234,
                        completionTokens: 456,
                      },
                    },
                  },
                }]],
              },
            },
          ],
        },
      },
    },
    ...overrides,
  };
}

test("strictly validates n8n execution IDs", () => {
  assert.equal(
    parseN8nExecutionId(new Headers([[N8N_EXECUTION_ID_HEADER, "123_abc-Z"]])),
    "123_abc-Z"
  );
  for (const invalid of ["", "../123", "123 456", "x".repeat(129)]) {
    assert.equal(
      parseN8nExecutionId(new Headers([[N8N_EXECUTION_ID_HEADER, invalid]])),
      null
    );
  }
});

test("rejects an execution from the wrong workflow", () => {
  assert.deepEqual(
    extractOpenAiUsageComponent(execution({ workflowId: "other" }), workflowId, nodeName),
    { state: "rejected" }
  );
});

test("rejects completed execution data without configured model-node usage", () => {
  assert.deepEqual(
    extractOpenAiUsageComponent(execution(), workflowId, "Missing Model"),
    { state: "rejected" }
  );
});

test("normalizes prompt and completion tokens", () => {
  assert.deepEqual(extractOpenAiUsageComponent(execution(), workflowId, nodeName), {
    state: "ready",
    component: {
      provider: "openai",
      model: "gpt-5-mini",
      inputTokens: 1234,
      outputTokens: 456,
    },
  });
});

test("terminal reconciliation states cannot be processed twice", () => {
  assert.equal(canClaimReconciliation("completed"), false);
  assert.equal(canClaimReconciliation("exhausted"), false);
  assert.equal(canClaimReconciliation("pending"), true);
  assert.equal(retryStatus(5), "pending");
  assert.equal(retryStatus(6), "exhausted");
});

test("unknown models contribute zero cost", () => {
  assert.equal(
    calculateTokenComponentsCostUsd([
      {
        provider: "openai",
        model: "unknown-model",
        inputTokens: 1000,
        outputTokens: 1000,
      },
    ]),
    "0"
  );
});
