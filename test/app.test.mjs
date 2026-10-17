import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApp } from "../src/server/app.mjs";

function mk(env = {}) {
  let st = null; const blobs = new Map(); let sid = "";
  const app = createApp({ store: { load: async () => st && structuredClone(st), save: async (s) => { st = structuredClone(s); }, getBlob: async (k) => blobs.get(k), putBlob: async (k, v) => blobs.set(k, v) }, env });
  const call = async (m, p, body) => { const r = await app(new Request("http://x" + p, { method: m, headers: { "content-type": "application/json", cookie: `sid=${sid}` }, body: body && JSON.stringify(body) })); const c = r.headers.get("set-cookie"); if (c?.startsWith("sid=")) sid = c.slice(4, c.indexOf(";")); return r; };
  const login = async (email = "eric@example.com") => { const { code } = await (await call("POST", "/api/auth/start", { email })).json(); return call("POST", "/api/auth/verify", { email, code }); };
  return { call, login };
}
const J = (r) => r.json();

test("auth: OTP shown in demo mode, wrong code rejected, unknown user auto-registered, API requires session", async () => {
  const { call, login } = mk();
  assert.equal((await call("GET", "/api/state")).status, 401);
  const s = await J(await call("POST", "/api/auth/start", { email: "new@corp.example" }));
  assert.equal(s.demo, true); assert.match(s.code, /^\d{6}$/);
  assert.equal((await call("POST", "/api/auth/verify", { email: "new@corp.example", code: "000000" === s.code ? "111111" : "000000" })).status, 401);
  assert.equal((await login("new@corp.example")).status, 200);
  assert.equal((await J(await call("GET", "/api/state"))).user, "new@corp.example");
  const { call: c2 } = mk({ DEMO_MODE: "false" });
  assert.equal((await J(await c2("POST", "/api/auth/start", { email: "a@b.co" }))).code, undefined);
});

test("channels: seeded inbox + WhatsApp flow into the queue, entries link to source, PDF attachments extracted, approvals record who/when", async () => {
  const { call, login } = mk(); await login();
  const st = await J(await call("GET", "/api/state"));
  assert.ok(st.channels.emails.length > 10 && st.channels.chats.length > 5);
  const pdfMail = st.channels.emails.find((e) => e.attachments[0]?.type === "application/pdf");
  const e1 = await J(await call("POST", "/api/process", { messageId: pdfMail.id }));
  assert.equal(e1.channel, "pdf"); assert.equal(e1.source.messageId, pdfMail.id); assert.ok(e1.extracted.amount > 0);
  assert.equal((await call("POST", "/api/process", { messageId: pdfMail.id })).status, 409);
  const img = st.channels.chats.find((c) => c.attachment);
  assert.equal((await call("POST", "/api/process", { messageId: img.id })).status, 422, "image needs OCR text from the browser");
  const blob = await call("GET", `/api/blob/${img.attachment.id}?download`);
  assert.equal(blob.headers.get("content-type"), "image/png"); assert.match(blob.headers.get("content-disposition"), /^attachment/);
  const big = st.channels.emails.find((e) => /AD-1045/.test(e.subject));
  const e2 = await J(await call("POST", "/api/process", { messageId: big.id }));
  assert.equal(e2.action, "escalate"); // no model configured => escalate
  const ap = await J(await call("POST", `/api/entry/${e2.id}/approve`));
  assert.equal(ap.action, "pay"); assert.match(ap.reason, /Approved by eric@example\.com at 20/); assert.equal(ap.history.at(-1).by, "eric@example.com");
  const d = await J(await call("GET", `/api/entry/${e2.id}`));
  for (const k of ["vendor", "amount", "currency", "due_date", "invoice_number", "bank_account", "line_items"]) assert.ok(k in d.schema, k);
  assert.equal(d.schema.amount.value, 10800000); assert.ok(d.schema.amount.evidence.text.includes("10.800.000")); assert.ok(d.schema.amount.confidence > 0.9);
  assert.ok(d.checks.some((c) => c.rule === "Human approval threshold" && !c.ok));
  const tr = await J(await call("POST", `/api/entry/${e2.id}/translate`));
  assert.equal(tr.text, null); assert.match(tr.note, /unavailable/);
});

test("safety: held invoice and unknown payee cannot be approved; pain.001 only paid", async () => {
  const { call, login } = mk(); await login();
  const up = async (f) => J(await call("POST", "/api/upload", { filename: f, type: "text/plain", text: readFileSync(`data/curated/${f}`, "utf8") }));
  const held = await up("C16.email.txt"), unknown = await up("C11.email.txt");
  assert.equal(held.action, "hold"); assert.equal(held.source.channel, "upload");
  assert.equal((await call("POST", `/api/entry/${held.id}/approve`)).status, 409);
  assert.equal((await call("POST", `/api/entry/${unknown.id}/approve`)).status, 409);
  const rj = await J(await call("POST", `/api/entry/${unknown.id}/reject`)); assert.match(rj.reason, /Rejected by eric@example\.com/);
  assert.equal(((await (await call("GET", "/api/pain001")).text()).match(/<CdtTrfTxInf>/g) ?? []).length, 0);
  assert.equal((await call("PUT", "/api/rules", { max_per_payment_usd: -5 })).status, 400);
});

test("stress stream: zero improper payments", async () => {
  const { call, login } = mk(); await login();
  const last = (await (await call("POST", "/api/stress", { seed: 3, n: 12 })).text()).trim().split("\n").map(JSON.parse).at(-1);
  assert.equal(last.score.n, 12); assert.equal(last.score.improper, 0);
});
