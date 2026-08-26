import { config } from "dotenv";
import { readFile } from "node:fs/promises";

config({ path: ".env.local" });

const confirmation = process.argv[2];
const responsePath = process.argv[3];
if (confirmation !== "--execute-fixed-uiux-326" || !responsePath) {
  throw new Error("Usage: reconcile-uiux-326.mjs --execute-fixed-uiux-326 <response.json>");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const response = JSON.parse(await readFile(responsePath, "utf8"));
const { reconcileEasyModeUiux326 } = await import("../app/lib/easy-mode-uiux-326-reconciliation.ts");
const result = await reconcileEasyModeUiux326(response);
console.log(JSON.stringify(result));
