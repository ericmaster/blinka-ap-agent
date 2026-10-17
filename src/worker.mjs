// Cloudflare Worker entry. State in KV (binding STATE); secrets FASTINO_API_KEY / JEV_API_KEY via `wrangler secret put` (never in repo).
import { createHost } from "./server/host.mjs";
export default {
  async fetch(req, env) {
    const kv = { get: (k) => env.STATE.get(k, "json"), put: (k, v) => env.STATE.put(k, JSON.stringify(v)),
      getBlob: (k) => env.STATE.get("blob:" + k), putBlob: (k, v) => env.STATE.put("blob:" + k, v) };
    return createHost({ kv, env })(req);
  },
};
