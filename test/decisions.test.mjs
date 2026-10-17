import { test, after } from "node:test";
import assert from "node:assert/strict";
import { oracle, reckless, failing, constant, chain } from "../src/adapters/index.mjs";
import { closeOcr } from "../src/extract/index.mjs";
import { pain001 } from "../src/output/pain001.mjs";
import { load, run, improper, counts, stressSet } from "./helpers.mjs";
after(closeOcr);
const truthOf = (m) => oracle(Object.fromEntries(m.map((x) => [x.id, x.truth])));
const HARD = ["trap:duplicate-two-channels", "trap:duplicate-exact", "trap:new-payee", "trap:over-limit", "trap:account-changed", "trap:prompt-injection", "trap:budget", "ambiguous-currency", "missing-due-date", "needs-approval"];

test("curated: zero improper payments, every trap stopped with a reason", { timeout: 300000 }, async () => {
  const m = load("data/curated"), log = await run("data/curated", m, chain(truthOf(m)));
  assert.deepEqual(improper(log, m), []);
  assert.deepEqual(counts(log), { pay: 12, hold: 12, escalate: 5 });
  const byId = Object.fromEntries(log.map((l) => [l.id, l]));
  const want = { C09: "hold", C10: "hold", C11: "escalate", C12: "escalate", C13: "hold", C14: "hold", C15: "hold", C16: "hold", C17: "hold", C18: "escalate", C19: "escalate", C20: "hold", C21: "escalate", C26: "hold", C27: "hold", C28: "hold", C29: "hold" };
  assert.match(byId.C27.reason, /outside the contracted service/);
  assert.match(byId.C28.reason, /Possible duplicate: same items/);
  assert.match(byId.C29.reason, /identical fingerprint/);
  assert.match(byId.C16.reason, /does not match the registered/);
  for (const [id, a] of Object.entries(want)) assert.equal(byId[id].action, a, `${id}: ${byId[id].reason}`);
  for (const l of log) assert.ok(l.reason.length > 10, `${l.id} has a plain-language reason`);
});

for (const seed of [2, 3, 4, 5, 6]) test(`stress seed ${seed} (60 random noisy invoices): zero improper payments`, async () => {
  const { dir, manifest } = stressSet(seed), log = await run(dir, manifest, chain(truthOf(manifest)));
  assert.deepEqual(improper(log, manifest), []);
  assert.ok(counts(log).pay > 0);
});

test("reckless model (always 'fine', p=1): zero improper payments — safety lives in code", { timeout: 300000 }, async () => {
  const m = load("data/curated"), log = await run("data/curated", m, chain(reckless()));
  assert.deepEqual(improper(log, m), []);
  for (const seed of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) { const s = stressSet(seed); assert.deepEqual(improper(await run(s.dir, s.manifest, chain(reckless())), s.manifest), [], `seed ${seed}`); }
  const paid = new Set(log.filter((l) => l.action === "pay").map((l) => l.id));
  for (const inv of m) if (inv.tags.some((t) => HARD.includes(t))) assert.ok(!paid.has(inv.id), `${inv.id} ${inv.tags}`);
});

test("model outage (primary and fallback fail): nothing is paid, all escalate or hold", { timeout: 300000 }, async () => {
  const m = load("data/curated"), log = await run("data/curated", m, chain(failing(), failing()));
  assert.equal(counts(log).pay, 0);
  assert.ok(log.filter((l) => l.action === "escalate").every((l) => l.reasons.length));
});

test("uncertain model (p=0.5) never pays", { timeout: 300000 }, async () => {
  const m = load("data/curated"), log = await run("data/curated", m, chain(constant(0.5)));
  assert.equal(counts(log).pay, 0);
});

test("fallback: JEV-like secondary answers when primary fails", async () => {
  const a = chain(failing(), constant(0.01));
  const r = await a.ask({ is_duplicate: {}, matches_agreement: {} }, { id: "x" });
  assert.equal(r.model, "fake-constant-0.01");
});

test("pain.001 output only for pay decisions", { timeout: 300000 }, async () => {
  const m = load("data/curated"), log = await run("data/curated", m, chain(truthOf(m)));
  const pays = log.filter((l) => l.action === "pay").map((l) => ({ id: l.id, ...l.extracted }));
  const xml = pain001(pays, { msgId: "T1", now: "2026-10-16T21:00:00" });
  assert.match(xml, /urn:iso:std:iso:20022:tech:xsd:pain\.001\.001\.09/);
  assert.equal((xml.match(/<CdtTrfTxInf>/g) ?? []).length, 12);
  assert.match(xml, /<NbOfTxs>12<\/NbOfTxs>/);
  assert.ok(!xml.includes("MX-FAKE-9999") && !xml.includes("Bogot"));
});

import { metrics, expected } from "../src/metrics.mjs";
test("honest KPIs: correct autonomy, wrongly held valid, escalation rate, timing and cost", () => {
  const t = { a: { tags: ["valid"] }, b: { tags: ["valid"] }, c: { tags: ["trap:account-changed"] }, d: { tags: ["needs-approval"] }, e: { tags: ["trap:ambiguous-currency"] } };
  const ag = (id, action, ms, model = true) => ({ id, action, ms, model: model ? {} : null, history: [{ by: "agent", action, at: "2026-10-17T10:00:00Z" }] });
  const log = [ag("a", "pay", 100), ag("b", "hold", 200), ag("c", "hold", 300, false), ag("d", "escalate", 400), { ...ag("e", "escalate", 500), action: "pay", history: [{ by: "agent", action: "escalate", at: "2026-10-17T10:00:00Z" }, { by: "x", action: "pay", at: "2026-10-17T10:30:00Z" }] }];
  const m = metrics(log, (e) => t[e.id]);
  assert.equal(expected(t.d), "escalate"); assert.equal(expected(t.e), "escalate"); assert.equal(expected(t.c), "hold");
  assert.equal(m.correctAutonomy, 2 / 5, "a (pay) and c (hold) are correct; b wrongly held; escalations are not autonomy");
  assert.equal(m.wronglyHeldValid, 1); assert.equal(m.validCount, 2);
  assert.equal(m.escalationRate, 2 / 5, "agent's decision counts, not the human's");
  assert.equal(m.agentMsP50, 300); assert.equal(m.humanMinutesP50, 30);
  assert.ok(m.costPerInvoiceUsd > 0 && m.costPerInvoiceUsd < 0.01);
});
