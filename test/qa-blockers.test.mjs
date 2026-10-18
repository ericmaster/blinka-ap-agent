// Regression tests for the QA judge findings (fix/qa-blockers).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHost } from "../src/server/host.mjs";
import { kpis } from "../src/server/app.mjs";
import { agreementCheck, approve, newLedger, snapshot } from "../src/engine/decide.mjs";
import rules from "../config/rules.json" with { type: "json" };
import { VENDORS } from "../src/data/vendors.mjs";

function mk(opts = {}) {
  const mem = new Map(), blobs = new Map(); let sid = "";
  const app = createHost({ kv: { get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null), put: async (k, v) => { mem.set(k, structuredClone(v)); }, getBlob: async (k) => blobs.get(k) ?? null, putBlob: async (k, v) => { blobs.set(k, v); } }, ...opts });
  const call = async (m, p, body) => { const r = await app(new Request("http://x" + p, { method: m, headers: { "content-type": "application/json", cookie: `sid=${sid}` }, body: body && JSON.stringify(body) })); const c = r.headers.get("set-cookie"); if (c?.startsWith("sid=")) sid = c.slice(4, c.indexOf(";")); return r; };
  const login = async (email) => { const { code } = await (await call("POST", "/api/auth/start", { email })).json(); return call("POST", "/api/auth/verify", { email, code }); };
  return { call, login, mem };
}
const J = (r) => r.json();
const up = async (call, text, name = "a.txt") => J(await call("POST", "/api/upload", { filename: name, type: "text/plain", text }));
const model = (p) => ({ name: "stub", async ask() { return p; } });
export const LIMA = `Subject: Factura QA-RATE-002\n\nProveedor: Lima Support Desk SAC\nFactura N.º QA-RATE-002\nFecha: 2026-10-10\nFecha de vencimiento: 30/10/2026\nSoporte al cliente: 10 horas x PEN 90.00\nTotal: PEN 900.00\nCuenta: PE-FAKE-4004`;
export const ANDES = `Subject: Factura QA-DUAL-001\n\nProveedor: Andes Dev Studio SAS\nFactura N.º QA-DUAL-001\nFecha: 2026-10-10\nFecha de vencimiento: 30/10/2026\nDesarrollo de software: 60 horas x COP 180.000\nTotal: COP 10.800.000\nCuenta: CO-FAKE-1001`;

test("QA#1 repro: contract-rate violation held by the model cannot be paid by a user approval on any route", async () => {
  const { call, login } = mk({ model: model({ is_duplicate: 0, matches_agreement: 0.01 }) }); await login("ana@gmail.com");
  const e = await up(call, LIMA);
  assert.equal(e.action, "hold", e.reason);
  assert.match(e.hard.join(" "), /Unit price PEN 90 differs.*PEN 45\/h/);
  for (const route of ["approve", "approve-second"]) {
    const r = await call("POST", `/api/entry/${e.id}/${route}`, { email: "other@gmail.com", code: "123456", reason: "Pay it anyway" });
    assert.equal(r.status, 409); assert.equal((await J(r)).hard, true);
  }
  for (const pth of ["approve", "reopen", "approve"]) await call("POST", `/api/entry/${e.id}/${pth}`, { reason: "I accept the risk, pay it", override: "I accept the risk" });
  const st = await J(await call("GET", "/api/state"));
  assert.notEqual(st.log.find((l) => l.id === e.id).action, "pay", "hard contract failure must never be paid");
});

test("QA#2 repro: pending approval above US$2,000 needs two distinct identities", async () => {
  const { call, login } = mk({ model: model({ is_duplicate: 0, matches_agreement: 0.99 }) }); await login("ana@gmail.com");
  const e = await up(call, ANDES);
  assert.equal(e.action, "escalate", e.reason);
  const r1 = await call("POST", `/api/entry/${e.id}/approve`, {});
  const b1 = await J(r1);
  assert.notEqual(b1.action, "pay", "single approver must not complete a > US$2,000 payment");
  assert.equal(r1.status, 202); assert.equal(b1.approvals[0].by, "ana@gmail.com");
});

test("hourly agreement validates explicit line arithmetic and the total, with rate tolerance", () => {
  const x = { vendorKey: "lima-support", currency: "PEN", amount: 450, items: [{ qty: 10, unitPrice: 45 }] };
  assert.equal(agreementCheck(x, newLedger(), rules).fail, undefined);
  assert.match(agreementCheck({ ...x, items: [{ qty: 10, unitPrice: 45, total: 451 }] }, newLedger(), rules).fail, /line amount/);
  assert.match(agreementCheck({ ...x, amount: 900 }, newLedger(), rules).fail, /invoice total/);
  assert.match(agreementCheck({ ...x, items: [{ qty: 10, unitPrice: 45.006 }] }, newLedger(), rules).fail, /Unit price/);
});

test("model-no with deterministic rules passing is soft and approvable only with a reason", async () => {
  const { call, login } = mk({ model: model({ is_duplicate: 0, matches_agreement: 0 }) }); await login("ana@gmail.com");
  const e = await up(call, LIMA.replace("90.00", "45.00").replace("900.00", "450.00"));
  assert.equal(e.action, "hold"); assert.deepEqual(e.hard, []);
  assert.equal((await call("POST", `/api/entry/${e.id}/approve`, {})).status, 400);
  const paid = await J(await call("POST", `/api/entry/${e.id}/approve`, { reason: "Checked the contracted rate" }));
  assert.equal(paid.action, "pay"); assert.deepEqual(paid.paidCheck.hard, []);
  const st = await J(await call("GET", "/api/state")); assert.equal(st.kpis.improper, 0); assert.equal(st.kpis.overrides, 1); assert.equal(st.kpis.notEvaluated, 1);
});

for (const route of ["pending", "held", "reopened"]) test(`dual approval: ${route}, distinct logged-in colleagues; reject/reopen preserve first approval`, async () => {
  const { call, login } = mk({ model: model({ is_duplicate: 0, matches_agreement: route === "pending" ? 1 : 0 }) });
  await login("ana@qa.example"); const e = await up(call, ANDES);
  if (route === "reopened") await call("POST", `/api/entry/${e.id}/reopen`, { reason: "Review model disagreement" });
  const body = { reason: "Contract and invoice checked" };
  assert.equal((await call("POST", `/api/entry/${e.id}/approve`, body)).status, 202);
  assert.equal((await call("POST", `/api/entry/${e.id}/approve`, body)).status, 403);
  if (route === "pending") {
    await call("POST", `/api/entry/${e.id}/reject`, {});
    await call("POST", `/api/entry/${e.id}/reopen`, body);
    assert.equal((await call("POST", `/api/entry/${e.id}/approve`, body)).status, 403);
  }
  await login("luis@qa.example"); const paid = await J(await call("POST", `/api/entry/${e.id}/approve`, body));
  assert.equal(paid.action, "pay"); assert.equal(new Set(paid.paidCheck.approvers).size, 2);
  assert.equal((await J(await call("GET", "/api/state"))).kpis.improper, 0);
});

for (const held of [false, true]) test(`sandbox OTP second approval (${held ? "held override" : "pending"}): identity, invalid/expired/consumed codes, no session`, async () => {
  const { call, login, mem } = mk({ model: model({ is_duplicate: 0, matches_agreement: held ? 0 : 1 }) });
  await login("ana@gmail.com"); const e = await up(call, ANDES), path = `/api/entry/${e.id}/approve-second`, reason = "Contract verified independently";
  assert.equal((await call("POST", `/api/entry/${e.id}/approve`, { reason })).status, 202);
  assert.equal((await call("POST", path, { email: "ANA@gmail.com", code: "000000", reason })).status, 403);
  const email = "luis@gmail.com", { code } = await J(await call("POST", "/api/auth/start", { email }));
  assert.equal((await call("POST", path, { email, code: "bad-code", reason })).status, 401);
  const a = mem.get("auth"); a.otps[email].exp = 0;
  assert.equal((await call("POST", path, { email, code, reason })).status, 401);
  const next = await J(await call("POST", "/api/auth/start", { email }));
  const sessions = Object.keys(mem.get("auth").sessions).length;
  const response = await call("POST", path, { email, code: next.code, reason }); assert.equal(response.status, 200); assert.equal(response.headers.get("set-cookie"), null);
  const paid = await J(response); assert.equal(paid.action, "pay"); assert.deepEqual(paid.paidCheck.approvers, ["ana@gmail.com", email]);
  assert.equal(Object.keys(mem.get("auth").sessions).length, sessions); assert.equal(mem.get("auth").otps[email], undefined);
  assert.equal((await call("POST", "/api/auth/verify", { email, code: next.code })).status, 401);
  assert.equal((await J(await call("GET", "/api/state"))).kpis.improper, 0);
});

test("second approvals re-check new hard failures without consuming the OTP or booking", async () => {
  const { call, login } = mk({ model: model({ is_duplicate: 0, matches_agreement: 1 }) }); await login("ana@qa.example");
  const e = await up(call, ANDES); await call("POST", `/api/entry/${e.id}/approve`, {});
  await call("PUT", "/api/rules", { period_budget_usd: 100 });
  const email = "luis@qa.example", { code } = await J(await call("POST", "/api/auth/start", { email }));
  const r = await call("POST", `/api/entry/${e.id}/approve-second`, { email, code }); assert.equal(r.status, 409); assert.equal((await J(r)).hard, true);
  await login(email);
  assert.equal((await call("POST", `/api/entry/${e.id}/approve`, {})).status, 409);
});

test("improper KPI counts hard-failing, under-approved and user-paid ground-truth invoices", () => {
  const base = { id: "F001", action: "pay", extracted: { vendorKey: "lima-support", amount: 900, currency: "PEN", items: [{ qty: 10, unitPrice: 90 }], acct: "PE-FAKE-4004", number: "QA-100", due: "2026-10-30" }, amountUsd: 240, history: [{ by: "ana@example.com" }] };
  assert.equal(kpis({ rules, ledger: newLedger(), log: [base] }).improper, 1);
  const under = { ...base, amountUsd: 2700, paidCheck: { hard: [], approvers: ["ana@example.com"], amountUsd: 2700, threshold: 2000 } };
  assert.equal(kpis({ rules, log: [under] }).improper, 1);
  assert.equal(kpis({ rules, log: [{ ...under, paidCheck: { ...under.paidCheck, approvers: ["ana@example.com", "luis@example.com"] } }] }).improper, 0);
  const seeded = { ...base, source: { messageId: "m-C16" }, paidCheck: { hard: [], approvers: [] } };
  const k = kpis({ rules, log: [seeded] }); assert.equal(k.evaluated, 1); assert.equal(k.notEvaluated, 0); assert.ok(k.improper > 0);
});

test("decision snapshot survives later duplicate; audit contains the original contract, config hash and FX", async () => {
  const { call, login } = mk({ model: model({ is_duplicate: 0, matches_agreement: 1 }) }); await login("ana@gmail.com");
  const text = LIMA.replace("90.00", "45.00").replace("900.00", "450.00");
  const e = await up(call, text); assert.equal(e.action, "pay"); const original = structuredClone(e.decisionSnapshot);
  await up(call, text);
  const detail = await J(await call("GET", `/api/entry/${e.id}`)); assert.deepEqual(detail.decisionSnapshot, original); assert.ok(detail.reevaluated.some((c) => !c.ok && /duplicate/.test(c.rule)));
  const audit = await J(await call("GET", "/api/audit.json")), row = audit.invoices[0];
  assert.equal(row.config_hash, original.rulesHash); assert.equal(row.rules_version, original.rulesHash);
  assert.deepEqual(row.vendor_contract, { terms: VENDORS["lima-support"].terms, acct: "PE-FAKE-4004", currency: "PEN" });
  assert.deepEqual(row.fx_table, rules.fx_to_usd); assert.equal(row.fx_as_of, rules.fx_as_of);
  const state = await J(await call("GET", "/api/state"));
  assert.equal(snapshot(e.extracted, e.reasons, { ...state.rules, vendors: {}, pendingChanges: { x: true } }).rulesHash, original.rulesHash);
});

test("engine approve independently refuses hard failures and missing dual approval", () => {
  const extracted = { vendorKey: "lima-support", amount: 900, currency: "PEN", items: [{ qty: 10, unitPrice: 90 }], acct: "PE-FAKE-4004", number: "QA-100", due: "2026-10-30" };
  assert.equal(approve({ id: "F001", action: "escalate", extracted }, newLedger(), rules).hard, true);
  assert.equal(approve({ id: "F001", action: "escalate", extracted: { ...extracted, items: [{ description: null, qty: 10, unitPrice: 90 }] } }, newLedger(), rules).hard, true);
  const entry = { id: "F001", action: "escalate", extracted: { ...extracted, amount: 450, items: [{ description: "Soporte al cliente", qty: 10, unitPrice: 45 }] } };
  assert.equal(approve(entry, newLedger(), { ...rules, human_approval_above_usd: 0 }).pendingSecond, true);
});
