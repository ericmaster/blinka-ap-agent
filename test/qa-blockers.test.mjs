// Regression tests for the QA judge findings (fix/qa-blockers).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHost } from "../src/server/host.mjs";

function mk(opts = {}) {
  const mem = new Map(), blobs = new Map(); let sid = "";
  const app = createHost({ kv: { get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null), put: async (k, v) => { mem.set(k, structuredClone(v)); }, getBlob: async (k) => blobs.get(k) ?? null, putBlob: async (k, v) => { blobs.set(k, v); } }, ...opts });
  const call = async (m, p, body) => { const r = await app(new Request("http://x" + p, { method: m, headers: { "content-type": "application/json", cookie: `sid=${sid}` }, body: body && JSON.stringify(body) })); const c = r.headers.get("set-cookie"); if (c?.startsWith("sid=")) sid = c.slice(4, c.indexOf(";")); return r; };
  const login = async (email) => { const { code } = await (await call("POST", "/api/auth/start", { email })).json(); return call("POST", "/api/auth/verify", { email, code }); };
  return { call, login };
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
});
