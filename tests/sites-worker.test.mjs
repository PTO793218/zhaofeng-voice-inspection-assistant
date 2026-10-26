import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing assets", async () => {
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
  });
  assert.equal(response.status, 200);
});

test("falls back to the app shell", async () => {
  const response = await worker.fetch(new Request("https://example.test/task", {
    headers: { accept: "text/html" },
  }), {
    ASSETS: {
      fetch: async (request) => new Response(new URL(request.url).pathname === "/index.html" ? "app" : "missing", {
        status: new URL(request.url).pathname === "/index.html" ? 200 : 404,
      }),
    },
  });
  assert.equal(response.status, 200);
});

test("emits the Sites package files", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
