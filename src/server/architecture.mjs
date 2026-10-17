// Public, self-contained page: no extra asset routes, external services or customer data.
// Topology: host.mjs connectors → app.mjs run → pipeline.mjs → engine/decide.mjs.
// Status labels follow docs/REAL-VS-SIMULATED.md (real mechanisms, synthetic inputs).
import { LANG_KEY, UI_ES } from "../i18n/ui.mjs";

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const t = (key) => {
  if (!UI_ES[key]) throw new Error(`Missing architecture translation: ${key}`);
  return `data-en="${esc(key)}" data-es="${esc(UI_ES[key])}"`;
};
const text = (x, y, key, cls = "") => `<text x="${x}" y="${y}" class="${cls}" ${t(key)}>${esc(key)}</text>`;
const node = (id, x, y, w, h, title, lines, simulated = false, code = "") => `<g id="${id}" class="node ${simulated ? "simulated" : "real"}">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>
  ${text(x + 18, y + 26, simulated ? "Simulated" : "Real", "badge")}
  ${text(x + 18, y + 55, title, "node-title")}
  ${lines.map((line, i) => text(x + 18, y + 80 + i * 23, line, "detail")).join("")}
  ${code ? `<text x="${x + 18}" y="${y + 80 + lines.length * 23}" class="detail">${esc(code)}</text>` : ""}
</g>`;
const arrow = (d, cls = "") => `<path class="edge ${cls}" d="${d}" marker-end="url(#arrow)"/>`;

export const ARCHITECTURE = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clearhold · Architecture</title><style>
:root{--bg:#f7f7f4;--fg:#1c253a;--mut:#656975;--line:#dedfdc;--pay:#1f8a5b;--hold:#c98a12;--esc:#c2410c;--acc:#2a4bd0;--soft:#b9c8ff;--surface:#fdfdfd}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 Inter,ui-sans-serif,system-ui,sans-serif}
header,main{max-width:1280px;margin:auto;padding:24px}header{display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--line)}.brand{font-size:20px;font-weight:600}.brand small{font-size:12px;color:var(--mut)}a{color:var(--acc)}header a{margin-left:auto}.lng{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;flex:none}.lng button{border:0;padding:3px 7px;font:12px/1.5 inherit;background:#fff;color:var(--mut);cursor:pointer}.lng button.on{background:var(--fg);color:#fff}
h1{font-size:34px;letter-spacing:-1px;margin:8px 0}p{margin:8px 0 16px}.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--mut);font-size:13px}.legend b{padding:3px 10px;border:1.5px solid var(--pay);border-radius:8px;color:var(--fg)}.legend b.sim{border-color:var(--hold);border-style:dashed}
.diagram{margin-top:20px;border:1px solid var(--line);border-radius:20px;background:var(--surface);overflow-x:auto}svg{display:block;width:100%;min-width:900px;height:auto}.node rect{fill:var(--surface);stroke:var(--line);stroke-width:1.5}.real rect{stroke:var(--pay)}.simulated rect{stroke:var(--hold);stroke-dasharray:7 5}.badge{fill:var(--pay);font-size:12px;font-weight:600;letter-spacing:.5px}.simulated .badge{fill:var(--mut)}text{fill:var(--fg);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.node-title{font-size:18px;font-weight:600}.detail{font-size:13px;fill:var(--mut)}.edge{fill:none;stroke:var(--acc);stroke-width:2}.bypass{stroke:var(--hold);stroke-dasharray:6 4}.edge-label{font-size:13px;fill:var(--acc)}.notes{border-left:3px solid var(--soft);padding-left:18px;margin-top:24px;color:var(--mut)}.notes p{margin:8px 0}footer{margin-top:24px;font-size:13px;color:var(--mut)}@media(max-width:600px){header,main{padding:16px}header{flex-wrap:wrap}h1{font-size:28px}}
</style></head><body>
<header><span class="brand">Clearhold <small>by Blinka</small></span><a href="/" ${t("Back to Clearhold")}>Back to Clearhold</a><span class="lng" data-lng title="Language / Idioma"><button data-lang="en" class="on">EN</button><button data-lang="es">ES</button></span></header>
<main><h1 ${t("How Clearhold decides")}>How Clearhold decides</h1><p ${t("Hard rules own the decision. The model can veto, never authorize a payment.")}>Hard rules own the decision. The model can veto, never authorize a payment.</p>
<div class="legend"><b ${t("Real")}>Real</b><b class="sim" ${t("Simulated")}>Simulated</b><span ${t("Dashed boxes are simulated services. No money moves.")}>Dashed boxes are simulated services. No money moves.</span></div>
<div class="diagram" tabindex="0" aria-label="Clearhold architecture / Arquitectura Clearhold">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 1010" role="img" aria-labelledby="diagram-title diagram-desc">
<title id="diagram-title" ${t("Architecture")}>Architecture</title><desc id="diagram-desc" ${t("Hard rules own the decision. The model can veto, never authorize a payment.")}>Hard rules own the decision. The model can veto, never authorize a payment.</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2a4bd0"/></marker></defs>
${arrow("M170 150V200H225V260")}${arrow("M470 150V200H225")}${arrow("M770 150V200H470")}${arrow("M1070 150V200H770")}
${arrow("M900 95H940")}
${node("mail", 40, 40, 260, 110, "Mock mail API", [], true, "/mail/ · /mail/api")}
${node("chat", 340, 40, 260, 110, "Mock WhatsApp API", [], true, "/chat/ · /chat/api")}
${node("upload", 640, 40, 260, 110, "Manual upload", ["PDF / text / images"])}
${node("ocr", 940, 40, 260, 110, "Browser OCR", ["Images → tesseract.js"])}
${arrow("M410 320H470")}${arrow("M800 320H860")}
${node("ingest", 40, 260, 370, 125, "Worker ingest", ["Connectors + authenticated workspace"], false, "/api/sync · /api/process · /api/upload")}
${node("extract", 470, 260, 330, 125, "Extraction", ["unpdf: PDF text; OCR text passthrough", "PDF / text / images"])}
${node("ner", 860, 260, 340, 150, "NER fields + evidence", ["Regex / heuristics, not a NER model", "Payee, amount, currency, due date", "Evidence spans + confidence"])}
${arrow("M1030 410V470")}${arrow("M860 550H800")}${arrow("M470 550H410")}
${node("rules", 860, 470, 340, 180, "Hard rules engine", ["Vendor registry + fingerprint dedupe", "Limits, budget, agreement, bank account", "Dual approval: vendor changes / overrides"], false, "config/rules.json")}
${text(704, 455, "No hard hold", "edge-label")}
${node("model", 470, 470, 330, 180, "Model: veto-only", ["GLiDE primary → JEV fallback", "Duplicate? Matches agreement?", "p 0.2–0.8 or error → escalate"])}
${node("decision", 40, 470, 370, 180, "Decision in code", ["Pay / Hold / Escalate", "Human approval re-checks hard rules"])}
${arrow("M1030 650V700H430V615H410", "bypass")}${text(452, 690, "Hard-rule hold bypasses model", "detail")}
${arrow("M225 650V790")}
${node("audit", 40, 790, 370, 140, "Audit log in KV", ["Reasons, evidence, history per workspace", "Real implementation · synthetic demo data"])}
${arrow("M410 855H450V760H500")}${arrow("M450 855V935H500")}${text(463, 858, "Paid invoices only", "edge-label")}
${node("xml", 500, 715, 700, 110, "pain.001 XML", ["Real ISO 20022 format; no bank delivery"])}
${node("blinka", 500, 885, 700, 110, "Mock Blinka payout", ["Idempotent sandbox via connector"], true)}
</svg></div>
<aside class="notes">${["Live models are real APIs; CI uses fake adapters. Without keys, the model path escalates.", "Vendors, invoices, contracts and history are synthetic; FX rates are a fixed simulated table.", "Browser OCR is real and requires human confirmation. Local Node extraction also supports server-side OCR."].map((key) => `<p ${t(key)}>${esc(key)}</p>`).join("")}</aside>
<footer>Source: docs/REAL-VS-SIMULATED.md · src/server/host.mjs · src/server/app.mjs · src/pipeline.mjs · src/engine/decide.mjs · src/adapters/index.mjs</footer></main>
<script>
const LANG_KEY=${JSON.stringify(LANG_KEY)};
function setLang(value){const lang=value==="es"?"es":"en";document.documentElement.lang=lang;document.title="Clearhold · "+(lang==="es"?"Arquitectura":"Architecture");document.querySelectorAll("[data-en]").forEach(el=>el.textContent=el.dataset[lang]);document.querySelectorAll("[data-lang]").forEach(b=>b.classList.toggle("on",b.dataset.lang===lang))}
document.addEventListener("click",e=>{const b=e.target.closest("[data-lang]");if(b){localStorage.setItem(LANG_KEY,b.dataset.lang);setLang(b.dataset.lang)}});
window.addEventListener("storage",e=>{if(e.key===LANG_KEY)setLang(e.newValue)});setLang(localStorage.getItem(LANG_KEY));
</script></body></html>`;
