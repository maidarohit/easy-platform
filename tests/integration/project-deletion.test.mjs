import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { handleProjectDelete } from "../../app/lib/project-deletion.ts";

const deletionRequest = (body, token = "owner-a") => new Request("https://example.invalid/api/projects", {
  method: "DELETE",
  headers: { authorization: token, "content-type": "application/json" },
  body: JSON.stringify(body),
});

function fixture() {
  const projects = new Map([["project-a", { userId: "owner-a", name: "Acme Studio" }]]);
  const storageDeletes = [];
  const dependencies = {
    verify: async (request) => {
      const uid = request.headers.get("authorization");
      if (!uid) throw new Error("unauthenticated");
      return { uid };
    },
    deleteOwnedProject: async ({ userId, projectId, confirmationName }) => {
      const project = projects.get(projectId);
      if (!project || project.userId !== userId) return "not_found";
      if (project.name !== confirmationName) return "confirmation_mismatch";
      projects.delete(projectId);
      return "deleted";
    },
    deleteProjectStorage: async (userId, projectId) => { storageDeletes.push({ userId, projectId }); },
  };
  return { projects, storageDeletes, dependencies };
}

test("an authenticated owner can explicitly confirm and delete only their project", async () => {
  const context = fixture();
  const response = await handleProjectDelete(deletionRequest({ projectId: "project-a", confirmationName: "Acme Studio" }), context.dependencies);
  assert.equal(response.status, 200);
  assert.equal(context.projects.size, 0);
  assert.deepEqual(context.storageDeletes, [{ userId: "owner-a", projectId: "project-a" }]);
});

test("another user cannot delete the project and failed confirmation changes nothing", async () => {
  const context = fixture();
  const forbidden = await handleProjectDelete(deletionRequest({ projectId: "project-a", confirmationName: "Acme Studio" }, "owner-b"), context.dependencies);
  assert.equal(forbidden.status, 404);
  assert.equal(context.projects.size, 1);
  const mismatch = await handleProjectDelete(deletionRequest({ projectId: "project-a", confirmationName: "Wrong" }), context.dependencies);
  assert.equal(mismatch.status, 409);
  assert.equal(context.projects.size, 1);
  assert.deepEqual(context.storageDeletes, []);
});

test("the production deletion transaction removes public mappings but not account, subscription, entitlement, or usage records", async () => {
  const route = await readFile(new URL("../../app/api/projects/route.ts", import.meta.url), "utf8");
  assert.match(route, /eq\(projects\.id, projectId\), eq\(projects\.userId, userId\)/);
  assert.match(route, /delete\(businessPublications\)/);
  assert.match(route, /delete\(publishedWebsites\)/);
  assert.match(route, /delete\(websitePublicationVersions\)/);
  assert.match(route, /delete\(projects\)/);
  assert.doesNotMatch(route, /delete\((?:users|subscriptions|entitlementOverrides|aiUsage)\)/);
});

test("master workspace requires the business name and redirects only after server success", async () => {
  const page = await readFile(new URL("../../app/master-workspace/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Delete Business Permanently/);
  assert.match(page, /This permanently deletes this business and its saved workspace data\. This does not cancel your Buzypeezy subscription\./);
  assert.match(page, /deleteConfirmation !== businessName/);
  assert.match(page, /if \(!response\.ok\) throw/);
  assert.match(page, /router\.replace\("\/dashboard"\)/);
});
