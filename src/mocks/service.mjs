// Mock external services ("Mailbox" email provider and "ChatApp" WhatsApp-style messenger). Each is its own small app with its
// own storage, UI and HTTP API; Clearhold only talks to them through the connector API (see docs/CONNECTORS.md). Fictional data.
import { SEED, SEED_BLOBS } from "../server/seed.mjs";
import { MAIL_UI, CHAT_UI } from "./ui.mjs";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" } });
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rid = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("");
const MAX = 4 * 1024 * 1024;

/** kind: "mail" | "chat". store: { load(key), save(key, v), getBlob(id), putBlob(id, b64) } */
export function createMockService(kind, store) {
  const key = `mock:${kind}`, base = `/${kind}`, prefix = kind === "mail" ? "m-" : "w-";
  const seed = () => ({ messages: kind === "mail" ? SEED.emails.map((e) => ({ ...e, to: "ap@northwind-ridge.example" })) : SEED.chats.map((c) => ({ ...c })) });
  const load = async () => (await store.load(key)) ?? seed();
  const blob = async (id) => SEED_BLOBS[id] ?? (await store.getBlob(`mock:${id}`));
  const atts = (m) => (kind === "mail" ? m.attachments ?? [] : m.attachment ? [m.attachment] : []);
  return async function handle(req) {
    const url = new URL(req.url), p = url.pathname.slice(base.length) || "/", m = req.method;
    if (m === "GET" && (p === "/" || p === "")) return new Response(kind === "mail" ? MAIL_UI : CHAT_UI, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (m === "GET" && p === "/api/messages") {
      const st = await load(), after = url.searchParams.get("after");
      return json({ messages: st.messages.filter((x) => !after || x.at > after).sort((a, b) => (a.at < b.at ? -1 : 1)) });
    }
    let mm;
    if (m === "GET" && (mm = p.match(/^\/api\/messages\/([\w-]+)$/))) { const x = (await load()).messages.find((y) => y.id === mm[1]); return x ? json(x) : json({ error: "not found" }, 404); }
    if (m === "GET" && (mm = p.match(/^\/api\/attachments\/([\w-]+)$/))) {
      const st = await load(), a = st.messages.flatMap(atts).find((y) => y.id === mm[1]), b = a && (await blob(a.id));
      if (!b) return json({ error: "not found" }, 404);
      return new Response(fromB64(b), { headers: { "content-type": a.type, "content-disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${a.name.replace(/[^\w.\-]/g, "_")}"` } });
    }
    if (m === "POST" && p === "/api/messages") {
      const b = await req.json().catch(() => ({})), st = await load();
      const files = (b.attachments ?? (b.attachment ? [b.attachment] : [])).filter((f) => f?.base64);
      if (files.some((f) => f.base64.length * 0.75 > MAX)) return json({ error: "Attachment too large (max 4 MB)" }, 413);
      const text = kind === "mail" ? (b.body ?? "") : (b.text ?? "");
      if (!text.trim() && !files.length) return json({ error: "Empty message" }, 400);
      const saved = [];
      for (const f of files) { const id = `a-${rid()}`; await store.putBlob(`mock:${id}`, f.base64); saved.push({ id, name: String(f.name ?? "file").slice(0, 120), type: f.type || "application/octet-stream" }); }
      const msg = kind === "mail"
        ? { id: prefix + rid(), at: new Date().toISOString(), from: String(b.from ?? "vendor@example.com").slice(0, 200), fromName: String(b.fromName ?? b.from ?? "Vendor").slice(0, 200), to: "ap@northwind-ridge.example", subject: String(b.subject ?? "(no subject)").slice(0, 300), body: text.slice(0, 20000), attachments: saved }
        : { id: prefix + rid(), at: new Date().toISOString(), from: String(b.from ?? "Vendor").slice(0, 200), text: text.slice(0, 20000), attachment: saved[0] };
      st.messages.push(msg); await store.save(key, st); return json(msg, 201);
    }
    if (m === "POST" && p === "/api/reset") { await store.save(key, seed()); return json({ ok: true }); }
    return json({ error: "not found" }, 404);
  };
}

/** Clearhold side: connector client over the service's HTTP API. `fetcher` is fetch (remote base URL) or an in-process handler. */
export function connector(name, baseUrl, fetcher) {
  const get = (path) => fetcher(new Request(baseUrl + path));
  return {
    name, ui: (id) => `${new URL(baseUrl).pathname.replace(/\/api$/, "")}/#${id}`,
    async list(after) { const r = await get(`/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`); if (!r.ok) throw new Error(`${name} connector HTTP ${r.status}`); return (await r.json()).messages; },
    async attachment(id) { const r = await get(`/attachments/${id}`); if (!r.ok) return null; return { type: r.headers.get("content-type"), bytes: new Uint8Array(await r.arrayBuffer()) }; },
  };
}
