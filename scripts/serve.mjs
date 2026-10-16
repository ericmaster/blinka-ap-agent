// Local server: node scripts/serve.mjs [port]. In-memory state. Keys (optional) from env, never logged.
import { createServer } from "node:http";
import { createApp } from "../src/server/app.mjs";
let state = null;
const app = createApp({ store: { load: async () => state && structuredClone(state), save: async (s) => { state = structuredClone(s); } }, env: process.env });
const port = Number(process.argv[2] ?? process.env.PORT ?? 8796);
createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks);
  const r = await app(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) for await (const c of r.body) res.write(c);
  res.end();
}).listen(port, () => console.log(`Blinka AP agent on http://localhost:${port}`));
