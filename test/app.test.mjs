import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApp } from "../src/server/app.mjs";

const mk = () => { let st = null; return createApp({ store: { load: async () => st && structuredClone(st), save: async (s) => { st = structuredClone(s); } }, env: {} }); };
const call = (app, m, p, body) => app(new Request("http://x" + p, { method: m, headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) }));

test("API: no model configured => nothing auto-pays; human approval re-checks hard rules; pain.001 lists only paid", async () => {
  const app = mk();
  const r1 = await (await call(app, "POST", "/api/invoice", { kind: "email", text: readFileSync("data/curated/C01.email.txt", "utf8") })).json();
  assert.equal(r1.action, "escalate"); assert.match(r1.reason, /modelo/);
  const ok = await call(app, "POST", `/api/invoice/${r1.id}/approve`); assert.equal(ok.status, 200);
  const r2 = await (await call(app, "POST", "/api/invoice", { kind: "email", text: readFileSync("data/curated/C16.email.txt", "utf8") })).json();
  assert.equal(r2.action, "hold");
  assert.equal((await call(app, "POST", `/api/invoice/${r2.id}/approve`)).status, 409);
  const r3 = await (await call(app, "POST", "/api/invoice", { kind: "email", text: readFileSync("data/curated/C11.email.txt", "utf8") })).json();
  assert.equal((await call(app, "POST", `/api/invoice/${r3.id}/approve`)).status, 409, "unknown payee cannot be approved");
  const xml = await (await call(app, "GET", "/api/pain001")).text();
  assert.equal((xml.match(/<CdtTrfTxInf>/g) ?? []).length, 1);
  const st = await (await call(app, "GET", "/api/state")).json();
  assert.ok(!JSON.stringify(st).match(/API_KEY/));
});
test("API: rules validation and allowlist", async () => {
  const app = mk();
  assert.equal((await call(app, "PUT", "/api/rules", { max_per_payment_usd: -5 })).status, 400);
  assert.equal((await call(app, "PUT", "/api/rules", { allowlist: ["maria-qa"] })).status, 200);
  const r = await (await call(app, "POST", "/api/invoice", { kind: "email", text: readFileSync("data/curated/C01.email.txt", "utf8") })).json();
  assert.match(r.reason, /no está en la lista/);
});
test("API: stress stream reports score with zero improper payments", async () => {
  const lines = (await (await call(mk(), "POST", "/api/stress", { seed: 3, n: 12 })).text()).trim().split("\n").map(JSON.parse);
  const last = lines.at(-1);
  assert.equal(last.score.n, 12); assert.equal(last.score.improper, 0); assert.equal(last.score.explainability, 1);
});
