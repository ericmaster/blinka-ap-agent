// Local server: node scripts/serve.mjs [port]. In-memory state. Keys (optional) from env, never logged.
import { createServer } from "node:http";
import { createHost } from "../src/server/host.mjs";
const mem = new Map(), blobs = new Map();
const kv = { get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null), put: async (k, v) => { mem.set(k, structuredClone(v)); }, getBlob: async (k) => blobs.get(k) ?? null, putBlob: async (k, v) => { blobs.set(k, v); } };
const app = createHost({ kv, env: process.env });
const port = Number(process.argv[2] ?? process.env.PORT ?? 8796);
createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks);
  const r = await app(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) for await (const c of r.body) res.write(c);
  res.end();
}).listen(port, () => console.log(`Clearhold on http://localhost:${port}  (mock mail: /mail/  mock chat: /chat/)`));
