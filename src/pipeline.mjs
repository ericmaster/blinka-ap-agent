// End-to-end: document -> extraction -> rules (+ model questions) -> decision log entry.
import { extract } from "./extract/index.mjs";
import { decide, questionsFor, hardChecks, toUsd } from "./engine/decide.mjs";

export const kindOf = (f) => (f.endsWith(".pdf") ? "pdf" : f.endsWith(".png") || f.endsWith(".jpg") ? "image" : f.includes(".chat.") ? "chat" : "email");

export async function processDoc(doc, { ledger, rules, adapter, mapExtracted = (x) => x }) {
  const t0 = Date.now();
  let x;
  try { x = mapExtracted({ ...(await extract(doc)), id: doc.id }); }
  catch (e) { return { id: doc.id, channel: doc.kind, action: "escalate", reasons: [`Could not read the document (${e.message}).`], extracted: null }; }
  // Ask the model only when hard rules didn't already hold it and the payee is known (questions need the agreement).
  const pre = hardChecks(x, ledger, rules);
  let answers = null;
  if (!pre.hold.length && x.vendorKey) answers = await adapter.ask(questionsFor(x, ledger), { id: doc.id });
  const { action, reasons, checks } = decide(x, answers, ledger, rules);
  const { text, evidence, ...fields } = x;
  const ocr = x.ocrConfidence != null ? x.ocrConfidence / 100 : 1;
  const schema = toSchema(x, evidence, ocr);
  return { id: doc.id, channel: doc.kind, action, reasons, reason: reasons.join(" "), checks, schema, sourceText: text, extracted: fields,
    amountUsd: x.amount != null && x.currency ? toUsd(x.amount, x.currency, rules) : null,
    model: answers ? { name: answers.model ?? null, is_duplicate: answers.is_duplicate ?? null, matches_agreement: answers.matches_agreement ?? null, error: answers.error ?? null } : null,
    ms: Date.now() - t0, at: new Date().toISOString() };
}

/** Standardized NER-style schema: value + evidence span + confidence per field. */
export function toSchema(x, ev = {}, ocr = 1) {
  const f = (value, key) => ({ value: value ?? null, evidence: ev[key] ? { text: ev[key].text, start: ev[key].start, end: ev[key].end } : null,
    confidence: value == null ? 0 : Math.round((ev[key]?.confidence ?? 0.8) * ocr * 100) / 100 });
  return { vendor: f(x.payee, "vendor"), amount: f(x.amount, "amount"), currency: f(x.currency, "currency"), due_date: f(x.due, "due_date"),
    invoice_number: f(x.number, "invoice_number"), bank_account: f(x.acct, "bank_account"),
    line_items: { ...f(x.items?.length ? x.items : null, "line_items") } };
}
