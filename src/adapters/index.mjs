// Decision-model adapters. Only typed yes/no questions; keys only from env. Any failure => {error}, which escalates.
const TIMEOUT_MS = 15000;
function systemOne(name, url, model, headers) {
  return { name, async ask(qs) {
    const body = { model, state: Object.fromEntries(Object.entries(qs).map(([k, v]) => [k, v.state])),
      questions: Object.fromEntries(Object.entries(qs).map(([k, v]) => [k, { type: "noul", instructions: `Using \`${k}\` in the state: ${v.q}` }])) };
    const r = await fetch(url, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) throw new Error(`${name} HTTP ${r.status}`);
    const d = await r.json(), out = {};
    for (const k of Object.keys(qs)) { const p = d?.answers?.[k]?.noul; if (typeof p !== "number" || p < 0 || p > 1) throw new Error(`${name}: bad answer for ${k}`); out[k] = p; }
    return out;
  } };
}
export const glide = () => systemOne("Fastino GLiDE", "https://api.fastino.ai/v1/systemone", "fastino/GLiDE", () => ({ "X-API-Key": need("FASTINO_API_KEY") }));
export const jev = () => systemOne("TypeSafe JEV", "https://jevtypesafeai.com/api/v1/decide", "jev-latest", () => ({ Authorization: "Bearer " + need("JEV_API_KEY") }));
function need(k) { const v = process.env[k]; if (!v) throw new Error(`${k} not set`); return v; }

/** Fake adapters for tests/CI (ADAPTER_MODE=fake). */
export const oracle = (truthById) => ({ name: "fake-oracle", async ask(qs, ctx) { const t = truthById[ctx.id]; return { is_duplicate: t.is_duplicate ? 0.97 : 0.03, matches_agreement: t.matches_agreement ? 0.96 : 0.04 }; } });
export const constant = (p) => ({ name: `fake-constant-${p}`, async ask() { return { is_duplicate: p, matches_agreement: p }; } });
export const failing = () => ({ name: "fake-failing", async ask() { throw new Error("simulated outage"); } });
/** Reckless model: always says "not duplicate, matches" with full confidence. Rules must still contain it. */
export const reckless = () => ({ name: "fake-reckless", async ask() { return { is_duplicate: 0, matches_agreement: 1 }; } });

/** Primary then fallback; if both fail return {error}. */
export function chain(...adapters) {
  return { name: adapters.map((a) => a.name).join(" → "), async ask(qs, ctx) {
    const errs = [];
    for (const a of adapters) { try { return { ...(await a.ask(qs, ctx)), model: a.name }; } catch (e) { errs.push(e.message); } }
    return { error: errs.join("; ") };
  } };
}
export function fromEnv() { return process.env.ADAPTER_MODE === "real" ? chain(glide(), jev()) : chain(constant(0.5)); }
