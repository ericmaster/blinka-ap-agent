// Display-only translation: deterministic labels and verbatim invoice entities.
export const TRANSLATION_VERSION = 2;
const LABELS = [
  ["Fecha de vencimiento|Vencimiento|Vence|Data de vencimento|Vencimento", "Due date"],
  ["Fecha de emisión|Fecha|Data de emissão|Data", "Date"],
  ["Cuenta bancaria|Cuenta|Conta bancária|Conta", "Account"],
  ["Factura N[.º°\\s]*[º°]?|Factura Nº|N[º°]|Fatura N[.º°\\s]*[º°]?", "Invoice No."],
  ["Factura|Fatura", "Invoice"], ["Proveedor|Fornecedor", "Vendor"],
  ["Total a pagar|Total", "Total due"], ["Cliente", "Customer"],
  ["Descripción|Descrição", "Description"], ["Cantidad|Quantidade", "Quantity"],
  ["Precio unitario|Preço unitário", "Unit price"], ["Horas", "hours"],
];
const START = new RegExp(`^(\\s*)(${LABELS.map(([s]) => s).join("|")})(?=\\s|:|$)`, "iu");
const EN_LABEL = /^(\s*)(Due date|Date|Account|Invoice No\.|Invoice|Vendor|Total due|Customer|Description|Quantity|Unit price|hours)(?=\s|:|$)/u;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function preTranslate(line) {
  return line.replace(START, (_, space, label) => space + LABELS.find(([s]) => new RegExp(`^(?:${s})$`, "iu").test(label))[1]);
}

/** Pure preparation; vendor is the extracted vendor's registry record, when known. */
export function maskLine(line, extracted = {}, vendor = {}) {
  const original = preTranslate(line), entities = [];
  const names = [extracted.payee, extracted.vendor?.name, ...(extracted.vendor?.aliases ?? []),
    vendor.name, ...(vendor.aliases ?? []), ...(extracted.aliases ?? []), extracted.acct,
    extracted.number, extracted.due, extracted.date, extracted.currency];
  const label = original.match(EN_LABEL)?.[2];
  const literals = [...new Set([...names, label].filter((s) => typeof s === "string" && s))].sort((a, b) => b.length - a.length);
  // Protect every numeric token: this also preserves amounts with any separator/precision,
  // line-item prices and quantities, rather than guessing a locale from the total.
  const re = new RegExp(["⟦\\d+⟧", "[A-Z]{2}-[A-Z0-9]+-\\d+", "[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}",
    "\\d{4}-\\d{2}-\\d{2}", "\\d{1,2}/\\d{1,2}/\\d{4}", ...literals.map(escape), "\\d(?:[\\d., \\u00a0]*\\d)?"].join("|"), "gu");
  const text = original.replace(re, (value) => { const token = `⟦${entities.length}⟧`; entities.push(value); return token; });
  return { text, entities, original, needsModel: /\p{L}/u.test(text.replace(/⟦\d+⟧/g, "")) };
}

/** Missing, duplicated or unknown placeholders mean the model output is unsafe to display. */
export function unmask(text, masked) {
  const tokens = typeof text === "string" ? text.match(/⟦\d+⟧/g) ?? [] : [];
  if (typeof text !== "string" || tokens.length !== masked.entities.length || masked.entities.some((_, i) => tokens.filter((t) => t === `⟦${i}⟧`).length !== 1)) return masked.original;
  return text.replace(/⟦(\d+)⟧/g, (_, i) => masked.entities[Number(i)]);
}
