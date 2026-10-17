// One deployable hosting three apps: Clearhold (/), mock Mailbox (/mail/) and mock ChatApp (/chat/).
// Demo sandbox: each workspace (a company email domain, or the full address for public mail domains) gets its own
// Clearhold state and its own mock inbox/chat, so judges never see each other's queue. Sessions are shared (one auth record).
// Clearhold reaches the mocks only through the connector API; set MAIL_API_URL / CHAT_API_URL to point it at remote services instead.
import { createApp } from "./app.mjs";
import { createMockService, connector } from "../mocks/service.mjs";
import { createBlinkaMock, payoutsConnector } from "../mocks/blinka.mjs";

const PUBLIC = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "gmx.com", "yandex.com", "mail.com"]);
/** Workspace id for a signed-in email: colleagues at the same company domain share one (so dual control works); public domains are per person. */
export const workspaceOf = (email) => { const [u, d = ""] = String(email).toLowerCase().split("@"); return (PUBLIC.has(d) ? `${u}@${d}` : d).replace(/[^a-z0-9@._+-]/g, "_").slice(0, 120); };

/** kv: { get(key) -> parsed JSON | null, put(key, obj), getBlob(id), putBlob(id, b64) } */
export function createHost({ kv, env = {}, model = null }) { // model: test-only decision adapter (e.g. reckless)
  const auth = { load: () => kv.get("auth"), save: (a) => kv.put("auth", a) };
  const spaces = new Map();
  function space(id) {
    if (spaces.has(id)) return spaces.get(id);
    const pre = `ws:${id}:`;
    const kvw = { load: (k) => kv.get(pre + k), save: (k, v) => kv.put(pre + k, v), getBlob: (k) => kv.getBlob(pre + k), putBlob: (k, v) => kv.putBlob(pre + k, v) };
    const mail = createMockService("mail", kvw), chat = createMockService("chat", kvw), blinka = createBlinkaMock(kvw);
    const local = (req) => (new URL(req.url).pathname.startsWith("/mail") ? mail(req) : chat(req));
    const connectors = {
      email: connector("email", env.MAIL_API_URL ?? "http://internal/mail/api", env.MAIL_API_URL ? fetch : local),
      whatsapp: connector("whatsapp", env.CHAT_API_URL ?? "http://internal/chat/api", env.CHAT_API_URL ? fetch : local),
      payouts: payoutsConnector("http://internal/blinka/api", blinka),
    };
    const resetMocks = async () => { for (const k of ["mail", "chat"]) await local(new Request(`http://internal/${k}/api/reset`, { method: "POST" })); await blinka(new Request("http://internal/blinka/api/reset", { method: "POST" })); };
    const app = createApp({ store: { load: () => kvw.load("state"), save: (s) => kvw.save("state", s), getBlob: kvw.getBlob, putBlob: kvw.putBlob }, auth, env, connectors, resetMocks, model });
    const s = { app, mail, chat, blinka }; spaces.set(id, s); return s;
  }
  const anon = space("_public"); // serves the UI, the auth endpoints and 401s; holds no customer data
  return async (req) => {
    const p = new URL(req.url).pathname;
    if (p === "/mail" || p === "/chat" || p === "/blinka") return Response.redirect(new URL(p + "/", req.url).toString(), 301);
    const user = p.startsWith("/api/auth/") ? null : await anon.app.userOf(req);
    if (p.startsWith("/mail/") || p.startsWith("/chat/") || p.startsWith("/blinka/")) {
      const kind = p.split("/")[1];
      if (p === `/${kind}/` && req.method === "GET") return anon[kind](req); // static page
      // The mock services are per workspace and need a signed-in Clearhold user, so strangers cannot plant invoices.
      if (!user) return new Response(JSON.stringify({ error: "Sign in to Clearhold first" }), { status: 401, headers: { "content-type": "application/json" } });
      return space(workspaceOf(user))[kind](req);
    }
    if (!user) return anon.app(req);
    return space(workspaceOf(user)).app(req);
  };
}
