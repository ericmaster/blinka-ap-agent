import { test } from "node:test";
import assert from "node:assert/strict";
import { preTranslate, maskLine, unmask, TRANSLATION_VERSION } from "../src/i18n/translate.mjs";
import { createApp } from "../src/server/app.mjs";
import rules from "../config/rules.json" with { type: "json" };

test("translation: common ES/PT labels are deterministic and only match complete leading labels", () => {
  for (const [labels, en] of [
    [["Vence", "Fecha de vencimiento", "Vencimiento", "Vencimento"], "Due date"],
    [["Fecha", "Fecha de emisión", "Data de emissão"], "Date"],
    [["Cuenta", "Cuenta bancaria", "Conta"], "Account"],
    [["Factura", "Fatura"], "Invoice"], [["Factura N.º", "Factura Nº", "Nº"], "Invoice No."],
    [["Proveedor", "Fornecedor"], "Vendor"], [["Total", "Total a pagar"], "Total due"],
    [["Cliente"], "Customer"], [["Descripción", "Descrição"], "Description"],
    [["Cantidad", "Quantidade"], "Quantity"], [["Precio unitario"], "Unit price"], [["Horas"], "hours"],
  ]) for (const label of labels) assert.equal(preTranslate(`${label}: valor`), `${en}: valor`, label);
  assert.equal(preTranslate("  VENCE 30/10/2026"), "  Due date 30/10/2026");
  assert.equal(preTranslate("Cuentas: otra"), "Cuentas: otra");
  assert.equal(preTranslate("Texto de la Factura"), "Texto de la Factura");
});

test("translation: entities, dates, emails and any numeric formatting round-trip exactly", () => {
  const extracted = { payee: "Pixel Norte SAS", number: "PN-42", acct: "PE-FAKE-4004", amount: 1234.5, currency: "PEN" };
  const vendor = { name: "Pixel Norte S.A.S.", aliases: ["Pixel Norte"] };
  const line = "Descripción: Pixel Norte SAS / Pixel Norte S.A.S. / Pixel Norte PN-42 PE-FAKE-4004 30/10/2026 2026-10-30 a@pixel.example PEN 1.234,50 1,234.50 1 234,50 servicio";
  const masked = maskLine(line, extracted, vendor);
  assert.equal(masked.needsModel, true);
  assert.ok(!masked.text.includes("Pixel"));
  assert.equal(unmask(masked.text.replace("servicio", "SERVICE"), masked), preTranslate(line).replace("servicio", "SERVICE"));
  for (const bad of [masked.text.replace("⟦0⟧", ""), masked.text + "⟦0⟧", masked.text + "⟦99⟧", undefined]) assert.equal(unmask(bad, masked), preTranslate(line));
  for (const line of ["", "Vence: 30/10/2026", "Cuenta: PE-FAKE-4004", "Proveedor: Pixel Norte SAS", "Total: PEN 1.234,50"]) {
    const m = maskLine(line, extracted, vendor);
    assert.equal(m.needsModel, false, line);
    assert.equal(unmask(m.text, m), preTranslate(line));
  }
});

test("translation route: fake AI cannot mangle entities; stale caches regenerate and missing placeholders fall back", async () => {
  const calls = [], sourceText = "Vence: 30/10/2026\nCuenta: PE-FAKE-4004\nProveedor: Pixel Norte SAS\nDescripción: servicio de Pixel Norte SAS\nNota: consultar a billing@pixel.example el 2026-10-30";
  let state = { rules: { ...rules, vendors: { pixel: { name: "Pixel Norte SAS", aliases: ["Pixel"], terms: {} } } },
    log: [{ id: "F001", sourceText, extracted: { lang: "es", payee: "Pixel Norte SAS", vendorKey: "pixel", acct: "PE-FAKE-4004" }, translation: { text: "Winning: bad cached translation" } }] };
  const env = { AI: { run: async (model, input) => { calls.push({ model, ...input }); return { translated_text: input.text.toUpperCase() }; } } };
  const app = createApp({ store: { load: async () => structuredClone(state), save: async (s) => { state = structuredClone(s); } },
    auth: { load: async () => ({ sessions: { test: { email: "qa@example.com", at: Date.now() } } }) }, env });
  const call = async () => (await app(new Request("https://clearhold.example/api/entry/F001/translate", { method: "POST", headers: { cookie: "sid=test" } }))).json();
  const result = await call();
  assert.equal(result.version, TRANSLATION_VERSION);
  assert.equal(result.text, "Due date: 30/10/2026\nAccount: PE-FAKE-4004\nVendor: Pixel Norte SAS\nDescription: SERVICIO DE Pixel Norte SAS\nNOTA: CONSULTAR A billing@pixel.example EL 2026-10-30");
  assert.equal(calls.length, 2, "label/entity-only lines skip the model");
  assert.ok(calls.every((c) => !c.text.includes("Pixel") && !c.text.includes("billing@") && c.target_lang === "en"));
  assert.deepEqual(await call(), result);
  assert.equal(calls.length, 2, "versioned result is cached");
  state.log[0].translation.version = 0;
  env.AI.run = async () => ({ translated_text: "Winning: lost all placeholders" });
  assert.equal((await call()).text, sourceText.split("\n").map(preTranslate).join("\n"));
});
