// Heuristic, deterministic field extraction from untrusted invoice text (ES/EN/PT).
// Never executes or follows anything in the text. Missing/ambiguous field => null (engine escalates).
import { VENDORS } from "../data/vendors.mjs";

export const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\b(s\.?a\.?s|s\.?a\.? de c\.?v|ltda|sac|spa|s\.?c|s\.?a|srl|me|cia)\b\.?/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const CODES = ["USD", "COP", "MXN", "BRL", "PEN", "CLP", "ARS", "EUR"];
const SYM = { "R$": "BRL", "US$": "USD", "MX$": "MXN", "S/": "PEN" };
const MONTHS = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12,
  janeiro:1,fevereiro:2,marco:3,maio:5,junho:6,julho:7,setembro:9,outubro:10,novembro:11,dezembro:12,
  january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };

export function parseNumber(raw) {
  const s = raw.replace(/\s/g, "");
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  let dec = null;
  if (lc >= 0 && ld >= 0) dec = lc > ld ? "," : ".";
  else if (lc >= 0 || ld >= 0) { const sep = lc >= 0 ? "," : "."; const parts = s.split(sep); if (parts.length === 2 && parts[1].length === 2) dec = sep; }
  const clean = dec ? s.replace(new RegExp(`\\${dec === "," ? "." : ","}`, "g"), "").replace(dec, ".") : s.replace(/[.,]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}
const AMT = String.raw`(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)`;
const CUR = String.raw`(R\$|US\$|MX\$|S\/|\$|${CODES.join("|")})`;
const AMOUNT_RE = new RegExp(String.raw`${CUR}\s?${AMT}(?!\d)|${AMT}\s?(${CODES.join("|")})\b`, "g");

export function findAmount(text) {
  // Prefer amounts on a line/segment introduced by a total keyword.
  const segs = text.split(/\n|,\s(?=[a-zA-Z])/);
  const cands = [];
  for (const seg of segs) {
    const isTotal = /\b(total|valor total|amount due|monto)\b/i.test(seg);
    for (const m of seg.matchAll(AMOUNT_RE)) {
      const sym = m[1] ?? m[4], num = m[2] ?? m[3];
      const currency = CODES.includes(sym) ? sym : SYM[sym] ?? null; // bare "$" => ambiguous
      cands.push({ isTotal, currency, amount: parseNumber(num), raw: m[0] });
    }
  }
  const totals = cands.filter((c) => c.isTotal);
  if (totals.length === 1) return totals[0];
  if (totals.length > 1) { const same = totals.every((t) => t.amount === totals[0].amount && t.currency === totals[0].currency); return same ? totals[0] : { amount: null, currency: null }; }
  return { amount: null, currency: null }; // no explicit total => don't guess
}
export function parseDate(s) {
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); // dd/mm/yyyy (LatAm)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const t = norm(s);
  m = t.match(/(\d{1,2}) de ([a-z]+) de (\d{4})/) ;
  if (m && MONTHS[m[2]]) return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/([a-z]+) (\d{1,2}) (\d{4})/);
  if (m && MONTHS[m[1]]) return `${m[3]}-${String(MONTHS[m[1]]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}
function after(text, re) { const m = text.match(re); return m ? m[1].trim() : null; }
// Same as after() but records the evidence span (offsets into the text) for the detail view.
function span(ev, field, text, re, conf) {
  const m = text.match(re); if (!m) return null;
  const v = m[1].trim(), start = m.index + m[0].indexOf(m[1]);
  ev[field] = { text: v, start, end: start + m[1].length, confidence: conf }; return v;
}

export function matchVendor(name, reg = VENDORS) {
  if (!name) return null;
  const n = norm(name);
  for (const [k, v] of Object.entries(reg)) if ([v.name, ...(v.aliases ?? [])].some((a) => norm(a) === n)) return k;
  return null;
}
const INJECTION = /(ignor[ae]?r?|disregard|olvida|esque[cç]a)\b[^\n]{0,40}\b(regla|rule|instruc|regra|polic)|\b(system|sistema)\s*:|\b(aprueba|approve|aprove)\b[^\n]{0,30}\b(ahora|now|agora|inmediato|immediately)|nota para el agente|note to the agent|aten[cç][aã]o agente/i;

/** Line items: description + qty + unit price (e.g. "40 horas x COP 180.000"). */
export function lineItems(t) {
  const desc = after(t, /(?:concepto|description|descri[cç][aã]o|for|referente a)\s*:\s*([^\n]+)/i);
  if (!desc) return [];
  return desc.split(/\s\+\s|;/).map((d) => {
    const m = d.match(new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(?:horas?|hours?|h)?\s*x\s*${CUR}?\s*${AMT}`, "i"));
    return { description: d.trim(), qty: m ? parseNumber(m[1]) : 1, unitPrice: m ? parseNumber(m[3]) : null };
  });
}
export function extractText(text) {
  const t = text.replace(/\r/g, ""), ev = {};
  const payeeRaw = span(ev, "vendor", t, /(?:proveedor|vendor|fornecedor)\s*:\s*([^\n]+)/i, 0.97) ?? span(ev, "vendor", t, /(?:factura|invoice|fatura)\s+[A-Z0-9][\w\-/]*\s+(?:de|from|da|do)\s+(.+?)(?:,|\n|$)/i, 0.85);
  const number = span(ev, "invoice_number", t, /(?:factura|invoice|fatura|nota fiscal)\s*(?:n[°ºo*]\.?|#|no\.?)?\s*:?\s*([A-Z0-9][A-Z0-9\-/]*\d[A-Z0-9\-/]*)/i, 0.95);
  const dueRaw = span(ev, "due_date", t, /(?:vence(?:\s+el)?|due(?: date)?|vencimento|fecha de vencimiento)\s*:?\s*([^\n,]+(?:,\s*\d{4})?)/i, 0.93);
  const acct = span(ev, "bank_account", t, /(?:cuenta|account|conta)\s*:?\s*([A-Z]{2}-[A-Z0-9]+-\d+)/i, 0.97);
  const dateRaw = after(t, /(?:^|\n)\s*(?:fecha|date|data)\s*:\s*([^\n]+)/i) ?? after(t, /^\[(\d{4}-\d{2}-\d{2})/);
  const am = findAmount(t), { amount, currency } = am;
  if (amount != null && am.raw) { const st = t.indexOf(am.raw); ev.amount = { text: am.raw, start: st, end: st + am.raw.length, confidence: 0.95 }; if (currency) ev.currency = { ...ev.amount, confidence: 0.95 }; }
  const vendorKey = matchVendor(payeeRaw);
  if (ev.vendor) ev.vendor.confidence = vendorKey ? ev.vendor.confidence : 0.6; // read fine, but not a registered vendor
  const items = lineItems(t);
  const d = t.match(/(?:concepto|description|descri[cç][aã]o|for|referente a)\s*:\s*([^\n]+)/i);
  if (d) { const st = d.index + d[0].indexOf(d[1]); ev.line_items = { text: d[1].trim(), start: st, end: st + d[1].length, confidence: items.every((i) => i.unitPrice != null) ? 0.9 : 0.75 }; }
  return { payee: payeeRaw, vendorKey, number, amount, currency, due: dueRaw ? parseDate(dueRaw) : null, date: dateRaw ? parseDate(dateRaw) : null, acct,
    injectionSuspected: INJECTION.test(t), items, evidence: ev, text: t.slice(0, 4000) };
}
