import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import worker from "../src/worker.mjs";
import { UI } from "../src/server/ui.mjs";
import { ARCHITECTURE } from "../src/server/architecture.mjs";
import { UI_ES } from "../src/i18n/ui.mjs";

test("architecture: both public Worker routes return HTML with the inline SVG and EN/ES content", async () => {
  for (const path of ["/architecture", "/architecture/"]) {
    const response = await worker.fetch(new Request(`https://clearhold.example${path}`), { STATE: { get: async () => null } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.equal(html, ARCHITECTURE);
    assert.match(html, /<svg[^>]+role="img"/);
    for (const key of ["Worker ingest", "Browser OCR", "Hard rules engine", "NER fields + evidence", "Model: veto-only", "GLiDE primary → JEV fallback", "p 0.2–0.8 or error → escalate", "Pay / Hold / Escalate", "Audit log in KV", "Mock Blinka payout"]) {
      assert.ok(html.includes(key), key);
      assert.ok(html.includes(UI_ES[key]), UI_ES[key]);
    }
    for (const status of ["mail", "chat", "blinka"]) assert.match(html, new RegExp(`id="${status}" class="node simulated"`));
    for (const status of ["upload", "ocr", "ingest", "extract", "ner", "rules", "model", "decision", "audit", "xml"]) assert.match(html, new RegExp(`id="${status}" class="node real"`));
    assert.ok(html.includes("config/rules.json"));
    assert.ok(!html.includes("/pitch/"));
  }
});

test("architecture: app link opens safely in a new tab and uses the existing dictionary", () => {
  assert.match(UI, /<a class="ext" href="\/architecture" target="_blank" rel="noopener" data-t>Architecture<\/a>/);
  assert.equal(UI_ES.Architecture, "Arquitectura");
});

test("architecture: every translatable string has Spanish coverage", () => {
  const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
  const entries = [...ARCHITECTURE.matchAll(/data-en="([^"]+)" data-es="([^"]+)"/g)];
  assert.ok(entries.length > 40);
  for (const [, en, es] of entries) assert.equal(decode(es), UI_ES[decode(en)], decode(en));
});

test("architecture: shared toggle defaults EN, persists ES and responds to cross-tab changes", () => {
  const script = ARCHITECTURE.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const saved of [null, "es"]) {
    const events = {}, storage = new Map(saved ? [["clearhold.lang", saved]] : []);
    const title = { dataset: { en: "Architecture", es: "Arquitectura" }, textContent: "" };
    const buttons = ["en", "es"].map((lang) => ({ dataset: { lang }, classList: { toggle() {} } }));
    const document = { documentElement: {}, querySelectorAll: (q) => q === "[data-en]" ? [title] : buttons, addEventListener: (name, fn) => { events[name] = fn; } };
    runInNewContext(script, { document, window: { addEventListener: (name, fn) => { events[name] = fn; } }, localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) } });
    assert.equal(document.documentElement.lang, saved ?? "en");
    events.click({ target: { closest: () => buttons[1] } });
    assert.equal(storage.get("clearhold.lang"), "es");
    assert.equal(title.textContent, "Arquitectura");
    events.storage({ key: "clearhold.lang", newValue: "en" });
    assert.equal(document.documentElement.lang, "en");
    assert.equal(title.textContent, "Architecture");
  }
});
