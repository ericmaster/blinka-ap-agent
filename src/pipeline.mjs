// End-to-end: document -> extraction -> rules (+ model questions) -> decision log entry.
import { extract } from "./extract/index.mjs";
import { decide, questionsFor, hardChecks, toUsd } from "./engine/decide.mjs";

export const kindOf = (f) => (f.endsWith(".pdf") ? "pdf" : f.endsWith(".png") || f.endsWith(".jpg") ? "image" : f.includes(".chat.") ? "chat" : "email");

export async function processDoc(doc, { ledger, rules, adapter, mapExtracted = (x) => x }) {
  const t0 = Date.now();
  let x;
  try { x = mapExtracted({ ...(await extract(doc)), id: doc.id }); }
  catch (e) { return { id: doc.id, channel: doc.kind, action: "escalate", reasons: [`No se pudo leer el documento (${e.message}).`], extracted: null }; }
  // Ask the model only when hard rules didn't already hold it and the payee is known (questions need the agreement).
  const pre = hardChecks(x, ledger, rules);
  let answers = null;
  if (!pre.hold.length && x.vendorKey) answers = await adapter.ask(questionsFor(x, ledger), { id: doc.id });
  const { action, reasons } = decide(x, answers, ledger, rules);
  const { text, ...fields } = x;
  return { id: doc.id, channel: doc.kind, action, reasons, reason: reasons.join(" "), extracted: fields,
    amountUsd: x.amount != null && x.currency ? toUsd(x.amount, x.currency, rules) : null,
    model: answers ? { name: answers.model ?? null, is_duplicate: answers.is_duplicate ?? null, matches_agreement: answers.matches_agreement ?? null, error: answers.error ?? null } : null,
    ms: Date.now() - t0, at: new Date().toISOString() };
}
