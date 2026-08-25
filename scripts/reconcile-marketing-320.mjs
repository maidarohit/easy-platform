import { readFile } from "node:fs/promises";
import { reconcileEasyModeMarketingResult } from "../app/lib/easy-mode-marketing-reconciliation.ts";

const RUN_ID = "5b327c31-dc34-4a37-aea8-3aef107a828e";
const PROJECT_ID = "5e56706a-41e9-498b-bf8a-134fffc8c06f";
const EXECUTION_KEY = "74bb8691-4566-4c00-9c48-c6853a4d81f8";

const resultPath = process.argv[2];
const apply = process.argv.includes("--apply");
if (!resultPath) throw new Error("Pass the local path to the exact n8n #320 JSON response.");
const response = JSON.parse(await readFile(resultPath, "utf8"));
const input = { runId: RUN_ID, projectId: PROJECT_ID, executionKey: EXECUTION_KEY, response };

if (!apply) {
  const validated = await reconcileEasyModeMarketingResult(input, async (_ids, output) => ({
    state: "reconciled",
    outputId: "validation-only",
    usageId: "existing-usage-only",
    nextModule: Object.hasOwn(output, "kpis") && Object.hasOwn(output, "marketingScore") ? "seo" : null,
  }));
  console.log(JSON.stringify({ mode: "validation-only", valid: true, nextModule: validated.nextModule }));
} else {
  const result = await reconcileEasyModeMarketingResult(input);
  console.log(JSON.stringify(result));
}
