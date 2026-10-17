// MOCK "Blinka Payments" sandbox. NOT the Blinka API: Blinka publishes no public API on blinka.co, so the endpoints, fields and
// statuses here are our own invention for the demo. The rails are the ones listed on https://blinka.co/ (USD: ACH & wire in the
// United States, SWIFT to 200+ countries, local USD routes in Peru, Panama, China and Hong Kong; local currency: Colombia COP bank
// transfer, Brazil BRL Pix/TED, Mexico MXN, Argentina ARS CBU/CVU/Alias, Chile CLP, Peru PEN, Bolivia BOB and Costa Rica CRC bank transfer).
// No money moves. Each payment intent is idempotent on the Idempotency-Key header.
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8" } });
const rid = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Rail for a payout, from the beneficiary country and the payout currency (routes listed on blinka.co). */
export function railFor(country, currency) {
  const local = { COP: ["CO", "Colombia · COP bank transfer"], BRL: ["BR", "Brazil · Pix"], MXN: ["MX", "Mexico · MXN local transfer"], ARS: ["AR", "Argentina · CBU / CVU / Alias"],
    CLP: ["CL", "Chile · CLP bank transfer"], PEN: ["PE", "Peru · PEN bank transfer"], BOB: ["BO", "Bolivia · BOB bank transfer"], CRC: ["CR", "Costa Rica · CRC bank transfer"] };
  if (local[currency]) return local[currency][0] === country ? { rail: local[currency][1], supported: true } : { rail: null, supported: false };
  if (currency === "USD") {
    if (country === "US") return { rail: "United States · ACH", supported: true };
    if (["PE", "PA", "CN", "HK"].includes(country)) return { rail: `Local USD route (${country})`, supported: true };
    return { rail: "SWIFT (USD)", supported: true };
  }
  return { rail: null, supported: false };
}
// Simulated lifecycle, derived from time so it needs no background job: created -> submitted (5 s) -> settled (20 s).
const statusOf = (x, now = Date.now()) => { const t = now - Date.parse(x.createdAt); return t >= 20000 ? "settled" : t >= 5000 ? "submitted" : "created"; };
const view = (x) => ({ ...x, status: statusOf(x) });

import { mockI18n, LNG_CSS } from "../i18n/ui.mjs";
import { reasonsClientJs } from "../i18n/reasons.mjs";
const UI = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blinka Payments (mock)</title>
<style>body{font:15px/1.45 system-ui,sans-serif;margin:0;background:#f7f7f4;color:#1c253a}.b{background:#b54708;color:#fff;padding:8px 16px;font-size:13px}main{max-width:980px;margin:20px auto;padding:0 16px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #dedfdc;border-radius:10px;overflow:hidden}td,th{padding:8px 10px;border-bottom:1px solid #eee;text-align:left;font-size:14px}.s{padding:2px 8px;border-radius:99px;font-size:12px;background:#eef}.settled{background:#e7f6ec}.k{color:#656975;font-size:13px}${LNG_CSS}.b{display:flex;gap:10px;align-items:center}.b span{flex:1}</style></head>
<body data-title="Blinka Payments (mock)"><div class="b"><span data-t>MOCK · Not the Blinka API and not affiliated: a sandbox we built for the demo. Rails as listed on blinka.co. No money moves.</span><span class="lng"><button data-lang="en">EN</button><button data-lang="es">ES</button></span></div><main><h2>Blinka Payments <span class="k" data-t>(mock sandbox)</span></h2><table id="t"></table><p class="k" data-t>Each payment is idempotent on its Idempotency-Key: sending the same invoice twice returns the same payment.</p></main>
<script>${mockI18n(reasonsClientJs())}
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
async function load(){const r=await fetch("api/payment-intents");if(!r.ok){document.querySelector("#t").innerHTML="<tr><td>"+tx("Sign in to Clearhold first.")+"</td></tr>";return}const d=await r.json();
document.querySelector("#t").innerHTML="<tr>"+["Payment","Beneficiary","Amount","Rail","Status","Reference"].map(h=>"<th>"+tx(h)+"</th>").join("")+"</tr>"+(d.data.map(x=>"<tr id='"+x.id+"'><td>"+x.id+"</td><td>"+esc(x.beneficiary.name)+"<div class=k>"+esc(x.beneficiary.account)+"</div></td><td>"+esc(x.currency)+" "+Number(x.amount).toLocaleString(NL())+"</td><td>"+esc(tm(x.rail))+"</td><td><span class='s "+x.status+"'>"+tx(x.status)+"</span></td><td class=k>"+esc(x.reference)+"</td></tr>").join("")||"<tr><td colspan=6 class=k>"+tx("No payments yet. In Clearhold, use “Send to Blinka”.")+"</td></tr>")}
window.onlang=load;applyStatic();load();setInterval(load,3000)</script></body></html>`;

/** store: { load(key), save(key, v) } (per workspace). */
export function createBlinkaMock(store) {
  const key = "mock:blinka";
  const load = async () => (await store.load(key)) ?? { intents: [], keys: {} };
  return async function handle(req) {
    const url = new URL(req.url), p = url.pathname.replace(/^\/blinka/, "") || "/", m = req.method; let mm;
    if (m === "GET" && (p === "/" || p === "")) return new Response(UI, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (m === "GET" && p === "/api/payment-intents") return json({ data: (await load()).intents.map(view).reverse() });
    if (m === "GET" && (mm = p.match(/^\/api\/payment-intents\/(pi_\w+)$/))) { const x = (await load()).intents.find((y) => y.id === mm[1]); return x ? json(view(x)) : json({ error: "not found" }, 404); }
    if (m === "POST" && p === "/api/payment-intents") {
      const ik = req.headers.get("idempotency-key"); if (!ik || ik.length > 200) return json({ error: "Idempotency-Key header required" }, 400);
      const b = await req.json().catch(() => ({})), st = await load();
      const body = { amount: Number(b.amount), currency: String(b.currency ?? ""), beneficiary: { name: String(b.beneficiary?.name ?? "").slice(0, 200), account: String(b.beneficiary?.account ?? "").slice(0, 60), country: String(b.beneficiary?.country ?? "").slice(0, 2) }, reference: String(b.reference ?? "").slice(0, 140) };
      const fp = JSON.stringify(body);
      if (st.keys[ik]) { const prev = st.intents.find((y) => y.id === st.keys[ik].id); return st.keys[ik].fp === fp ? json({ ...view(prev), idempotent_replay: true }) : json({ error: "Idempotency-Key reused with a different request" }, 409); }
      if (!(body.amount > 0) || !body.beneficiary.name || !body.beneficiary.account) return json({ error: "amount, beneficiary.name and beneficiary.account are required" }, 400);
      const { rail, supported } = railFor(body.beneficiary.country, body.currency); if (!supported) return json({ error: `No route for ${body.currency} to ${body.beneficiary.country}` }, 422);
      const x = { id: `pi_${rid()}`, ...body, rail, createdAt: new Date().toISOString(), mock: true };
      st.intents.push(x); st.keys[ik] = { id: x.id, fp }; await store.save(key, st); return json(view(x), 201);
    }
    if (m === "POST" && p === "/api/reset") { await store.save(key, { intents: [], keys: {} }); return json({ ok: true }); }
    return json({ error: "not found" }, 404);
  };
}

/** Clearhold side: payouts connector over the mock API (in-process handler or fetch). */
export function payoutsConnector(baseUrl, fetcher) {
  return {
    ui: (id) => `${new URL(baseUrl).pathname.replace(/\/api$/, "")}/#${id}`,
    async create(intent, idempotencyKey) {
      const r = await fetcher(new Request(baseUrl + "/payment-intents", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(intent) }));
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`); return d;
    },
    async get(id) { const r = await fetcher(new Request(`${baseUrl}/payment-intents/${id}`)); return r.ok ? r.json() : null; },
  };
}
