// One deployable hosting three apps: Clearhold (/), mock Mailbox (/mail/) and mock ChatApp (/chat/).
// Clearhold reaches the mocks only through the connector API; set MAIL_API_URL / CHAT_API_URL to point it at remote services instead.
import { createApp } from "./app.mjs";
import { createMockService, connector } from "../mocks/service.mjs";

/** kv: { get(key) -> parsed JSON | null, put(key, obj), getBlob(id), putBlob(id, b64) } */
export function createHost({ kv, env = {} }) {
  const mockStore = { load: (k) => kv.get(k), save: (k, v) => kv.put(k, v), getBlob: kv.getBlob, putBlob: kv.putBlob };
  const mail = createMockService("mail", mockStore), chat = createMockService("chat", mockStore);
  const local = (req) => { const p = new URL(req.url).pathname; return p.startsWith("/mail") ? mail(req) : chat(req); };
  const connectors = {
    email: connector("email", env.MAIL_API_URL ?? "http://internal/mail/api", env.MAIL_API_URL ? fetch : local),
    whatsapp: connector("whatsapp", env.CHAT_API_URL ?? "http://internal/chat/api", env.CHAT_API_URL ? fetch : local),
  };
  const app = createApp({ store: { load: () => kv.get("state"), save: (s) => kv.put("state", s), getBlob: kv.getBlob, putBlob: kv.putBlob }, env, connectors });
  return (req) => {
    const p = new URL(req.url).pathname;
    if (p === "/mail" || p === "/chat") return Response.redirect(new URL(p + "/", req.url).toString(), 301);
    if (p.startsWith("/mail/")) return mail(req);
    if (p.startsWith("/chat/")) return chat(req);
    return app(req);
  };
}
