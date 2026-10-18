// Runtime-agnostic HTTP app (Request -> Response) for the Cloudflare Worker and the local Node server.
// store: { load, save, getBlob(id), putBlob(id, b64) }. env: FASTINO_API_KEY, JEV_API_KEY, AI (Workers AI binding), DEMO_MODE. Secrets are never returned.
import defaultRules from "../../config/rules.json" with { type: "json" };
import { VENDORS, COMPANY } from "../data/vendors.mjs";
import { contractMarkdown, contractHtml, contractPdf } from "../contracts.mjs";
import { processDoc } from "../pipeline.mjs";
import { newLedger, approve, registry, toUsd, hardChecks, checksFor, snapshot } from "../engine/decide.mjs";
import { fromEnv } from "../adapters/index.mjs";
import { pain001 } from "../output/pain001.mjs";
import { generate, renderEmail, renderChat, rng } from "../gen/generator.mjs";
import { invoicePdf } from "../gen/invoice.mjs";
import { pdfText } from "../extract/index.mjs";
import { score, counts, improper } from "../score.mjs";
import { curated } from "../gen/generator.mjs";
import { metrics, BENCHMARKS } from "../metrics.mjs";
import { createNotifier } from "../notify/index.mjs";
const MANIFEST = curated();
/** Header KPIs: all payments, using synthetic ground truth plus stored payment-time safety checks. */
export function kpis(st) {
  const held = st.log.filter((l) => l.action === "hold"), n = st.log.length;
  const paid = st.log.filter((l) => l.action === "pay");
  const evaluated = paid
    .map((l) => ({ ...l, id: /-(C\d+)$/.exec(l.source?.messageId ?? "")?.[1] })).filter((l) => l.id && MANIFEST.some((m) => m.id === l.id));
  return { heldUsd: Math.round(held.reduce((a, l) => a + (l.amountUsd ?? 0), 0)), stopped: held.length,
    autonomy: n ? Math.round((st.log.filter((l) => l.history?.at(-1)?.by === "agent" && l.action !== "escalate").length / n) * 100) : null,
    improper: new Set([...improper(evaluated, MANIFEST, st.rules).map((s) => s.split(":")[0]), ...paid.filter((e) => {
      const p = e.paidCheck;
      const hard = p?.hard ?? hardChecks({ ...e.extracted, id: e.id }, paymentLedger(st, e), st.rules).hold;
      return hard.length || ((p?.amountUsd ?? e.amountUsd) > (p?.threshold ?? st.rules.human_approval_above_usd) && new Set((p?.approvers ?? e.approvals ?? []).map((a) => (typeof a === "string" ? a : a.by).toLowerCase())).size < 2);
    }).map((e) => /-(C\d+)$/.exec(e.source?.messageId ?? "")?.[1] ?? e.id)]).size,
    evaluated: evaluated.length, notEvaluated: paid.length - evaluated.length, overrides: paid.filter((e) => e.paidOverride).length,
    ...metrics(st.log, (e) => MANIFEST.find((m) => m.id === /-(C\d+)$/.exec(e.source?.messageId ?? "")?.[1]) ?? null) };
}
// Remove this invoice's own booking when inspecting an older/crafted paid record.
function paymentLedger(st, e) {
  const l = structuredClone(st.ledger ?? newLedger()), x = e.extracted ?? {}, usd = e.amountUsd ?? 0;
  l.seen = l.seen.filter((h) => h.entryId !== e.id);
  if (e.action === "pay") { l.spentUsd = Math.max(0, l.spentUsd - usd); l.vendorPaidUsd[x.vendorKey] = Math.max(0, (l.vendorPaidUsd[x.vendorKey] ?? 0) - usd); if (registry(st.rules)[x.vendorKey]?.terms?.type === "hourly") l.unitsPaid[x.vendorKey] = Math.max(0, (l.unitsPaid[x.vendorKey] ?? 0) - x.amount / registry(st.rules)[x.vendorKey].terms.rate); }
  return l;
}
import { UI } from "./ui.mjs";
import { architecturePage } from "./architecture.mjs";
import { maskLine, unmask, TRANSLATION_VERSION } from "../i18n/translate.mjs";

const json = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...h } });
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const channels = () => ({ emails: [], chats: [] }); // filled by /api/sync from the connectors
const fresh = () => ({ rules: structuredClone(defaultRules), ledger: newLedger(), log: [], seq: 0, channels: channels(), uploads: [], audit: [] });
const noModel = { name: "no model configured", async ask() { return { error: "model not configured" }; } };
const MAX_UPLOAD = 4 * 1024 * 1024;
const SESSION_TTL = 7 * 864e5, OTP_MAX_PER_10MIN = 5;
class Conflict extends Error {}
const SENSITIVE = ["acct", "terms", "currency"]; // vendor fields that need a second approver

export function validateRules(r) {
  for (const k of ["max_per_payment_usd", "human_approval_above_usd", "vendor_period_cap_usd", "period_budget_usd", "duplicate_window_days"])
    if (typeof r[k] !== "number" || !(r[k] >= 0)) return `${k} must be a number ≥ 0`;
  if (r.human_approval_above_usd > r.max_per_payment_usd) return "Human approval threshold must be ≤ the per-payment limit";
  const [lo, hi] = r.uncertain_band ?? [];
  if (!(0 <= lo && lo < hi && hi <= 1)) return "invalid uncertain_band";
  if (!Array.isArray(r.allowlist) || r.allowlist.some((k) => !registry(r)[k])) return "invalid allowlist";
  if (r.allowlist.some((k) => r.pendingChanges?.[k]?.type === "add")) return "That vendor is waiting for a second approver";
  return null;
}
const withAllow = (rules, x) => (x.vendorKey && !(rules.allowlist ?? Object.keys(registry(rules))).includes(x.vendorKey) ? { ...x, vendorKey: null } : x);
const cookie = (req) => Object.fromEntries((req.headers.get("cookie") ?? "").split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf("="); return [c.slice(0, i), c.slice(i + 1)]; }));

export function createApp({ store, auth, env = {}, connectors = {}, resetMocks = async () => {}, model = null }) {
  // Auth (users, sessions, one-time codes) is one shared record; everything else is per workspace (store).
  const loadA = async () => { const a = (await auth.load()) ?? {}; a.users ??= {}; a.sessions ??= {}; a.otps ??= {}; a.otpLog ??= {}; return a; };
  const saveA = async (a) => { const cur = await auth.load(); if ((cur?.v ?? 0) !== (a.v ?? 0)) throw new Conflict("auth changed"); a.v = (a.v ?? 0) + 1; await auth.save(a); };
  const demo = env.DEMO_MODE !== "false";
  const adapter = () => model ?? fromEnv(env) ?? noModel;
  const notifier = createNotifier(env);
  // Optimistic concurrency: every save checks the stored version; a conflicting request is re-run from fresh state
  // (so the hard rules are re-evaluated against the current ledger before anything is booked). Requests are also serialized per isolate.
  const save = async (st) => { const cur = await store.load(); if ((cur?.v ?? 0) !== (st.v ?? 0)) throw new Conflict("state changed"); st.v = (st.v ?? 0) + 1; await store.save(st); };
  let chain = Promise.resolve();
  const serial = (fn) => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };
  const load = async () => { const s = (await store.load()) ?? fresh(); s.rules.pendingChanges ??= {}; s.otpLog ??= {}; s.rules.vendors ??= structuredClone(VENDORS); for (const [k, v] of Object.entries(s.rules.vendors)) if (!v.name || !v.terms) s.rules.vendors[k] = VENDORS[k] ? { ...structuredClone(VENDORS[k]), ...v, name: v.name ?? VENDORS[k].name, terms: v.terms ?? VENDORS[k].terms } : v; s.rules.allowlist ??= Object.keys(s.rules.vendors); s.channels ??= channels(); s.users ??= {}; s.sessions ??= {}; s.otps ??= {}; s.uploads ??= []; s.audit ??= []; return s; };
  const conn = (channel) => connectors[channel === "email" ? "email" : "whatsapp"];
  const attOf = (st, id) => { for (const e of st.channels.emails) { const a = e.attachments?.find((x) => x.id === id); if (a) return { ...a, channel: "email" }; }
    for (const c of st.channels.chats) if (c.attachment?.id === id) return { ...c.attachment, channel: "whatsapp" }; return null; };
  async function blobBytes(st, id) { // uploads live in Clearhold storage; channel attachments are fetched through the connector
    const up = await store.getBlob?.(id); if (up) return { bytes: fromB64(up) };
    const a = attOf(st, id); if (!a) return null; return conn(a.channel)?.attachment(id) ?? null; }
  const msgOf = (st, id) => st.channels.emails.find((e) => e.id === id) ?? st.channels.chats.find((c) => c.id === id);

  async function run(st, doc, source) {
    const id = `F${String(++st.seq).padStart(3, "0")}`;
    const e = await processDoc({ ...doc, id }, { ledger: st.ledger, rules: st.rules, adapter: adapter(), mapExtracted: (x) => withAllow(st.rules, x) });
    e.source = source; e.at = new Date().toISOString(); e.history = [{ by: "agent", at: e.at, action: e.action }];
    e.notifications = await notifier.notify(e, st.rules.vendors[e.extracted?.vendorKey]);
    st.log.push(e); return e;
  }

  const userOf = async (req) => { const a = await loadA(), s = a.sessions[cookie(req).sid]; return s && Date.now() - s.at < SESSION_TTL ? s.email : null; };
  async function handle(req0) {
    const body = req0.method === "GET" || req0.method === "HEAD" ? null : await req0.arrayBuffer();
    const mk = () => new Request(req0.url, { method: req0.method, headers: req0.headers, body });
    if (!body) return inner(mk());
    return serial(async () => { for (let i = 0; ; i++) { try { return await inner(mk(), true); } catch (e) { if (!(e instanceof Conflict)) return json({ error: String(e?.message ?? e) }, 500); if (i >= 4) return json({ error: "Busy, please retry" }, 503); } } });
  }
  handle.userOf = userOf;
  return handle;
  async function inner(req, rethrow) {
    const url = new URL(req.url), p = url.pathname, m = req.method; let mm;
    try {
      if (m === "GET" && p === "/") return new Response(UI, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (m === "GET" && (p === "/architecture" || p === "/architecture/")) return new Response(architecturePage(req), { headers: { "content-type": "text/html; charset=utf-8" } });
      // ---- auth: email + one-time code. DEMO MODE returns the code in the response (no email is sent).
      if (m === "POST" && p === "/api/auth/start") {
        const { email } = await req.json(), st = await loadA();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? "")) return json({ error: "Enter a valid email" }, 400);
        const ek = email.toLowerCase(), now = Date.now(); st.otpLog[ek] = (st.otpLog[ek] ?? []).filter((t) => now - t < 10 * 60000);
        if (st.otpLog[ek].length >= OTP_MAX_PER_10MIN) return json({ error: "Too many codes requested. Try again in 10 minutes." }, 429);
        st.otpLog[ek].push(now);
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, "0");
        st.otps[email.toLowerCase()] = { code, exp: Date.now() + 10 * 60000, tries: 0 }; await saveA(st);
        return json(demo ? { sent: false, demo: true, code } : { sent: false, error: "Email delivery is not configured on this deployment." }, demo ? 200 : 503);
      }
      if (m === "POST" && p === "/api/auth/verify") {
        const { email, code } = await req.json(), st = await loadA(), k = (email ?? "").toLowerCase(), o = st.otps[k];
        if (!o || o.exp < Date.now() || o.tries >= 5) return json({ error: "Code expired, request a new one" }, 401);
        if (o.code !== String(code).trim()) { o.tries++; await saveA(st); return json({ error: "Wrong code" }, 401); }
        delete st.otps[k]; st.users[k] ??= { email: k, createdAt: new Date().toISOString() }; // auto-register
        const sid = rand(24); st.sessions[sid] = { email: k, at: Date.now() }; await saveA(st);
        return json({ email: k }, 200, { "set-cookie": `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${url.protocol === "https:" ? "; Secure" : ""}` });
      }
      if (m === "POST" && p === "/api/auth/logout") { const st = await loadA(), sid = cookie(req).sid; if (sid && st.sessions[sid]) { delete st.sessions[sid]; await saveA(st); } return json({ ok: true }, 200, { "set-cookie": "sid=; Path=/; Max-Age=0" }); }
      if (p.startsWith("/api/")) {
        const A = await loadA(), ses = A.sessions[cookie(req).sid]; var user = ses && Date.now() - ses.at < SESSION_TTL ? ses.email : null;
        if (!user) return json({ error: "auth required" }, 401);
        var st0 = await load();
      }
      const st = st0;
      if (m === "GET" && p === "/api/state") {
        return json({ user, demo, rules: st.rules, audit: st.audit.slice(-50).reverse(), sources: { email: connectors.email?.ui("") ?? null, whatsapp: connectors.whatsapp?.ui("") ?? null, payouts: connectors.payouts?.ui("") ?? null }, model: adapter().name, translation: env.AI ? "Workers AI (m2m100)" : null,
          log: st.log.map(({ sourceText, schema, checks, ...e }) => e), counts: counts(st.log), kpis: kpis(st), benchmarks: BENCHMARKS, spentUsd: st.ledger.spentUsd, channels: st.channels });
      }
      // ---- connectors: pull new messages from the external email / WhatsApp services (poll)
      if (m === "POST" && p === "/api/sync") {
        let added = 0;
        for (const [ch, list] of [["email", st.channels.emails], ["whatsapp", st.channels.chats]]) {
          const c = connectors[ch]; if (!c) continue;
          const after = list.reduce((a, x) => (x.at > a ? x.at : a), "");
          for (const msg of await c.list(after)) if (!list.some((x) => x.id === msg.id)) { list.push({ ...msg, channel: ch }); added++; }
        }
        if (added) await save(st); return json({ added });
      }
      // ---- vendor registry (feeds the hard rules) with audit trail
      if ((p === "/api/vendors" && m === "POST") || ((mm = p.match(/^\/api\/vendors\/([\w-]+)$/)) && ["PUT", "DELETE"].includes(m))) {
        const reg = st.rules.vendors, at = new Date().toISOString();
        if (m === "DELETE") {
          const k = mm[1]; if (!reg[k]) return json({ error: "not found" }, 404);
          st.audit.push({ by: user, at, action: "remove vendor", key: k, name: reg[k].name }); delete reg[k]; st.rules.allowlist = st.rules.allowlist.filter((x) => x !== k);
          await save(st); return json({ ok: true });
        }
        const b = await req.json();
        const k = m === "POST" ? String(b.key || b.name || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) : mm[1];
        if (m === "PUT" && !reg[k]) return json({ error: "not found" }, 404);
        if (m === "POST" && (!k || reg[k])) return json({ error: "Vendor already exists or name missing" }, 409);
        const prev = reg[k] ?? {}, v = { ...prev, ...pickVendor(b) }, err = validateVendor(v, st.rules); if (err) return json({ error: err }, 400);
        const changes = Object.fromEntries(Object.keys(v).filter((f) => f !== "agreement" && JSON.stringify(prev[f]) !== JSON.stringify(v[f])).map((f) => [f, [prev[f] ?? null, v[f]]]));
        if (!Object.keys(changes).length) return json({ key: k, ...reg[k] });
        // Dual control: a new vendor, or a change to bank account / terms / currency, waits for a second person. Invoices to that vendor are held meanwhile.
        const sensitive = m === "POST" || SENSITIVE.some((f) => f in changes);
        if (sensitive) {
          const pend = { by: user, at, type: m === "POST" ? "add" : "edit", proposed: v, changes };
          if (m === "POST") { reg[k] = v; } // registered but not active (not in allowlist) until approved
          else { const safe = Object.fromEntries(Object.entries(v).filter(([f]) => !SENSITIVE.includes(f) && f !== "agreement")); reg[k] = { ...prev, ...safe }; }
          st.rules.pendingChanges[k] = pend;
          st.audit.push({ by: user, at, action: m === "POST" ? "propose new vendor" : "propose bank/terms change", key: k, name: v.name, changes });
          await save(st); return json({ key: k, pending: true, ...reg[k] }, 202);
        }
        reg[k] = v;
        st.audit.push({ by: user, at, action: "edit vendor", key: k, name: v.name, changes });
        await save(st); return json({ key: k, ...v });
      }
      if (m === "POST" && (mm = p.match(/^\/api\/vendors\/([\w-]+)\/change\/(approve|reject)$/))) {
        const k = mm[1], pend = st.rules.pendingChanges[k], at = new Date().toISOString(); if (!pend) return json({ error: "No pending change" }, 404);
        if (mm[2] === "approve") {
          if (pend.by === user) return json({ error: "A different person must approve this change." }, 403);
          st.rules.vendors[k] = { ...st.rules.vendors[k], ...pend.proposed }; if (pend.type === "add" && !st.rules.allowlist.includes(k)) st.rules.allowlist.push(k);
          // Invalidate pending approvals: invoices waiting for a human are re-checked against the new details on approval.
          for (const e of st.log) if (e.action === "escalate" && e.extracted?.vendorKey === k) { e.reasons = [...e.reasons, `Vendor details changed at ${at}; re-checked on approval.`]; e.reason = e.reasons.join(" "); }
        } else if (pend.type === "add") { delete st.rules.vendors[k]; }
        delete st.rules.pendingChanges[k];
        st.audit.push({ by: user, at, action: mm[2] === "approve" ? "approve change" : "reject change", key: k, name: pend.proposed.name, changes: pend.changes, proposedBy: pend.by });
        await save(st); return json({ ok: true });
      }
      if (m === "GET" && (mm = p.match(/^\/api\/vendors\/([\w-]+)\/contract(\.pdf|\.md)?$/))) {
        const v = st.rules.vendors[mm[1]]; if (!v) return json({ error: "not found" }, 404);
        if (mm[2] === ".pdf") return new Response(contractPdf(mm[1], v, COMPANY), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="contract-${mm[1]}.pdf"` } });
        if (mm[2] === ".md") return new Response(contractMarkdown(mm[1], v, COMPANY), { headers: { "content-type": "text/markdown; charset=utf-8" } });
        return new Response(contractHtml(mm[1], v, COMPANY), { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      // ---- channel feed -> queue
      if (m === "POST" && p === "/api/process") {
        const { messageId, ocr } = await req.json(), msg = msgOf(st, messageId);
        if (!msg) return json({ error: "No such message" }, 404);
        if (msg.entryId) return json({ error: "Already processed" }, 409);
        const att = msg.attachment ?? msg.attachments?.[0], channel = msg.channel ?? (messageId.startsWith("m-") ? "email" : "whatsapp");
        let doc;
        if (att?.type === "application/pdf") { const b = await conn(channel).attachment(att.id); if (!b) return json({ error: "attachment unavailable" }, 502); doc = { kind: "pdf", buffer: b.bytes }; }
        else if (att?.type?.startsWith("image/")) { if (!ocr?.text) return json({ error: "needs OCR", needOcr: att.id }, 422); doc = { kind: "image", text: ocr.text, ocrConfidence: Math.min(Number(ocr.confidence) || 0, 79), clientOcr: true }; }
        else doc = { kind: channel === "email" ? "email" : "chat", text: channel === "email" ? `Subject: ${msg.subject}\n\n${msg.body}` : `[${msg.at.slice(0, 10)}] ${msg.from}: ${msg.text}` };
        const e = await run(st, doc, { channel, messageId, attachmentId: att?.id ?? null, name: att?.name ?? null, type: att?.type ?? "text/plain" });
        msg.entryId = e.id; await save(st); return json(e);
      }
      if (m === "POST" && p === "/api/upload") {
        const b = await req.json();
        if ((b.fileBase64?.length ?? 0) * 0.75 > MAX_UPLOAD || (b.text?.length ?? 0) > 200000) return json({ error: "File too large (max 4 MB)" }, 413);
        const kind = b.type === "application/pdf" ? "pdf" : b.type?.startsWith("image/") ? "image" : /^\s*\[\d{4}-\d{2}-\d{2}/.test(b.text ?? "") ? "chat" : "email";
        if (kind === "image" && !b.ocr?.text) return json({ error: "needs OCR" }, 422);
        const attId = b.fileBase64 ? `u-${rand(8)}` : null;
        if (attId) await store.putBlob(attId, b.fileBase64);
        const doc = kind === "pdf" ? { kind, buffer: fromB64(b.fileBase64) } : kind === "image" ? { kind, text: b.ocr.text, ocrConfidence: Math.min(Number(b.ocr.confidence) || 0, 79), clientOcr: true } : { kind, text: b.text };
        const e = await run(st, doc, { channel: "upload", messageId: null, attachmentId: attId, name: b.filename ?? null, type: b.type ?? "text/plain" });
        st.uploads.push({ entryId: e.id, by: user, at: e.at, name: b.filename }); await save(st); return json(e);
      }
      if (m === "GET" && (mm = p.match(/^\/api\/blob\/([\w-]+)$/))) {
        const b = await blobBytes(st, mm[1]); if (!b) return json({ error: "not found" }, 404);
        const att = attOf(st, mm[1]) ?? st.log.map((e) => e.source).find((s) => s?.attachmentId === mm[1]);
        const name = att?.name ?? mm[1], type = att?.type ?? "application/octet-stream";
        return new Response(b.bytes, { headers: { "content-type": type, "content-disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${name.replace(/[^\w.\-]/g, "_")}"` } });
      }
      if (m === "GET" && (mm = p.match(/^\/api\/entry\/(F\d+)$/))) {
        const e = st.log.find((l) => l.id === mm[1]);
        if (!e) return json({ error: "not found" }, 404);
        const fresh = checksFor(hardChecks({ ...e.extracted, id: e.id }, paymentLedger(st, e), st.rules).hold);
        const snap = e.decisionSnapshot?.checks ?? e.checks ?? [];
        return json({ ...e, reevaluated: fresh.some((c, i) => !c.ok && snap[i]?.ok) ? fresh : null }); // only when a rule that passed at decision time fails now
      }
      if (m === "POST" && (mm = p.match(/^\/api\/entry\/(F\d+)\/translate$/))) {
        const e = st.log.find((l) => l.id === mm[1]); if (!e) return json({ error: "not found" }, 404);
        const lang = e.extracted?.lang;
        if (lang === "en") return json({ text: e.sourceText, lang, note: "Already in English" });
        if (e.translation?.version === TRANSLATION_VERSION) return json(e.translation);
        if (!env.AI) return json({ text: null, lang, note: "Translation unavailable here (no translation model configured); showing the original." });
        const parts = (e.sourceText ?? "").split("\n"), out = [];
        for (const line of parts) {
          const masked = maskLine(line, e.extracted, registry(st.rules)[e.extracted?.vendorKey]);
          const text = masked.needsModel ? (await env.AI.run("@cf/meta/m2m100-1.2b", { text: masked.text, source_lang: lang, target_lang: "en" })).translated_text : masked.text;
          out.push(unmask(text, masked));
        }
        e.translation = { version: TRANSLATION_VERSION, text: out.join("\n"), lang, note: "Machine translation (Workers AI m2m100). Decisions always use the original text." };
        await save(st); return json(e.translation);
      }
      if (m === "POST" && (mm = p.match(/^\/api\/entry\/(F\d+)\/(approve|approve-second|reject|reopen)$/))) {
        const e = st.log.find((l) => l.id === mm[1]);
        if (!e) return json({ error: "not found" }, 404);
        const at = new Date().toISOString();
        const ab = await req.json().catch(() => ({}));
        const why = typeof ab.reason === "string" ? ab.reason.trim().slice(0, 300) : "";
        const audit = (action, extra = {}) => st.audit.push({ by: user, at, action, key: e.id, name: `${e.id} · ${e.extracted?.payee ?? "?"}`, changes: { reason: [null, why], ...extra } });
        let actor = user;
        const done = () => { e.reason = e.reasons.join(" "); e.decidedBy = actor; e.history = [...(e.history ?? []), { by: actor, at, action: e.action }]; e.decisionSnapshot = snapshot(e.extracted, e.reasons, st.rules); };
        // Held -> Pending: a person takes it back for review (typed reason, logged). Nothing is paid; approving later re-runs every hard rule.
        if (mm[2] === "reopen") {
          if (e.action !== "hold") return json({ error: "Only held invoices can be moved to pending." }, 409);
          if (why.length < 5) return json({ error: "Give a reason (at least 5 characters); it is logged." }, 400);
          e.action = "escalate"; e.wasHeld = true; e.reasons = [...e.reasons, `Moved to pending by ${user} at ${at}: "${why}".`];
          done(); audit("move held invoice to pending"); await save(st); return json(e);
        }
        // Overriding a hold (held now, or held before and moved to pending): typed reason; above the human-approval threshold a second, different person.
        const overriding = e.action === "hold" || (e.action === "escalate" && e.wasHeld);
        if (e.action !== "escalate" && !(overriding && mm[2].startsWith("approve"))) return json({ error: "Only pending invoices can be decided" }, 409);
        if (mm[2] === "reject") { e.action = "hold"; e.reasons = [...e.reasons, `Rejected by ${user} at ${at}.`]; done(); await save(st); return json(e); }
        const candidate = { ...e, action: "escalate" };
        const override = why || ab.override;
        const dry = approve(candidate, st.ledger, st.rules, { override, dryRun: true });
        e.hard = candidate.hard;
        if (!dry.ok) { await save(st); return json({ error: dry.reason, hard: !!dry.hard, needsOverride: !!dry.needsOverride }, 409); }
        if (overriding && why.length < 5) return json({ error: "Give a reason (at least 5 characters); it is logged.", needsReason: true }, 400);
        e.approvals ??= e.overrideRequest ? [e.overrideRequest] : [];
        const first = e.approvals[0];
        if (mm[2] === "approve-second") {
          if (!first) return json({ error: "Only pending invoices can be decided" }, 409);
          actor = String(ab.email ?? "").trim().toLowerCase();
          if (actor === first.by.toLowerCase()) return json({ error: "A different person must approve" }, 403);
          const a = await loadA(), o = a.otps[actor];
          if (!o || o.exp < Date.now() || o.tries >= 5) return json({ error: "Code expired, request a new one" }, 401);
          if (o.code !== String(ab.code).trim()) { o.tries++; await saveA(a); return json({ error: "Wrong code" }, 401); }
          delete a.otps[actor]; await saveA(a);
        }
        if (first && first.by.toLowerCase() === actor.toLowerCase()) return json({ error: "A different person must approve" }, 403);
        const usd = toUsd(e.extracted.amount, e.extracted.currency, st.rules);
        const approvals = [...e.approvals, { by: actor, at, reason: override ?? "" }];
        if (usd > st.rules.human_approval_above_usd && !first) {
          e.approvals = approvals; e.overrideRequest = approvals[0]; e.pendingSecond = true;
          done(); audit("request hold override"); await save(st); return json({ ...e, pendingSecond: true }, 202);
        }
        const r = approve(candidate, st.ledger, st.rules, { override, approvers: approvals });
        if (!r.ok) return json({ error: r.reason, hard: !!r.hard, needsOverride: !!r.needsOverride }, 409);
        e.approvals = approvals; e.paidOverride = overriding || !!ab.override;
        e.paidCheck = { hard: [...e.hard], approvers: approvals.map((a) => a.by), at, amountUsd: usd, threshold: st.rules.human_approval_above_usd };
        e.action = "pay"; delete e.overrideRequest; delete e.pendingSecond;
        e.reasons = [...e.reasons, `Approved${overriding ? " over a hold" : ""} by ${actor} at ${at}; hard rules re-checked.` + (override ? ` Reason: "${override}".` : "") + (first ? ` Second approver after ${first.by}.` : "")];
        done(); audit(overriding ? "approve held invoice" : "approve invoice"); await save(st); return json(e);
      }
      if (m === "PUT" && p === "/api/rules") {
        const r = { ...st.rules, ...(await req.json()) };
        for (const k of ["fx_to_usd", "vendors", "company", "period", "base_currency", "pendingChanges"]) r[k] = st.rules[k];
        const err = validateRules(r); if (err) return json({ error: err }, 400);
        st.rules = r; await save(st); return json(r);
      }
      if (m === "POST" && p === "/api/reset") { // "Reset my demo": default rules and vendors, empty queue, mock inbox/chat back to the seed
        const f = fresh(); f.v = st.v; f.rules.pendingChanges = {}; f.audit = [{ by: user, at: new Date().toISOString(), action: "reset demo", key: "-", name: "workspace", changes: {} }];
        await save(f); await resetMocks(); return json({ ok: true }); }
      if (m === "GET" && (mm = p.match(/^\/api\/audit\.(csv|json)$/))) {
        const rows = auditRows(st), stamp = new Date().toISOString().slice(0, 10);
        if (mm[1] === "json") return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), exportedBy: user, invoices: rows, vendorChanges: st.audit }, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="clearhold-audit-${stamp}.json"` } });
        return new Response(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="clearhold-audit-${stamp}.csv"` } });
      }
      // ---- send paid invoices to the MOCK Blinka Payments sandbox (idempotent per invoice); also refreshes statuses
      if (m === "POST" && p === "/api/payouts") {
        const pc = connectors.payouts; if (!pc) return json({ error: "No payouts service configured" }, 501);
        let sent = 0, replayed = 0, failed = 0;
        for (const e of st.log) {
          if (e.action !== "pay") continue; // only invoices that passed every hard rule (or a re-checked human approval)
          const x = e.extracted ?? {}, v = st.rules.vendors[x.vendorKey];
          if (e.payout?.status === "settled") continue;
          if (e.payout?.id) { const cur = await pc.get(e.payout.id); if (cur) e.payout.status = cur.status; continue; }
          if (!v) { e.payout = { error: "vendor no longer in registry" }; failed++; continue; }
          try {
            const r = await pc.create({ amount: x.amount, currency: x.currency, beneficiary: { name: v.name, account: v.acct, country: v.country }, reference: `${x.number} · ${e.id}` }, `clearhold:${e.id}:${x.number}`);
            e.payout = { id: r.id, rail: r.rail, status: r.status, at: new Date().toISOString(), by: user }; r.idempotent_replay ? replayed++ : sent++;
          } catch (err) { e.payout = { error: String(err.message).slice(0, 200) }; failed++; }
        }
        await save(st); return json({ sent, replayed, failed, ui: pc.ui("") });
      }
      if (m === "GET" && p === "/api/pain001") {
        const pays = st.log.filter((l) => l.action === "pay").map((l) => ({ id: l.id, ...l.extracted }));
        return new Response(pain001(pays, { registry: st.rules.vendors, msgId: `NWR-${Date.now()}` }), { headers: { "content-type": "application/xml", "content-disposition": "attachment; filename=pain001.xml" } });
      }
      if (m === "POST" && p === "/api/stress") return stress(await req.json().catch(() => ({})), st.rules, adapter());
      return json({ error: "not found" }, 404);
    } catch (e) { if (e instanceof Conflict && rethrow) throw e; return json({ error: String(e?.message ?? e) }, 500); }
  };
}

const VFIELDS = ["name", "aliases", "country", "currency", "lang", "acct", "category", "keywords", "terms", "agreement"];
function pickVendor(b) {
  const v = Object.fromEntries(VFIELDS.filter((f) => b[f] !== undefined).map((f) => [f, b[f]]));
  if (typeof v.keywords === "string") v.keywords = v.keywords.split(",");
  if (Array.isArray(v.keywords)) v.keywords = v.keywords.map((k) => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")).filter(Boolean);
  if (typeof v.aliases === "string") v.aliases = v.aliases.split(",").map((x) => x.trim()).filter(Boolean);
  if (v.terms) v.terms = v.terms.type === "flat" ? { type: "flat", amount: Number(v.terms.amount) } : { type: "hourly", rate: Number(v.terms.rate), max_units_per_period: Number(v.terms.max_units_per_period) };
  return v;
}
export function validateVendor(v, rules) {
  if (!v.name?.trim()) return "Name is required";
  if (!/^[A-Z]{2}-[A-Z0-9]+-\d+$/.test(v.acct ?? "")) return "Bank account must look like CO-FAKE-1234";
  if (rules.fx_to_usd[v.currency] == null) return `Currency must be one of ${Object.keys(rules.fx_to_usd).join(", ")}`;
  if (!v.category?.trim()) return "Category is required";
  if (!v.keywords?.length) return "At least one allowed keyword is required";
  const t = v.terms ?? {};
  if (t.type === "flat" ? !(t.amount > 0) : !(t.rate > 0 && t.max_units_per_period > 0)) return "Contracted price is required (flat amount, or hourly rate + max hours)";
  v.aliases ??= []; v.lang ??= "en"; v.country ??= v.acct.slice(0, 2);
  v.agreement = describeTerms(v); return null;
}
export const describeTerms = (v) => `${v.category}: ` + (v.terms.type === "flat" ? `${v.currency} ${v.terms.amount} flat per month.` : `${v.currency} ${v.terms.rate} per hour, up to ${v.terms.max_units_per_period} hours per month.`) + " No other charges without written approval.";

/** Audit export: one row per invoice with decision, reasons, failed rules, evidence and who/when. */
export function auditRows(st) {
  return st.log.map((e) => {
    const x = e.extracted ?? {}, s = e.source ?? {}, h = e.history ?? [];
    const ev = Object.fromEntries(Object.entries(e.schema ?? {}).map(([k, f]) => [k, f.evidence?.text ?? null]));
    return { id: e.id, received_at: e.at, channel: s.channel ?? null, format: e.channel, source_message: s.messageId ?? s.name ?? null,
      payee: x.payee ?? null, vendor_key: x.vendorKey ?? null, invoice_number: x.number ?? null, amount: x.amount ?? null, currency: x.currency ?? null,
      amount_usd: e.amountUsd != null ? Math.round(e.amountUsd * 100) / 100 : null, due: x.due ?? null, bank_account: x.acct ?? null,
      agent_decision: h[0]?.action ?? e.action, final_decision: e.action, decided_by: h.at(-1)?.by ?? "agent", decision_source: (h.at(-1)?.by ?? "agent") === "agent" ? "agent" : "user", decided_at: h.at(-1)?.at ?? e.at,
      reasons: e.reason, rules_failed: (e.decisionSnapshot?.checks ?? e.checks ?? []).filter((c) => !c.ok).map((c) => c.rule).join("; "),
      rules_version: e.decisionSnapshot?.rulesHash ?? null, config_hash: e.decisionSnapshot?.rulesHash ?? null,
      vendor_contract: e.decisionSnapshot?.vendorContract ?? null, fx_table: e.decisionSnapshot?.fx?.fx_to_usd ?? null, fx_as_of: e.decisionSnapshot?.fx?.fx_as_of ?? null,
      model: e.model?.name ?? null, p_duplicate: e.model?.is_duplicate ?? null, p_matches_agreement: e.model?.matches_agreement ?? null,
      evidence: JSON.stringify(ev), history: h.map((y) => `${y.at ?? ""} ${y.by} ${y.action}`).join(" | ") };
  });
}
const csvCell = (v) => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; };
export const toCsv = (rows) => (rows.length ? [Object.keys(rows[0]).join(","), ...rows.map((r) => Object.values(r).map(csvCell).join(","))].join("\r\n") + "\r\n" : "id\r\n");

/** Stress test on a separate ledger; streams NDJSON: one line per invoice + running score. */
function stress({ seed = Math.floor(Math.random() * 1e6), n = 30, mix = "realistic" }, rules, adapter) {
  mix = mix === "traps" ? "traps" : "realistic";
  n = Math.min(Math.max(1, n | 0), 100);
  const inv = generate(seed, n, { mix }), r = rng(seed), st = { rules, ledger: newLedger(), log: [] }, enc = new TextEncoder();
  const stream = new ReadableStream({ async start(c) {
    c.enqueue(enc.encode(JSON.stringify({ type: "start", seed, n, mix }) + "\n"));
    for (const t of inv) {
      // email/chat/pdf go through the real extractors; images use the invoice PDF's text layer as a perfect-OCR stand-in (OCR runs in the browser for channel images).
      const doc = t.format === "email" ? { kind: "email", text: renderEmail(t, r) } : t.format === "chat" ? { kind: "chat", text: renderChat(t, r) }
        : t.format === "pdf" ? { kind: "pdf", buffer: invoicePdf(t) } : { kind: "image", text: (await pdfText(invoicePdf(t, { pages: 1 }))).replace(/\t/g, "  "), ocrConfidence: 95 };
      const e = await processDoc({ ...doc, id: t.id }, { ledger: st.ledger, rules, adapter, mapExtracted: (x) => withAllow(rules, x) });
      e.history = [{ by: "agent", action: e.action }]; st.log.push(e);
      const s = { ...score(st.log, inv, rules), ...metrics(st.log, (x) => inv.find((m) => m.id === x.id)) };
      c.enqueue(enc.encode(JSON.stringify({ type: "row", id: e.id, channel: e.channel, action: e.action, reason: e.reason, truth: t.tags[0], score: { ...s, improper: s.improper.length, improperList: s.improper } }) + "\n"));
    }
    c.close();
  } });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
}
