// Cloudflare Worker entry. State in KV (binding STATE); secrets FASTINO_API_KEY / JEV_API_KEY via `wrangler secret put` (never in repo).
import { createApp } from "./server/app.mjs";
export default {
  async fetch(req, env) {
    const store = { load: async () => env.STATE.get("state", "json"), save: async (s) => env.STATE.put("state", JSON.stringify(s)),
      getBlob: async (k) => env.STATE.get("blob:" + k), putBlob: async (k, v) => env.STATE.put("blob:" + k, v) };
    return createApp({ store, env })(req);
  },
};
