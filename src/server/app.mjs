// Runtime-agnostic HTTP app (Request -> Response) for the Cloudflare Worker and the local Node server.
// store: { load, save, getBlob(id), putBlob(id, b64) }. env: FASTINO_API_KEY, JEV_API_KEY, AI (Workers AI binding), DEMO_MODE. Secrets are never returned.
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
import { SEED, SEED_BLOBS } from "./seed.mjs";

const json = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...h } });
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const channels = () => ({ emails: SEED.emails.map((e) => ({ ...e })), chats: SEED.chats.map((c) => ({ ...c })) });
const fresh = (prev = {}) => ({ rules: prev.rules ?? structuredClone(defaultRules), ledger: newLedger(), log: [], seq: 0, channels: channels(), uploads: [],
  users: prev.users ?? {}, sessions: prev.sessions ?? {}, otps: {} });
const noModel = { name: "no model configured", async ask() { return { error: "model not configured" }; } };
const MAX_UPLOAD = 4 * 1024 * 1024;

export function validateRules(r) {
  for (const k of ["max_per_payment_usd", "human_approval_above_usd", "vendor_period_cap_usd", "period_budget_usd", "duplicate_window_days"])
    if (typeof r[k] !== "number" || !(r[k] >= 0)) return `${k} must be a number ≥ 0`;
  if (r.human_approval_above_usd > r.max_per_payment_usd) return "Human approval threshold must be ≤ the per-payment limit";
  const [lo, hi] = r.uncertain_band ?? [];
  if (!(0 <= lo && lo < hi && hi <= 1)) return "invalid uncertain_band";
  if (!Array.isArray(r.allowlist) || r.allowlist.some((k) => !VENDORS[k])) return "invalid allowlist";
  return null;
}
const withAllow = (rules, x) => (x.vendorKey && !(rules.allowlist ?? Object.keys(VENDORS)).includes(x.vendorKey) ? { ...x, vendorKey: null } : x);
const cookie = (req) => Object.fromEntries((req.headers.get("cookie") ?? "").split(/;\s*/).filter(Boolean).map((c) => c.split("=")));

export function createApp({ store, env = {} }) {
  const demo = env.DEMO_MODE !== "false";
  const adapter = () => fromEnv(env) ?? noModel;
  const load = async () => { const s = (await store.load()) ?? fresh(); s.rules.allowlist ??= Object.keys(VENDORS); s.channels ??= channels(); s.users ??= {}; s.sessions ??= {}; s.otps ??= {}; s.uploads ??= []; return s; };
  const blob = async (id) => SEED_BLOBS[id] ?? (await store.getBlob?.(id)) ?? null;
  const msgOf = (st, id) => st.channels.emails.find((e) => e.id === id) ?? st.channels.chats.find((c) => c.id === id);

  async function run(st, doc, source) {
    const id = `F${String(++st.seq).padStart(3, "0")}`;
    const e = await processDoc({ ...doc, id }, { ledger: st.ledger, rules: st.rules, adapter: adapter(), mapExtracted: (x) => withAllow(st.rules, x) });
    e.source = source; e.at = new Date().toISOString(); e.history = [{ by: "agent", at: e.at, action: e.action }];
    st.log.push(e); return e;
  }

  return async function handle(req) {
    const url = new URL(req.url), p = url.pathname, m = req.method;
    try {
      if (m === "GET" && p === "/") return new Response(UI, { headers: { "content-type": "text/html; charset=utf-8" } });
      // ---- auth: email + one-time code. DEMO MODE returns the code in the response (no email is sent).
      if (m === "POST" && p === "/api/auth/start") {
        const { email } = await req.json(), st = await load();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? "")) return json({ error: "Enter a valid email" }, 400);
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, "0");
        st.otps[email.toLowerCase()] = { code, exp: Date.now() + 10 * 60000, tries: 0 }; await store.save(st);
        return json(demo ? { sent: false, demo: true, code } : { sent: true });
      }
      if (m === "POST" && p === "/api/auth/verify") {
        const { email, code } = await req.json(), st = await load(), k = (email ?? "").toLowerCase(), o = st.otps[k];
        if (!o || o.exp < Date.now() || o.tries >= 5) return json({ error: "Code expired, request a new one" }, 401);
        if (o.code !== String(code).trim()) { o.tries++; await store.save(st); return json({ error: "Wrong code" }, 401); }
        delete st.otps[k]; st.users[k] ??= { email: k, createdAt: new Date().toISOString() }; // auto-register
        const sid = rand(24); st.sessions[sid] = { email: k, at: Date.now() }; await store.save(st);
        return json({ email: k }, 200, { "set-cookie": `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${url.protocol === "https:" ? "; Secure" : ""}` });
      }
      if (m === "POST" && p === "/api/auth/logout") return json({ ok: true }, 200, { "set-cookie": "sid=; Path=/; Max-Age=0" });
      if (p.startsWith("/api/")) {
        var st0 = await load(), user = st0.sessions[cookie(req).sid]?.email;
        if (!user) return json({ error: "auth required" }, 401);
      }
      const st = st0;
      if (m === "GET" && p === "/api/state") {
        return json({ user, demo, rules: st.rules, model: adapter().name, translation: env.AI ? "Workers AI (m2m100)" : null,
          vendors: Object.fromEntries(Object.entries(VENDORS).map(([k, v]) => [k, { name: v.name, country: v.country, currency: v.currency }])),
          log: st.log.map(({ sourceText, schema, checks, ...e }) => e), counts: counts(st.log), spentUsd: st.ledger.spentUsd, channels: st.channels });
      }
      // ---- channel feed -> queue
      if (m === "POST" && p === "/api/process") {
        const { messageId, ocr } = await req.json(), msg = msgOf(st, messageId);
        if (!msg) return json({ error: "No such message" }, 404);
        if (msg.entryId) return json({ error: "Already processed" }, 409);
        const att = msg.attachment ?? msg.attachments?.[0], channel = messageId.startsWith("m-") ? "email" : "whatsapp";
        let doc;
        if (att?.type === "application/pdf") doc = { kind: "pdf", buffer: fromB64(await blob(att.id)) };
        else if (att?.type?.startsWith("image/")) { if (!ocr?.text) return json({ error: "needs OCR", needOcr: att.id }, 422); doc = { kind: "image", text: ocr.text, ocrConfidence: ocr.confidence }; }
        else doc = { kind: channel === "email" ? "email" : "chat", text: channel === "email" ? `Subject: ${msg.subject}\n\n${msg.body}` : `[${msg.at.slice(0, 10)}] ${msg.from}: ${msg.text}` };
        const e = await run(st, doc, { channel, messageId, attachmentId: att?.id ?? null, name: att?.name ?? null, type: att?.type ?? "text/plain" });
        msg.entryId = e.id; await store.save(st); return json(e);
      }
      if (m === "POST" && p === "/api/upload") {
        const b = await req.json();
        if ((b.fileBase64?.length ?? 0) * 0.75 > MAX_UPLOAD || (b.text?.length ?? 0) > 200000) return json({ error: "File too large (max 4 MB)" }, 413);
        const kind = b.type === "application/pdf" ? "pdf" : b.type?.startsWith("image/") ? "image" : /^\s*\[\d{4}-\d{2}-\d{2}/.test(b.text ?? "") ? "chat" : "email";
        if (kind === "image" && !b.ocr?.text) return json({ error: "needs OCR" }, 422);
        const attId = b.fileBase64 ? `u-${rand(8)}` : null;
        if (attId) await store.putBlob(attId, b.fileBase64);
        const doc = kind === "pdf" ? { kind, buffer: fromB64(b.fileBase64) } : kind === "image" ? { kind, text: b.ocr.text, ocrConfidence: b.ocr.confidence } : { kind, text: b.text };
        const e = await run(st, doc, { channel: "upload", messageId: null, attachmentId: attId, name: b.filename ?? null, type: b.type ?? "text/plain" });
        st.uploads.push({ entryId: e.id, by: user, at: e.at, name: b.filename }); await store.save(st); return json(e);
      }
      let mm;
      if (m === "GET" && (mm = p.match(/^\/api\/blob\/([\w-]+)$/))) {
        const b = await blob(mm[1]); if (!b) return json({ error: "not found" }, 404);
        const att = [...st.channels.emails.flatMap((e) => e.attachments), ...st.channels.chats.map((c) => c.attachment).filter(Boolean)].find((a) => a.id === mm[1])
          ?? st.log.map((e) => e.source).find((s) => s?.attachmentId === mm[1]);
        const name = att?.name ?? mm[1], type = att?.type ?? "application/octet-stream";
        return new Response(fromB64(b), { headers: { "content-type": type, "content-disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${name.replace(/[^\w.\-]/g, "_")}"` } });
      }
      if (m === "GET" && (mm = p.match(/^\/api\/entry\/(F\d+)$/))) {
        const e = st.log.find((l) => l.id === mm[1]); return e ? json(e) : json({ error: "not found" }, 404);
      }
      if (m === "POST" && (mm = p.match(/^\/api\/entry\/(F\d+)\/translate$/))) {
        const e = st.log.find((l) => l.id === mm[1]); if (!e) return json({ error: "not found" }, 404);
        const lang = e.extracted?.lang;
        if (lang === "en") return json({ text: e.sourceText, lang, note: "Already in English" });
        if (e.translation) return json(e.translation);
        if (!env.AI) return json({ text: null, lang, note: "Translation unavailable here (no translation model configured); showing the original." });
        const parts = (e.sourceText ?? "").split("\n"), out = [];
        for (const line of parts) out.push(line.trim() ? (await env.AI.run("@cf/meta/m2m100-1.2b", { text: line, source_lang: lang, target_lang: "en" })).translated_text : line);
        e.translation = { text: out.join("\n"), lang, note: "Machine translation (Workers AI m2m100). Decisions always use the original text." };
        await store.save(st); return json(e.translation);
      }
      if (m === "POST" && (mm = p.match(/^\/api\/entry\/(F\d+)\/(approve|reject)$/))) {
        const e = st.log.find((l) => l.id === mm[1]);
        if (!e) return json({ error: "not found" }, 404);
        if (e.action !== "escalate") return json({ error: "Only pending invoices can be decided" }, 409);
        const at = new Date().toISOString();
        if (mm[2] === "reject") { e.action = "hold"; e.reasons = [...e.reasons, `Rejected by ${user} at ${at}.`]; }
        else {
          const r = approve(e, st.ledger, st.rules);
          if (!r.ok) return json({ error: r.reason }, 409);
          e.action = "pay"; e.reasons = [...e.reasons, `Approved by ${user} at ${at}; hard rules re-checked.`];
        }
        e.reason = e.reasons.join(" "); e.decidedBy = user; e.history = [...(e.history ?? []), { by: user, at, action: e.action }];
        await store.save(st); return json(e);
      }
      if (m === "PUT" && p === "/api/rules") {
        const r = { ...st.rules, ...(await req.json()) };
        for (const k of ["fx_to_usd", "agreements", "vendors", "company", "period", "base_currency"]) r[k] = st.rules[k];
        const err = validateRules(r); if (err) return json({ error: err }, 400);
        st.rules = r; await store.save(st); return json(r);
      }
      if (m === "POST" && p === "/api/reset") { await store.save(fresh(st)); return json({ ok: true }); }
      if (m === "GET" && p === "/api/pain001") {
        const pays = st.log.filter((l) => l.action === "pay").map((l) => ({ id: l.id, ...l.extracted }));
        return new Response(pain001(pays, { msgId: `NWR-${Date.now()}` }), { headers: { "content-type": "application/xml", "content-disposition": "attachment; filename=pain001.xml" } });
      }
      if (m === "POST" && p === "/api/stress") return stress(await req.json().catch(() => ({})), st.rules, adapter());
      return json({ error: "not found" }, 404);
    } catch (e) { return json({ error: String(e?.message ?? e) }, 500); }
  };
}

/** Stress test on a separate ledger; streams NDJSON: one line per invoice + running score. */
function stress({ seed = Math.floor(Math.random() * 1e6), n = 30 }, rules, adapter) {
  n = Math.min(Math.max(1, n | 0), 100);
  const inv = generate(seed, n), r = rng(seed), st = { rules, ledger: newLedger(), log: [] }, enc = new TextEncoder();
  const stream = new ReadableStream({ async start(c) {
    c.enqueue(enc.encode(JSON.stringify({ type: "start", seed, n }) + "\n"));
    for (const t of inv) {
      // email/chat/pdf go through the real extractors; images use their text layer here (OCR runs in the browser for channel images).
      const doc = t.format === "email" ? { kind: "email", text: renderEmail(t, r) } : t.format === "chat" ? { kind: "chat", text: renderChat(t, r) }
        : t.format === "pdf" ? { kind: "pdf", buffer: textPdf(bodyLines(t, r)) } : { kind: "image", text: bodyLines(t, r).join("\n"), ocrConfidence: 95 };
      const e = await processDoc({ ...doc, id: t.id }, { ledger: st.ledger, rules, adapter, mapExtracted: (x) => withAllow(rules, x) });
      st.log.push(e);
      const s = score(st.log, inv, rules);
      c.enqueue(enc.encode(JSON.stringify({ type: "row", id: e.id, channel: e.channel, action: e.action, reason: e.reason, truth: t.tags[0], score: { ...s, improper: s.improper.length, improperList: s.improper } }) + "\n"));
    }
    c.close();
  } });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
}
