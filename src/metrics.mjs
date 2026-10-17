// Honest KPIs. "Correct" is judged against ground truth (tags) for synthetic cases; invoices without truth are not scored.
// Agent decision = the first history entry (by "agent"); later human decisions do not count as autonomy.
export const PRICES = {
  // Decision model: bench/RESULTS.md, Fastino GLiDE US$0.0031 per 30 invoices (2 yes/no questions each).
  modelPerInvoiceUsd: 0.0031 / 30,
  // Cloudflare Workers Paid: US$0.30 per extra million requests (https://developers.cloudflare.com/workers/platform/pricing/); ~4 requests per invoice.
  workersPerInvoiceUsd: (0.3 / 1e6) * 4,
};
const ARDENT = "https://payablesplace.ardentpartners.com/2026/01/state-of-epayables-part-nine-ap-benchmarks-and-best-in-class-performance/";
const ARDENT_PDF = "https://www.bottomline.com/cdn/1517/5157/1685/Ardent_Partners_-_State_of_ePayables_2025_-_Bottomline_-_FINAL.pdf";
/** Market benchmarks (docs/MARKET.md). Averages verified on the Ardent page; Best-in-Class from the report tables. */
export const BENCHMARKS = {
  costPerInvoiceUsd: { avg: 9.84, best: 2.65, source: "Ardent Partners, State of ePayables 2025", url: ARDENT },
  processingDays: { avg: 8.2, best: 2.9, source: "Ardent Partners, State of ePayables 2025", url: ARDENT },
  straightThrough: { avg: 0.354, best: 0.51, source: "Ardent Partners, State of ePayables 2025 (tables 1–2)", url: ARDENT_PDF },
  exceptionRate: { avg: 0.184, best: 0.111, source: "Ardent Partners, State of ePayables 2025", url: ARDENT },
};
const pct = (a, n) => (n ? a / n : null);
const quant = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
/** Expected outcome for a truth record: "pay" (valid), "escalate" (a person must look), or "hold" (trap). */
export const expected = (t) => (t.tags?.includes("valid") ? "pay" : t.tags?.some((x) => /needs-approval|ambiguous|missing-/.test(x)) && !t.tags.some((x) => x.startsWith("trap:") && !/ambiguous/.test(x)) ? "escalate" : "hold");

/** log: entries; truthOf(entry) -> manifest record or null. */
export function metrics(log, truthOf = () => null) {
  const n = log.length, agentAct = (e) => (e.history?.[0]?.by === "agent" ? e.history[0].action : e.action);
  const scored = log.map((e) => ({ e, t: truthOf(e), a: agentAct(e) })).filter((x) => x.t);
  const valid = scored.filter((x) => expected(x.t) === "pay");
  const correctAuto = scored.filter((x) => x.a !== "escalate" && x.a === expected(x.t)).length;
  const wronglyHeld = valid.filter((x) => x.a !== "pay");
  const esc = log.filter((e) => agentAct(e) === "escalate").length;
  const ms = log.map((e) => e.ms).filter((x) => typeof x === "number");
  const human = log.filter((e) => e.history?.length > 1 && e.history[0].action === "escalate").map((e) => Date.parse(e.history.at(-1).at) - Date.parse(e.history[0].at)).filter((x) => x >= 0);
  const modelCalls = log.filter((e) => e.model).length;
  return {
    n, scored: scored.length,
    correctAutonomy: pct(correctAuto, scored.length),
    wronglyHeldValid: wronglyHeld.length, validCount: valid.length, wronglyHeldRate: pct(wronglyHeld.length, valid.length),
    escalationRate: pct(esc, n),
    agentMsP50: quant(ms, 0.5), agentMsP95: quant(ms, 0.95),
    humanMinutesP50: human.length ? Math.round(quant(human, 0.5) / 6e4) : null, humanDecisions: human.length,
    costPerInvoiceUsd: n ? (modelCalls * PRICES.modelPerInvoiceUsd + n * PRICES.workersPerInvoiceUsd) / n : null,
  };
}
