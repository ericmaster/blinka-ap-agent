// Browser e2e: "Reset my demo" fully refreshes state and UI, so the guided demo, "Process new" and manual upload work again without a reload.
// Not part of `npm test` (needs Chrome): CHROME=/usr/bin/google-chrome node test/e2e/reset.e2e.mjs [url]  (default http://localhost:8796, `npm start`)
// puppeteer-core is resolved from PUPPETEER_DIR (a folder with node_modules/puppeteer-core); it is not a project dependency.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { accessSync } from "node:fs";
const U = process.argv[2] ?? "http://localhost:8796";
import { createRequire } from "node:module";
const req = createRequire(resolve(process.env.PUPPETEER_DIR ?? ".", "x.js"));
let puppeteer; try { puppeteer = req("puppeteer-core"); } catch { console.error("puppeteer-core not found: set PUPPETEER_DIR to a folder whose node_modules has it"); process.exit(2); }
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
p.on("dialog", (d) => d.accept()); const errors = []; p.on("pageerror", (e) => errors.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (m) => console.log("PASS", m);
try {
await p.goto(U, { waitUntil: "networkidle2" });
await p.type("#em", `reset-e2e-${Date.now()}@reset${Date.now()}.example.com`); await p.click("#lgo");
await p.waitForSelector("#demoCode b", { visible: true }); await p.type("#otp", await p.$eval("#demoCode b", (e) => e.textContent)); await p.click("#lgo");
await p.waitForSelector("#gRun:not([disabled])", { visible: true });
await p.click('header [data-lang="es"]');
assert.equal(await p.$eval('nav a[href="/architecture"]', e => e.textContent), "Arquitectura");
const centers = await p.$$eval("header > *", elements => elements.map(e => e.getBoundingClientRect()).filter(r => r.width && r.height).map(r => r.y + r.height / 2));
assert.ok(Math.max(...centers) - Math.min(...centers) < 1, "Spanish header stays on one row at 1440px");
const architecture = await b.newPage(); architecture.on("pageerror", e => errors.push(e.message));
await architecture.setViewport({ width: 1440, height: 1000 });
await architecture.goto(`${U}/architecture/`, { waitUntil: "networkidle2" });
assert.equal(await architecture.$eval("html", e => e.lang), "es", "architecture shares saved language");
assert.equal(await architecture.$eval("h1", e => e.textContent), "Cómo decide Clearhold");
assert.deepEqual(await architecture.$$eval(".node text", elements => elements.filter(t => { const r = t.getBBox(), box = t.closest("g").querySelector("rect").getBBox(); return r.x + r.width > box.x + box.width - 6; }).map(t => t.textContent)), [], "Spanish SVG labels fit their boxes");
await architecture.click('[data-lang="en"]');
await p.waitForFunction(() => document.documentElement.lang === "en");
assert.equal(await architecture.$eval("h1", e => e.textContent), "How Clearhold decides");
await architecture.close(); ok("architecture shares EN/ES across tabs; Spanish header and SVG labels fit");
const guided = async () => {
  await p.waitForSelector("#gRun:not([disabled])", { visible: true, timeout: 30000 }); await p.click("#gRun");
  await p.waitForFunction(() => !busy && !document.querySelector("#gRun") && document.querySelectorAll("#guide li .pill").length === 3, { timeout: 180000 });
  return p.$$eval("#guide li", (ls) => ls.map((l) => l.querySelector(".pill").textContent.trim()));
};
const reset = async () => { await p.click("#rst"); await p.waitForFunction(() => /Demo reset/.test(document.querySelector("#toast").textContent) && !busy, { timeout: 30000 }); await wait(300); };
assert.deepEqual(await guided(), ["Paid", "Held", "Held"]); ok("guided demo #1");
await p.click('.sub .tab[data-q="hold"]');
// Seed stale presentation state without spending model calls on a full stress run.
await p.evaluate(() => { lastStress = { improper: 2, correctAutonomy: 0.5 }; mix = "traps"; $("#sinfo").removeAttribute("data-t"); $("#sinfo").textContent = "old seed"; ["#sA", "#sS", "#sE"].forEach(s => { $(s).textContent = "old score"; $(s).className = "bad"; }); $("#txt").value = "stale draft"; $("#drop").classList.add("over"); });
await reset();
const st = await p.evaluate(() => ({ log: S.log.length, gRun: !!document.querySelector("#gRun") && !document.querySelector("#gRun").disabled, proc: [$("#proc").textContent, $("#proc").disabled], tab: document.querySelector(".sub .tab.on").dataset.q }));
assert.equal(st.log, 0); assert.ok(st.gRun, "guided demo button enabled after reset"); assert.equal(st.proc[1], false, `Process new enabled: ${st.proc}`); assert.equal(st.tab, "escalate");
assert.deepEqual(await p.evaluate(() => ({ stress: lastStress, mix, scores: ["#sA", "#sS", "#sE"].map(s => $(s).textContent), info: $("#sinfo").textContent, draft: $("#txt").value, file: $("#file").value, over: $("#drop").classList.contains("over") })), { stress: null, mix: "realistic", scores: ["–", "–", "–"], info: "random invoices with noise", draft: "", file: "", over: false });
ok("reset clears queue, re-enables guided demo and Process new, resets the tab");
assert.deepEqual(await guided(), ["Paid", "Held", "Held"]); ok("guided demo #2 after reset, no reload");
// manual upload, reset, same file again
const file = resolve("data/curated/C23.pdf");
accessSync(file);
const upload = async () => { const before = await p.evaluate(() => S.log.length); const [inp] = await p.$$("#file"); await inp.uploadFile(file); await p.waitForFunction((n) => S.log.length > n, { timeout: 60000 }, before); };
await reset(); await upload(); ok("manual upload after reset");
await reset(); await upload(); ok("same file uploaded again after a second reset");
// Process new works after reset
await reset(); await p.click("#proc"); await p.waitForFunction(() => S.log.length >= 3, { timeout: 120000 }); ok("Process new runs after reset");
assert.deepEqual(errors, []); ok("no page errors");
} finally { await b.close(); }
