import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/", options = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" }, ...options }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the C.F. Mechanical questionnaire shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /C\.F\. Mechanical \| Business &amp; Website Discovery/);
  assert.match(html, /C\.F\. MECHANICAL/);
  assert.match(html, /9 guided steps/);
  assert.doesNotMatch(html, /Northstar Brief|First, tell us about your business/);
});

test("the old Northstar submission route is unavailable", async () => {
  const response = await render("/api/submit", { method: "POST" });
  assert.equal(response.status, 404);
});
