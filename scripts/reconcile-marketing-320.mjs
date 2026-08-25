import { readFile } from "node:fs/promises";
import { config } from "dotenv";

const RUN_ID = "5b327c31-dc34-4a37-aea8-3aef107a828e";
const PROJECT_ID = "5e56706a-41e9-498b-bf8a-134fffc8c06f";
const EXECUTION_KEY = "74bb8691-4566-4c00-9c48-c6853a4d81f8";
const ENDPOINT = "https://www.buzypeezy.ai/api/internal/easy-mode/reconcile-marketing-320";

const resultPath = process.argv[2];
const apply = process.argv.includes("--apply");
if (!resultPath) throw new Error("Pass the local path to the exact n8n #320 JSON response.");
if (!apply) throw new Error("Pass --apply to invoke the fixed production reconciliation route.");
config({ path: ".env.local", quiet: true });
const secret = process.env.AI_USAGE_RECONCILIATION_SECRET?.trim();
if (!secret) throw new Error("AI_USAGE_RECONCILIATION_SECRET is not available locally.");
const response = JSON.parse(await readFile(resultPath, "utf8"));
const apiResponse = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Authorization": `Bearer ${secret}`, "Content-Type": "application/json" },
  body: JSON.stringify({ runId: RUN_ID, projectId: PROJECT_ID, executionKey: EXECUTION_KEY, response }),
});
const result = await apiResponse.json();
if (!apiResponse.ok) throw new Error(result.error || `Reconciliation failed with HTTP ${apiResponse.status}.`);
console.log(JSON.stringify(result));
