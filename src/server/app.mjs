// Runtime-agnostic HTTP app (Request -> Response). Used by the Cloudflare Worker and the local Node server.
// store: { load(): Promise<state|null>, save(state): Promise<void> }. env: secrets (FASTINO_API_KEY, JEV_API_KEY) — never returned.
import defaultRules from "../../config/rules.json" with { type: "json" };
import { VENDORS } from "../data/vendors.mjs";
import { processDoc } from "../pipeline.mjs";
import { newLedger, approve } from "../engine/decide.mjs";
import { fromEnv } from "../adapters/index.mjs";
import { pain001 } from "../output/pain001.mjs";
import { generate, renderEmail, renderChat, bodyLines, rng } from "../gen/generator.mjs";
import { textPdf } from "../gen/pdf.mjs";
import { score, counts } from "../score.mjs";
import { UI } from "./ui.mjs";
import { DEMO } from "./demo.mjs";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8" } });
const fresh = (rules = structuredClone(defaultRules)) => ({ rules, ledger: newLedger(), log: [], seq: 0 });
const noModel = { name: "sin modelo", async ask() { return { error: "modelo no configurado" }; } };
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function validateRules(r) {
  const nums = ["max_per_payment_usd", "human_approval_above_usd", "vendor_period_cap_usd", "period_budget_usd", "duplicate_window_days"];
  for (const k of nums) if (typeof r[k] !== "number" || !(r[k] >= 0)) return `${k} debe ser un número ≥ 0`;
  if (r.human_approval_above_usd > r.max_per_payment_usd) return "La aprobación humana debe ser ≤ al límite por pago";
  const [lo, hi] = r.uncertain_band ?? [];
  if (!(0 <= lo && lo < hi && hi <= 1)) return "uncertain_band inválida";
  if (!Array.isArray(r.allowlist) || r.allowlist.some((k) => !VENDORS[k])) return "allowlist inválida";
  return null;
}
// Allowlist is applied by masking vendorKey for disabled vendors (engine then treats them as unknown => escalate).
const withAllow = (rules, x) => (x.vendorKey && !(rules.allowlist ?? Object.keys(VENDORS)).includes(x.vendorKey) ? { ...x, vendorKey: null } : x);

async function runDoc(st, doc, adapter) {
  const id = `F${String(++st.seq).padStart(3, "0")}`;
  const pre = await processDoc({ ...doc, id }, { ledger: st.ledger, rules: st.rules, adapter, mapExtracted: (x) => withAllow(st.rules, x) });
  return { ...pre, file: doc.filename ?? null };
}

export function createApp({ store, env = {} }) {
  const adapter = () => fromEnv(env) ?? noModel;
  const load = async () => { const s = (await store.load()) ?? fresh(); s.rules.allowlist ??= Object.keys(VENDORS); return s; };
  return async function handle(req) {
    const url = new URL(req.url), p = url.pathname, m = req.method;
    try {
      if (m === "GET" && p === "/") return new Response(UI, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (m === "GET" && p === "/demo/index.json") return json(Object.keys(DEMO));
      if (m === "GET" && p.startsWith("/demo/") && DEMO[p.slice(6)]) {
        const f = p.slice(6), type = f.endsWith(".pdf") ? "application/pdf" : f.endsWith(".png") ? "image/png" : "text/plain; charset=utf-8";
        return new Response(b64(DEMO[f]), { headers: { "content-type": type } });
      }
      if (m === "GET" && p === "/api/state") {
        const st = await load();
        return json({ rules: st.rules, vendors: Object.fromEntries(Object.entries(VENDORS).map(([k, v]) => [k, { name: v.name, country: v.country, currency: v.currency }])),
          log: st.log, counts: counts(st.log), spentUsd: st.ledger.spentUsd, model: adapter().name });
      }
      if (m === "POST" && p === "/api/invoice") {
        const body = await req.json(), st = await load();
        const kind = ["email", "chat", "pdf", "image"].includes(body.kind) ? body.kind : "email";
        const doc = { kind, filename: body.filename, text: body.text, ocrConfidence: body.ocrConfidence, buffer: body.pdfBase64 ? b64(body.pdfBase64) : undefined };
        if (doc.text == null && !doc.buffer) return json({ error: "Falta el contenido" }, 400);
        if (kind === "pdf" && doc.buffer) doc.text = undefined;
        const e = await runDoc(st, doc, adapter());
        st.log.push(e); await store.save(st); return json(e);
      }
      const dm = p.match(/^\/api\/invoice\/(F\d+)\/(approve|reject)$/);
      if (m === "POST" && dm) {
        const st = await load(), e = st.log.find((l) => l.id === dm[1]);
        if (!e) return json({ error: "No existe" }, 404);
        if (e.action !== "escalate") return json({ error: "Solo se deciden facturas pendientes" }, 409);
        if (dm[2] === "reject") { e.action = "hold"; e.reasons = [...e.reasons, "Rechazada por una persona de finanzas."]; }
        else {
          const r = approve(e, st.ledger, st.rules);
          if (!r.ok) return json({ error: r.reason }, 409);
          e.action = "pay"; e.reasons = [...e.reasons, "Aprobada por una persona de finanzas; reglas duras verificadas de nuevo."];
        }
        e.reason = e.reasons.join(" "); e.decidedBy = "human"; await store.save(st); return json(e);
      }
      if (m === "PUT" && p === "/api/rules") {
        const st = await load(), r = { ...st.rules, ...(await req.json()) };
        for (const k of ["fx_to_usd", "agreements", "company", "period", "base_currency"]) r[k] = st.rules[k]; // not editable from UI
        const err = validateRules(r); if (err) return json({ error: err }, 400);
        st.rules = r; await store.save(st); return json(r);
      }
      if (m === "POST" && p === "/api/reset") { const st = await load(); await store.save(fresh(st.rules)); return json({ ok: true }); }
      if (m === "GET" && p === "/api/pain001") {
        const st = await load(), pays = st.log.filter((l) => l.action === "pay").map((l) => ({ id: l.id, ...l.extracted }));
        return new Response(pain001(pays, { msgId: `NWR-${Date.now()}` }), { headers: { "content-type": "application/xml", "content-disposition": "attachment; filename=pain001.xml" } });
      }
      if (m === "POST" && p === "/api/stress") return stress(await req.json().catch(() => ({})), (await load()).rules, adapter());
      return json({ error: "not found" }, 404);
    } catch (e) { return json({ error: String(e?.message ?? e) }, 500); }
  };
}

/** Stress test on a separate ledger; streams NDJSON: one line per invoice + running score. */
function stress({ seed = Math.floor(Math.random() * 1e6), n = 30 }, rules, adapter) {
  n = Math.min(Math.max(1, n | 0), 100);
  const inv = generate(seed, n), r = rng(seed), st = { rules, ledger: newLedger(), log: [], seq: 0 }, enc = new TextEncoder();
  const stream = new ReadableStream({ async start(c) {
    c.enqueue(enc.encode(JSON.stringify({ type: "start", seed, n }) + "\n"));
    for (const t of inv) {
      // email/chat/pdf go through the real extractors; images are simulated as their text layer here (OCR runs in the browser on uploads).
      const doc = t.format === "email" ? { kind: "email", text: renderEmail(t, r) } : t.format === "chat" ? { kind: "chat", text: renderChat(t, r) }
        : t.format === "pdf" ? { kind: "pdf", buffer: textPdf(bodyLines(t, r)) } : { kind: "image", text: bodyLines(t, r).join("\n"), ocrConfidence: 95 };
      const e = await processDoc({ ...doc, id: t.id }, { ledger: st.ledger, rules, adapter, mapExtracted: (x) => withAllow(rules, x) });
      st.log.push(e);
      const s = score(st.log, inv, rules);
      c.enqueue(enc.encode(JSON.stringify({ type: "row", id: e.id, channel: e.channel, lang: e.extracted?.lang, action: e.action, reason: e.reason, truth: t.tags[0], score: { ...s, improper: s.improper.length, improperList: s.improper } }) + "\n"));
    }
    c.close();
  } });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
}
