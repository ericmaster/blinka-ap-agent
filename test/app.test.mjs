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

test("vendors: bank/terms changes need a second approver; invoices held meanwhile; edits feed the hard rules with audit", async () => {
  const { call, login } = mk(); await login("eric@example.com");
  const text = readFileSync("data/curated/C01.email.txt", "utf8");
  // propose: lower the hourly cap -> pending, vendor held while pending
  const ed = await call("PUT", "/api/vendors/andes-dev", { terms: { type: "hourly", rate: 180000, max_units_per_period: 10 } }); assert.equal(ed.status, 202);
  const e0 = await J(await call("POST", "/api/upload", { filename: "a.txt", type: "text/plain", text }));
  assert.equal(e0.action, "hold"); assert.match(e0.reason, /waiting for a second approver/);
  assert.equal((await call("POST", "/api/vendors/andes-dev/change/approve")).status, 403, "proposer cannot approve own change");
  await login("ana@example.com");
  assert.equal((await call("POST", "/api/vendors/andes-dev/change/approve")).status, 200);
  await call("POST", "/api/reset"); // fresh ledger, registry kept
  const e1 = await J(await call("POST", "/api/upload", { filename: "a.txt", type: "text/plain", text }));
  assert.equal(e1.action, "hold"); assert.match(e1.reason, /10 contracted hours/);
  // bank account change: pending until approved, then mismatching invoices are held
  assert.equal((await call("PUT", "/api/vendors/maria-qa", { acct: "CO-FAKE-0001" })).status, 202);
  await login("eric@example.com"); assert.equal((await call("POST", "/api/vendors/maria-qa/change/approve")).status, 200);
  const e2 = await J(await call("POST", "/api/upload", { filename: "b.txt", type: "text/plain", text: readFileSync("data/curated/C05.chat.txt", "utf8") }));
  assert.match(e2.reason, /does not match the registered account/);
  // non-sensitive edit applies directly
  assert.equal((await call("PUT", "/api/vendors/maria-qa", { category: "QA" })).status, 200);
  // remove -> unknown vendor -> escalate
  assert.equal((await call("DELETE", "/api/vendors/valpo-data")).status, 200);
  const e3 = await J(await call("POST", "/api/upload", { filename: "c.txt", type: "text/plain", text: readFileSync("data/curated/C07.email.txt", "utf8") }));
  assert.equal(e3.action, "escalate"); assert.match(e3.reason, /not in the approved vendor registry/);
  // new vendor: inactive until a second person approves
  assert.equal((await call("POST", "/api/vendors", { name: "Quito Bytes", acct: "bad" })).status, 400);
  const nv = await call("POST", "/api/vendors", { name: "Quito Bytes", acct: "EC-FAKE-1212", currency: "USD", category: "data labeling", keywords: "labeling, annotation", terms: { type: "flat", amount: 900 } });
  assert.equal(nv.status, 202);
  let st = await J(await call("GET", "/api/state")); assert.ok(!st.rules.allowlist.includes("quito-bytes"));
  assert.equal((await call("PUT", "/api/rules", { allowlist: [...st.rules.allowlist, "quito-bytes"] })).status, 400, "cannot activate a pending vendor via the toggle");
  await login("ana@example.com"); await call("POST", "/api/vendors/quito-bytes/change/approve");
  st = await J(await call("GET", "/api/state")); assert.ok(st.rules.allowlist.includes("quito-bytes"));
  assert.deepEqual(st.audit.map((a) => a.action).slice(0, 4), ["approve change", "propose new vendor", "remove vendor", "edit vendor"]);
  assert.equal(st.audit[0].proposedBy, "eric@example.com"); assert.equal(st.audit[0].by, "ana@example.com");
  const html = await (await call("GET", "/api/vendors/quito-bytes/contract")).text(); assert.match(html, /USD 900 flat fee/);
  assert.equal((await call("GET", "/api/vendors/quito-bytes/contract.pdf")).headers.get("content-type"), "application/pdf");
});

test("auth hardening: logout kills the server session, OTP requests rate-limited, mock writes need a session, demo off fails closed", async () => {
  const { call, login } = mk(); await login();
  assert.equal((await call("POST", "/mail/api/messages", { from: "a@b.co", subject: "x", body: "y" })).status, 201);
  await call("POST", "/api/auth/logout");
  assert.equal((await call("GET", "/api/state")).status, 401);
  assert.equal((await call("POST", "/mail/api/messages", { from: "a@b.co", subject: "x", body: "y" })).status, 401);
  assert.equal((await call("POST", "/chat/api/reset")).status, 401);
  assert.equal((await call("POST", "/api/reset")).status, 401);
  for (let i = 0; i < 4; i++) await call("POST", "/api/auth/start", { email: "eric@example.com" });
  assert.equal((await call("POST", "/api/auth/start", { email: "eric@example.com" })).status, 429);
  const { call: c2 } = mk({ DEMO_MODE: "false" });
  assert.equal((await c2("POST", "/api/auth/start", { email: "a@b.co" })).status, 503);
});

test("approve: still-flagged duplicates need an explicit, logged override; client OCR never auto-pays", async () => {
  const { call, login } = mk(); await login();
  const a = "Subject: Invoice MFR-10\n\nVendor: Maria Fernanda Rojas (contractor)\nInvoice # MFR-10\nDate: 2026-10-05\nDue date: 2026-10-30\nDescription: QA services October 2026\nTotal due: USD 1,600.00\nAccount: CO-FAKE-5005";
  const b = a.replaceAll("MFR-10", "MFR-10B").replace("2026-10-05", "2026-10-20");
  await J(await call("PUT", "/api/rules", { human_approval_above_usd: 1000 }));
  const e1 = await J(await call("POST", "/api/upload", { filename: "a.txt", type: "text/plain", text: a }));
  const e2 = await J(await call("POST", "/api/upload", { filename: "b.txt", type: "text/plain", text: b }));
  assert.equal(e2.action, "escalate"); assert.match(e2.reason, /duplicate|resend/i);
  const r = await call("POST", `/api/entry/${e2.id}/approve`); assert.equal(r.status, 409); assert.equal((await J(r)).needsOverride, true);
  void e1;
  // client-side OCR text is capped: escalates even when it claims 99% confidence
  const ocrText = a.replaceAll("MFR-10", "MFR-77").replace("QA services October 2026", "QA testing");
  const e3 = await J(await call("POST", "/api/upload", { filename: "x.png", type: "image/png", fileBase64: "iVBORw0KGgo=", ocr: { text: ocrText, confidence: 99 } }));
  assert.notEqual(e3.action, "pay"); assert.match(e3.reason, /read in the browser|Low OCR/);
});

test("concurrency: overlapping writes never lose an update", async () => {
  const { call, login } = mk(); await login();
  const t = (n) => `Subject: Invoice VD-${n}\n\nProveedor: Valpo Data SpA\nFactura N° VD-${n}\nFecha: 2026-10-05\nVence: 2026-10-30\nConcepto: Licencia analítica octubre 2026\nTotal a pagar: CLP 950.000\nCuenta: CL-FAKE-7007`;
  const rs = await Promise.all([1, 2, 3, 4].map((n) => call("POST", "/api/upload", { filename: `${n}.txt`, type: "text/plain", text: t(9000 + n) }).then(J)));
  const st = await J(await call("GET", "/api/state"));
  assert.equal(st.log.length, 4); assert.ok(rs.filter((e) => e.action === "pay").length <= 1, "flat monthly fee paid at most once");
});

test("migration: older partial vendor records are filled from defaults instead of crashing extraction", async () => {
  const mem = new Map([["state", { rules: { ...JSON.parse(readFileSync("config/rules.json", "utf8")), vendors: { "lima-support": { acct: "PE-FAKE-4004", category: "soporte", keywords: ["soporte"] } } }, ledger: { seen: [], spentUsd: 0, vendorPaidUsd: {}, unitsPaid: {} }, log: [], seq: 0, users: {}, sessions: { s1: { email: "e@x.co", at: Date.now() } }, otps: {}, audit: [] }]]);
  const app = createHost({ kv: { get: async (k) => structuredClone(mem.get(k) ?? null), put: async (k, v) => mem.set(k, structuredClone(v)), getBlob: async () => null, putBlob: async () => {} } });
  const r = await app(new Request("http://x/api/upload", { method: "POST", headers: { "content-type": "application/json", cookie: "sid=s1" }, body: JSON.stringify({ filename: "a.txt", type: "text/plain", text: readFileSync("data/curated/C13.email.txt", "utf8") }) }));
  const e = await r.json(); assert.equal(r.status, 200); assert.doesNotMatch(e.reason, /Could not read the document/);
});
