import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHost } from "../src/server/host.mjs";

function mk(env = {}) {
  const mem = new Map(), blobs = new Map(); let sid = "";
  const app = createHost({ kv: { get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null), put: async (k, v) => { mem.set(k, structuredClone(v)); }, getBlob: async (k) => blobs.get(k) ?? null, putBlob: async (k, v) => { blobs.set(k, v); } }, env });
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
  assert.equal((await J(await call("POST", "/api/sync"))).added, 29);
  assert.equal((await J(await call("POST", "/api/sync"))).added, 0);
  const st = await J(await call("GET", "/api/state"));
  assert.equal(st.sources.email, "/mail/#");
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

test("connectors: a new email composed in the mock Mailbox (with PDF) and a WhatsApp message flow into Clearhold", async () => {
  const { call, login } = mk(); await login(); await call("POST", "/api/sync");
  const pdf = readFileSync("data/curated/C03.pdf").toString("base64");
  const sent = await J(await call("POST", "/mail/api/messages", { fromName: "Sampa Cloud", from: "billing@sampa.example", subject: "Fatura", body: "Segue fatura", attachments: [{ name: "f.pdf", type: "application/pdf", base64: pdf }] }));
  assert.equal((await J(await call("POST", "/api/sync"))).added, 1);
  const e = await J(await call("POST", "/api/process", { messageId: sent.id }));
  assert.equal(e.channel, "pdf"); assert.equal(e.extracted.vendorKey, "sampa-cloud"); assert.equal(e.source.messageId, sent.id);
  assert.equal((await call("GET", `/api/blob/${e.source.attachmentId}`)).headers.get("content-type"), "application/pdf");
  const w = await J(await call("POST", "/chat/api/messages", { from: "Ana · Lima Support", text: readFileSync("data/curated/C05.chat.txt", "utf8").replace(/^\[[^\]]+\][^:]+:\s*/, "") }));
  await call("POST", "/api/sync"); const e2 = await J(await call("POST", "/api/process", { messageId: w.id }));
  assert.equal(e2.source.channel, "whatsapp"); assert.equal(e2.extracted.vendorKey, "maria-qa");
  assert.equal((await call("GET", "/mail/")).status, 200); assert.equal((await call("GET", "/chat/")).status, 200);
});

test("vendors: add/edit/remove feed the hard rules, with audit and generated contract", async () => {
  const { call, login } = mk(); await login();
  const text = readFileSync("data/curated/C01.email.txt", "utf8");
  // edit: lower the hourly cap below the invoice's 40h -> code holds it
  const ed = await call("PUT", "/api/vendors/andes-dev", { terms: { type: "hourly", rate: 180000, max_units_per_period: 10 } }); assert.equal(ed.status, 200);
  const e1 = await J(await call("POST", "/api/upload", { filename: "a.txt", type: "text/plain", text }));
  assert.equal(e1.action, "hold"); assert.match(e1.reason, /10 contracted hours/);
  // change registered account -> hold
  await call("PUT", "/api/vendors/maria-qa", { acct: "CO-FAKE-0001" });
  const e2 = await J(await call("POST", "/api/upload", { filename: "b.txt", type: "text/plain", text: readFileSync("data/curated/C05.chat.txt", "utf8") }));
  assert.match(e2.reason, /does not match the registered account/);
  // remove -> unknown vendor -> escalate, cannot approve
  assert.equal((await call("DELETE", "/api/vendors/valpo-data")).status, 200);
  const e3 = await J(await call("POST", "/api/upload", { filename: "c.txt", type: "text/plain", text: readFileSync("data/curated/C07.email.txt", "utf8") }));
  assert.equal(e3.action, "escalate"); assert.match(e3.reason, /not in the approved vendor registry/);
  // add a new vendor; invalid input rejected
  assert.equal((await call("POST", "/api/vendors", { name: "Quito Bytes", acct: "bad" })).status, 400);
  const nv = await J(await call("POST", "/api/vendors", { name: "Quito Bytes", acct: "EC-FAKE-1212", currency: "USD", category: "data labeling", keywords: "labeling, annotation", terms: { type: "flat", amount: 900 } }));
  assert.equal(nv.key, "quito-bytes");
  const st = await J(await call("GET", "/api/state"));
  assert.ok(st.rules.allowlist.includes("quito-bytes"));
  assert.deepEqual(st.audit.map((a) => a.action), ["add vendor", "remove vendor", "edit vendor", "edit vendor"]);
  assert.equal(st.audit[3].by, "eric@example.com"); assert.ok(st.audit[3].changes.terms);
  const html = await (await call("GET", "/api/vendors/quito-bytes/contract")).text(); assert.match(html, /USD 900 flat fee/);
  assert.equal((await call("GET", "/api/vendors/quito-bytes/contract.pdf")).headers.get("content-type"), "application/pdf");
});
