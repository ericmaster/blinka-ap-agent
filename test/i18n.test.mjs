import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { oracle, reckless, failing, constant, chain } from "../src/adapters/index.mjs";
import { closeOcr } from "../src/extract/index.mjs";
import { RULE_CATALOG } from "../src/engine/decide.mjs";
import { translateReason, hasTranslation, reasonsClientJs } from "../src/i18n/reasons.mjs";
import { UI_ES, MOCK_ES } from "../src/i18n/ui.mjs";
import { load, run, stressSet } from "./helpers.mjs";
after(closeOcr);
const es = (s) => translateReason(s, "es");
const missing = (list) => [...new Set(list)].filter((s) => !hasTranslation(s, "es"));

test("i18n: every decision reason the engine produces (curated + stress, any model behaviour) has a Spanish template", { timeout: 300000 }, async () => {
  const m = load("data/curated"), truth = oracle(Object.fromEntries(m.map((x) => [x.id, x.truth]))), all = [];
  for (const ad of [chain(truth), chain(reckless()), chain(failing(), failing()), chain(constant(0.5)), chain(constant(0))]) for (const l of await run("data/curated", m, ad)) all.push(...l.reasons, l.reason);
  for (const [seed, mix] of [[2, "traps"], [31, "realistic"]]) { const s = stressSet(seed, 60, mix); for (const l of await run(s.dir, s.manifest, chain(reckless()))) all.push(...l.reasons, l.reason); }
  assert.deepEqual(missing(all), []);
  assert.deepEqual(missing(RULE_CATALOG.map(([r]) => r)), []);
});

test("i18n: API errors, notes and payout rails from the server and mocks are covered", async () => {
  const src = ["src/server/app.mjs", "src/mocks/service.mjs"].map((f) => readFileSync(f, "utf8")).join("\n");
  const lits = [...src.matchAll(/(?:error|note): "([^"]+)"/g)].map((x) => x[1]);
  assert.ok(lits.length > 20);
  assert.deepEqual(missing(lits), []);
  const { railFor } = await import("../src/mocks/blinka.mjs");
  const rails = [["CO", "COP"], ["BR", "BRL"], ["MX", "MXN"], ["AR", "ARS"], ["CL", "CLP"], ["PE", "PEN"], ["BO", "BOB"], ["CR", "CRC"], ["US", "USD"], ["PE", "USD"], ["DE", "USD"]].map(([c, k]) => railFor(c, k).rail);
  assert.deepEqual(missing(rails.filter((r) => !/^(Argentina|SWIFT)/.test(r))), []); // those two read the same in Spanish
  assert.ok(rails.every((r) => es(r)));
  assert.equal(es('Bank account MX-1 does not match the registered account for Monterrey Ops Partners S.C. Moved to pending by a@x.example at 2026-10-17T15:00:00Z: "ok".'), 'La cuenta bancaria MX-1 no coincide con la cuenta registrada de Monterrey Ops Partners S.C. Movida a pendientes por a@x.example el 2026-10-17T15:00:00Z: "ok".');
  assert.equal(es('Moved to pending by ana@x.example at 2026-10-17T15:00:00Z: "Vendor confirmed".'), 'Movida a pendientes por ana@x.example el 2026-10-17T15:00:00Z: "Vendor confirmed".');
  assert.equal(es('Rejected by a@x.example at 2026-10-17T15:00:00Z. Override requested by a@x.example at 2026-10-17T15:01:00Z: "ok then". Above US$2,000, a second person must approve.'), 'Rechazada por a@x.example el 2026-10-17T15:00:00Z. Excepción solicitada por a@x.example el 2026-10-17T15:01:00Z: "ok then". Por encima de US$2,000, otra persona debe aprobar.');
  assert.equal(es('Approved over a hold by b@x.example at 2026-10-17T15:02:00Z; hard rules re-checked. Reason: "Checked". Second approver after a@x.example.'), 'Aprobada sobre una retención por b@x.example el 2026-10-17T15:02:00Z; reglas duras verificadas de nuevo. Motivo: "Checked". Segundo aprobador después de a@x.example.');
  assert.deepEqual(missing(["Approved by ana@x.example at 2026-10-17T15:00:00Z; hard rules re-checked.", "Rejected by ana@x.example at 2026-10-17T15:00:00Z.", "approvers", "contact on file for Pixel Norte S.A. de C.V."]), []);
});

test("i18n: captures (names, numbers, quotes from the invoice) stay in the original language; nested reasons translate", () => {
  assert.equal(es('Exact duplicate: Pixel Norte S.A. de C.V. already submitted invoice PN-1025.'), "Duplicado exacto: Pixel Norte S.A. de C.V. ya envió la factura PN-1025.");
  assert.equal(es('Line item outside the contracted service (Cloud hosting): "Consultoría de marketing digital".'), 'Ítem fuera del servicio contratado (Cloud hosting): "Consultoría de marketing digital".');
  assert.equal(es("Could not read with confidence: vendor, due date."), "No se pudo leer con confianza: proveedor, fecha de vencimiento.");
  assert.equal(es("Does not match the agreement: Currency EUR differs from the contracted currency (USD)."), "No cumple el acuerdo: La moneda EUR difiere de la moneda contratada (USD).");
  assert.equal(es("Amount US$12,000 exceeds the per-payment limit of US$10,000. Also: Insufficient budget: US$5 left, invoice is US$12,000."), "El monto US$12,000 supera el límite por pago de US$10,000. Además: Presupuesto insuficiente: quedan US$5 y la factura es de US$12,000.");
  assert.equal(translateReason("Exact duplicate: X already submitted invoice 1.", "en"), "Exact duplicate: X already submitted invoice 1.");
  assert.equal(es("Something the engine never says."), "Something the engine never says.");
  // the browser copy is the same function and table
  const f = new Function(`${reasonsClientJs()}; return translateReason;`)();
  // bundled (esbuild keepNames) copies call __name(); the client snippet must define it
  const g = new Function(`${reasonsClientJs().replace("function translateReason(s", "const _k=__name(function(){},'x');function translateReason(s")}; return translateReason;`)();
  assert.equal(g("Wrong code", "es"), "Código incorrecto");
  assert.equal(f("Bank account MX-FAKE-9999 does not match the registered account for Monterrey Ops Partners S.C..", "es"), es("Bank account MX-FAKE-9999 does not match the registered account for Monterrey Ops Partners S.C.."));
});

// Every literal passed to tx(...) and every static [data-t] text/title/placeholder must have a Spanish entry with the same {n} arguments.
const strings = (html) => {
  const out = [...html.matchAll(/\btx\(\s*"((?:[^"\\]|\\.)*)"/g)].map((x) => JSON.parse(`"${x[1]}"`));
  for (const x of html.matchAll(/tx\(([a-z.]+)\?"((?:[^"\\]|\\.)*)":"((?:[^"\\]|\\.)*)"\)/gi)) out.push(JSON.parse(`"${x[2]}"`), JSON.parse(`"${x[3]}"`));
  for (const x of html.matchAll(/<([a-z0-9]+)([^>]*\bdata-t(?:="attr")?[^>]*)>([^<]*)</gi)) {
    for (const a of x[2].matchAll(/\b(?:title|placeholder)="([^"]+)"/g)) out.push(a[1]);
    const key = x[2].match(/data-t="([^"]+)"/)?.[1];
    if (key && key !== "attr") out.push(key); else if (!key && x[3].trim()) out.push(x[3].replace(/&amp;/g, "&"));
  }
  return out;
};
const args = (s) => (s.match(/\{\d\}/g) ?? []).sort().join();
test("i18n: every Clearhold UI string has Spanish with matching arguments", () => {
  const html = readFileSync("src/server/ui.html", "utf8"), s = strings(html);
  assert.ok(s.length > 120, `${s.length} strings`);
  // map-based strings (labels, channels, statuses, guided demo, metrics rows, audit actions)
  const maps = [...html.matchAll(/(?:CH0|DK0|LG0|ACT0|FLD|VF)=\{([^}]+)\}/g)].flatMap((x) => [...x[1].matchAll(/:"([^"]+)"/g)].map((y) => y[1]));
  const rows = [...html.matchAll(/row\("([^"]+)"/g), ...html.matchAll(/\["m-C\d+","([^"]+)"\]|\["w-C\d+","([^"]+)"\]/g), ...html.matchAll(/\["[a-z_]+_usd","([^"]+)"\]/g)].map((x) => x[1] ?? x[2]);
  const miss = [...new Set([...s, ...maps, ...rows])].filter((k) => !(k in UI_ES) && k !== "WhatsApp" && k !== "PDF");
  assert.deepEqual(miss, []);
  for (const [k, v] of Object.entries(UI_ES)) assert.equal(args(v), args(k), k);
  for (const a of ["edit vendor", "remove vendor", "reset demo", "propose new vendor", "propose bank/terms change", "approve change", "reject change", "move held invoice to pending", "request hold override", "approve held invoice"]) assert.ok(UI_ES[a], a);
});

test("i18n: mock Mailbox, ChatApp and Blinka pages have Spanish and the shared EN · ES toggle", async () => {
  const { MAIL_UI, CHAT_UI } = await import("../src/mocks/ui.mjs");
  const { createBlinkaMock } = await import("../src/mocks/blinka.mjs");
  const BL = await (await createBlinkaMock({ load: async () => null, save: async () => {} })(new Request("http://x/blinka/"))).text();
  for (const h of [MAIL_UI, CHAT_UI, BL]) {
    assert.match(h, /data-lang="es"/); assert.match(h, /clearhold\.lang/);
    const miss = [...new Set(strings(h))].filter((k) => !(k in MOCK_ES) && !(k in UI_ES));
    assert.deepEqual(miss, []);
  }
  for (const k of ["Payment", "Beneficiary", "Rail", "Status", "Reference", "settled"]) assert.ok(MOCK_ES[k], k);
});

test("i18n: the built UI inlines the dictionary, defaults to English and stores the choice in localStorage", async () => {
  const { UI } = await import("../src/server/ui.mjs");
  assert.ok(!UI.includes("/*I18N*/"));
  assert.match(UI, /const I18N=\{es:\{ui:/);
  assert.match(UI, /localStorage\.getItem\(LANG_KEY\)==="es"\?"es":"en"/);
  assert.match(UI, /<span class="k" id="who"><\/span><span class="lng" data-lng/); // toggle sits right next to the user email
  new Function(UI.match(/<script>([\s\S]*?)<\/script>/)[1]); // parses
});
