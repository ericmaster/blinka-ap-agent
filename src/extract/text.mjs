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
  else if (lc >= 0 || ld >= 0) { const sep = lc >= 0 ? "," : "."; const parts = s.split(sep); if (parts.length === 2 && parts[1].length === 2) dec = sep;
    else if (parts.slice(1).some((x) => x.length !== 3)) return null; } // e.g. "1.5" or "1,5": ambiguous -> null (escalates)
  else if (lc < 0 && ld < 0) {}
  if (dec) { const th = dec === "," ? "." : ","; if (s.split(dec)[0].split(th).slice(1).some((x) => x.length !== 3)) return null; }
  const clean = dec ? s.replace(new RegExp(`\\${dec === "," ? "." : ","}`, "g"), "").replace(dec, ".") : s.replace(/[.,]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}
const AMT = String.raw`(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)`;
const CUR = String.raw`(R\$|US\$|MX\$|S\/|\$|${CODES.join("|")})`;
const AMOUNT_RE = new RegExp(String.raw`${CUR}\s?${AMT}(?![\d]|[.,]\d)|${AMT}\s?(${CODES.join("|")})\b`, "g");
// Total lines, ranked. Strong: the amount the payer owes. Weak: a bare "total". Excluded: subtotals, taxes, withholdings, discounts, payments, carried-forward, hours.
const STRONG = /total a pagar|total due|amount due|balance due|valor a pagar|neto a pagar|valor l[ií]quido|valor total da nota|total general|grand total|importe total|total factura|total a cobrar|monto total|total amount|total da fatura|total da nota/i;
const WEAK = /\b(total|valor total|monto|importe)\b/i;
const EXCL = /sub-?\s?total|\biva\b|\bigv\b|\biss\b|impuesto|\btax|retenci|reten[cç]|withholding|descuento|discount|desconto|pagado|paid|anticipo|abono|saldo anterior|previous|carried|acarreo|p[aá]gina|\bpage\b|base imponible|base de c[aá]lculo|exent[oa]|\bop\.|horas|hours|\bhrs\b|unit|en letras|in words|por extenso|deduc|pis|cofins|traslad/i;
const CUR_LABEL = new RegExp(String.raw`(?:moneda|currency|divisa|moeda)\s*[:=]?\s*\(?(${CODES.join("|")})\b`, "i");

/** Amount due: the strongest-ranked total line; conflicting totals at the same rank => null (escalate). Currency from the symbol/code on that line,
 *  else from an explicit "Moneda/Currency" label; a bare "$" without a label stays ambiguous. */
export function findAmount(text) {
  const cands = []; let off = 0;
  for (const line of text.split("\n")) {
    for (const seg of line.split(/,\s(?=[a-zA-Z])/)) { // chat lines: "total 1.600 USD, due ..."
      const base = off + line.indexOf(seg); let last = 0;
      for (const m of seg.matchAll(AMOUNT_RE)) {
        const label = seg.slice(last, m.index); last = m.index + m[0].length;
        const rank = STRONG.test(label) ? 2 : WEAK.test(label) && !EXCL.test(label) ? 1 : 0;
        if (!rank) continue;
        const sym = m[1] ?? m[4], num = m[2] ?? m[3];
        cands.push({ rank, currency: CODES.includes(sym) ? sym : SYM[sym] ?? null, amount: parseNumber(num), raw: m[0], index: base + m.index });
      }
      if (last === 0 && STRONG.test(seg)) { // strong total with a bare number ("TOTAL DUE   15,600.00")
        const b = seg.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{2})\s*$/);
        if (b && !EXCL.test(seg.slice(0, b.index).replace(STRONG, ""))) cands.push({ rank: 2, currency: null, bare: true, amount: parseNumber(b[1]), raw: b[1], index: base + b.index });
      }
    }
    off += line.length + 1;
  }
  const top = Math.max(0, ...cands.map((c) => c.rank)), best = cands.filter((c) => c.rank === top && c.amount != null);
  if (!best.length) return { amount: null, currency: null };
  if (!best.every((c) => c.amount === best[0].amount)) return { amount: null, currency: null };
  const curs = [...new Set(best.map((c) => c.currency).filter(Boolean))];
  if (curs.length > 1) return { amount: null, currency: null };
  const label = text.match(CUR_LABEL)?.[1]?.toUpperCase() ?? null, pick = best.find((c) => c.currency) ?? best[0];
  let currency = curs[0] ?? null;
  if (!currency && label) currency = label; // bare number or "$" + explicit currency label
  else if (currency && label && label !== currency) currency = null; // conflicting signals => ambiguous
  return { amount: pick.amount, currency, raw: pick.raw, index: pick.index };
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
// First match of any regex (global) whose captured value passes `ok`; records the evidence span (offsets into the text) for the detail view.
function first(ev, field, text, res, conf, ok = () => true, map = (v) => v) {
  for (const re of [].concat(res)) for (const m of text.matchAll(re)) {
    const v = m[1].trim(), val = map(v); if (!v || !ok(val, v)) continue;
    const start = m.index + m[0].lastIndexOf(m[1]);
    if (ev && start < (text.base ?? text.length)) ev[field] = { text: v, start, end: start + m[1].length, confidence: conf };
    else if (ev) { const st = text.indexOf(v); ev[field] = { text: v, start: st, end: st + v.length, confidence: conf }; }
    return val;
  }
  return null;
}
export function matchVendor(name, reg = VENDORS) {
  if (!name) return null;
  const n = norm(name);
  for (const [k, v] of Object.entries(reg)) if ([v.name, ...(v.aliases ?? [])].some((a) => norm(a) === n)) return k;
  return null;
}
const INJECTION = /(ignor[ae]?r?|disregard|olvida|esque[cç]a)\b[^\n]{0,40}\b(regla|rule|instruc|regra|polic)|\b(system|sistema)\s*:|\b(aprueba|approve|aprove)\b[^\n]{0,30}\b(ahora|now|agora|inmediato|immediately)|nota para el agente|note to the agent|aten[cç][aã]o agente|\b(override|bypass|skip|salta|omit[ea]|anula)\b[^\n]{0,40}\b(safety|security|check|control|regla|rule|verific|seguridad)|\b(do not|don't|no)\s+(follow|sigas|seguir|apply|apliques)\b[^\n]{0,30}\b(rule|regla|polic|instruc)|\b(authori[sz]e|autoriza|pay|paga|pague)\b[^\n]{0,25}\b(without|sin|sem)\s+(review|revis|check|verific|aprobaci)|\b(ai|ia|bot|assistant|asistente|agent[ee]?)\s*[,:]\s*(please\s+)?(pay|paga|approve|aprueba|ignore|ignora)/i;
const NW = /northwind/i;
const VENDOR_LABEL = /(?:^|[\n\t])[ \t]*(?:proveedor|vendor|fornecedor|emisor|raz[oó]n\s+social(?:\s+del\s+emisor)?|nome\s*\/\s*raz[aã]o\s+social|raz[aã]o\s+social|prestador(?:\s+de\s+servi[cç]os)?|issued\s+by|bill(?:ed)?\s+from|supplier)\s*:[ \t]*([^\n\t]+)/gi;
const TAXID = /\b(NIT|RFC|CNPJ|RUC|R\.U\.C\.|RUT|R\.U\.T\.|Tax ID|EIN|CUIT)\b/;
const nameish = (c) => /[A-Za-zÀ-ÿ]{2,}.*\s.*[A-Za-zÀ-ÿ]/.test(c) && !/[@:]/.test(c) && !NW.test(c) && !TAXID.test(c) && c.length < 80;
/** Issuer name: explicit label -> a registered vendor named on the page -> the name just above the issuer's tax id -> email From display name. */
function findVendor(t, ev, reg) {
  const lab = first(ev, "vendor", t, [VENDOR_LABEL, /(?:factura|invoice|fatura)\s+[A-Z0-9][\w\-/]*\s+(?:de|from|da|do)\s+(.+?)(?:,|\n|$)/gi], 0.97, (v) => !NW.test(v) && !/@/.test(v) && /[a-z]{2}/i.test(v));
  if (lab) return lab;
  const lines = t.slice(0, t.base ?? t.length).split("\n");
  const cellsOf = (l) => l.split(/\t| · | — | \| /).map((c) => c.trim()).filter(Boolean);
  for (const l of lines) for (const c of cellsOf(l)) if (matchVendor(c, reg)) return mark(ev, t, c, 0.9);
  for (const l of lines.slice(0, 15)) { // OCR merges a line's cells ("AD Andes Dev Studio SAS FACTU RA"): try the name without logo initials / trailing title tokens
    const tk = l.trim().split(/\s+/);
    for (let a = 0; a <= (/^[A-Z]{1,3}$/.test(tk[0]) ? 1 : 0); a++) for (let b = tk.length; b > a + 1 && b >= tk.length - 4; b--) {
      const c = tk.slice(a, b).join(" "); if (matchVendor(c, reg)) return mark(ev, t, c, 0.85); }
  }
  for (let i = 0; i < lines.length; i++) {
    if (!TAXID.test(lines[i]) || NW.test(lines[i]) || /XEXX|EIN/.test(lines[i])) continue;
    const cs = cellsOf(lines[i]), k = cs.findIndex((c) => TAXID.test(c)), before = cs.slice(0, k).filter(nameish);
    const c = before.at(-1) ?? [lines[i - 1], lines[i - 2]].filter(Boolean).flatMap(cellsOf).find(nameish);
    if (c) return mark(ev, t, c, 0.8);
    break;
  }
  const from = t.match(/^From:\s*"?([^"<\n@]+?)"?\s*</m);
  return from && nameish(from[1]) ? mark(ev, t, from[1].trim(), 0.7) : null;
}
const mark = (ev, t, v, conf) => { const st = t.indexOf(v); ev.vendor = { text: v, start: st, end: st + v.length, confidence: conf }; return v; };

const TOKEN = String.raw`([A-Z0-9][A-Z0-9\-/]*\d[A-Z0-9\-/]*)`;
const NUM_RES = [
  new RegExp(String.raw`(?:invoice\s*(?:number|no\.?|n[o°º]\.?|#)|n[uú]mero\s+de\s+factura|n[°ºo]\.?\s+de\s+factura|factura(?:\s+(?:electr[oó]nica|de|venta|exportaci[oó]n|exenta))*\s*(?:n[°ºo]\.?|no\.?|#|n[uú]mero)?|folio(?:\s+interno)?|serie\s*-?\s*n[uú]mero|serie\s+y\s+folio|fatura\s*(?:n[°ºo]\.?|#)?|n[uú]mero\s+da\s+(?:nota|nfs-?e|fatura)|nota\s+fiscal\s*(?:n[°ºo]\.?)?|nfs-?e|invoice)\s*[:.#]?\s*${TOKEN}`, "gi"),
  new RegExp(String.raw`(?:^|[\n\t])\s*(?:N[°º]|No\.)\s*([A-Z]{1,6}[A-Z0-9]*-[A-Z0-9\-]*\d[A-Z0-9\-]*)\s*(?=$|[\n\t])`, "g"),
];
/** Printed e-invoice boxes put the title and the number on separate lines that may interleave with the letterhead column:
 *  "FACTURA ELECTRÓNICA" ... "LSD-310". Look a few lines below a bare title for a cell that is only an invoice-number token. */
function titleNumber(t, ev) {
  const L = t.split("\n");
  for (let i = 0; i < L.length; i++) {
    if (!L[i].split("\t").some((c) => /^(factura|invoice|fatura|nota fiscal|nfs-?e)(\s+[a-zà-ÿ]+){0,4}$/i.test(c.trim()))) continue;
    for (let j = i + 1; j < Math.min(L.length, i + 5); j++) for (const c of L[j].split("\t")) {
      const m = c.trim().match(/^(?:N[°º]\s*|No\.\s*)?([A-Z]{1,6}[A-Z0-9]*-[A-Z0-9\-]*\d[A-Z0-9\-]*)$/);
      if (m && okNumber(m[1])) { const st = t.indexOf(m[1], L.slice(0, j).join("\n").length); ev.invoice_number = { text: m[1], start: st, end: st + m[1].length, confidence: 0.85 }; return m[1]; }
    }
  }
  return null;
}
/** Last-resort number sources: OCR garbles "N°" / the hyphen ("Factura E AD:1046"), and payment blocks repeat the
 *  invoice number as the transfer reference ("Referencia: AD-1046"). */
const OCR_NUM = /\b(?:factura|fatura|invoice)\b[^\n\t\d]{0,6}?\b([A-Z]{1,5})\s?[-:.]\s?(\d{2,7})\b/;
const REF_NUM = /(?:^|[\n\t])\s*(?:refer[eêé]ncia|reference|ref\.)(?:\s+(?:de\s+pago|de\s+pagamento|del\s+pago|payment))?\s*[:#]\s*([A-Z]{1,6}[A-Z0-9]*-[A-Z0-9\-]*\d[A-Z0-9\-]*)\s*(?=$|[\n\t])/i;
function fallbackNumber(t, ev) {
  let m = t.match(OCR_NUM), v = m && `${m[1]}-${m[2]}`;
  if (m && okNumber(v)) { ev.invoice_number = { text: m[0], start: m.index, end: m.index + m[0].length, confidence: 0.7 }; return v; }
  m = t.match(REF_NUM);
  if (m && okNumber(m[1])) { const st = t.indexOf(m[1], m.index); ev.invoice_number = { text: m[1], start: st, end: st + m[1].length, confidence: 0.7 }; return m[1]; }
  return null;
}
const okNumber = (v) => !/^\d{4}-\d{2}-\d{2}/.test(v) && !/^\d+[.,]\d/.test(v) && (/[A-Z]/i.test(v) || v.length >= 3) && !/^(?:[A-Z]{2}-FAKE-|NWR-PO-)/.test(v);
const DUE_RES = [/(?:fecha\s+(?:de\s+)?vencimiento|fecha\s+l[ií]mite\s+de\s+pago|data\s+de\s+vencimento|vencimento|vencimiento|vence(?:\s+el)?|due\s+date|date\s+due|payment\s+due|due(?:\s+on)?)\s*[:=]?\s*([^\n\t,]+(?:,\s*\d{4})?)/gi];
const DATE_RES = [/(?:^|[\n\t])[ \t]*(?:invoice\s+date|issue\s+date|date\s+of\s+issue|fecha\s+de\s+emisi[oó]n|fecha\s+emisi[oó]n|fecha\s+de\s+expedici[oó]n|fecha\s+y\s+hora\s+de\s+(?:emisi[oó]n|expedici[oó]n)|fecha\s+de\s+factura|data\s+(?:e\s+hora\s+)?(?:de\s+|da\s+)?emiss[aã]o)\s*[:=]?\s*([^\n\t]+)/gi,
  /(?:^|[\n\t])[ \t]*(?:fecha|date|data)\s*:\s*([^\n\t]+)/gi, /^\[(\d{4}-\d{2}-\d{2})/g];
const ACCT_LABEL = /cuenta|account|conta\b|acct|clabe|\bcta\b|beneficiar/i, ACCT = /\b([A-Z]{2}-[A-Z0-9]+-\d+)\b/;
function findAcct(t, ev) {
  let off = 0;
  for (const l of t.split("\n")) { const m = l.match(ACCT), lab = m && l.slice(0, m.index).match(ACCT_LABEL);
    if (m && lab && m.index - lab.index < 70 && !/^NWR-/.test(m[1])) { const st = off + m.index; ev.bank_account = { text: m[1], start: st, end: st + m[1].length, confidence: 0.97 }; return m[1]; }
    off += l.length + 1; }
  return null;
}
/** Spreadsheet-style header row followed by a value row ("INVOICE #  DATE  DUE DATE" / "MOP-2213  2026-10-05 ...") -> "label: value" lines. */
const HDR = /^(invoice\s*(#|no\.?|number)|date|due date|po( number| #)?|fecha( de emisi[oó]n)?|vencimiento|fecha de vencimiento|factura\s*(n[°º]|#|no\.?)|n[uú]mero|data|vencimento|currency|moneda)$/i;
function headerPairs(t) {
  const L = t.split("\n"), out = [];
  for (let i = 0; i + 1 < L.length; i++) { const a = L[i].split("\t").map((s) => s.trim()), b = L[i + 1].split("\t").map((s) => s.trim());
    const hs = a.filter((c) => HDR.test(c)); if (hs.length < 2) continue;
    const k = a.findIndex((c) => HDR.test(c)), vals = b.slice(-(a.length - k)); if (vals.length !== a.length - k) continue;
    a.slice(k).forEach((h, j) => HDR.test(h) && vals[j] && out.push(`${h}: ${vals[j]}`)); }
  if (!out.length) for (let i = 0; i + 1 < L.length; i++) { // OCR (no column breaks): "BILL TO INVOICE # DATE DUE DATE PO NUMBER" / "... MOP-2210 2026-10-05 2026-10-30 NWR-PO-1915"
    const hs = [...L[i].matchAll(/invoice\s*(?:#|no\.?|number)|due date|po number|(?<!due )date/gi)].map((m) => m[0]);
    if (hs.length < 3) continue;
    const next = L.slice(i + 1, i + 4).find((x) => x.trim()) ?? "", toks = next.trim().split(/\s+/).slice(-hs.length);
    if (toks.length === hs.length && toks.some((x) => /\d{4}-\d{2}-\d{2}/.test(x))) hs.forEach((h, j) => out.push(`${h}: ${toks[j]}`));
    break;
  }
  return out.join("\n");
}

/** Line items: free-text "Concepto:" line, else rows of an item table (description, qty, unit, unit price, amount; qty x price = amount). */
export function lineItems(t, ev = {}) {
  const d = t.match(/(?:concepto|description|descri[cç][aã]o|for|referente a)\s*:\s*([^\n]+)/i);
  if (d) { const items = d[1].split(/\s\+\s|;/).map((x) => parseItemText(x)).map(({ unit, ...i }) => i);
    const st = d.index + d[0].indexOf(d[1]); ev.line_items = { text: d[1].trim(), start: st, end: st + d[1].length, confidence: items.every((i) => i.unitPrice != null) ? 0.9 : 0.75 };
    return items; }
  return tableItems(t, ev);
}
const HEAD_DESC = /descrip|description|descri[cç]|concepto|discrimina|detalle|\bitem\b|servic/i, HEAD_QTY = /\b(cant|qty|quantity|qtd|quant|hrs|hours|horas|units?)\b/i, HEAD_AMT = /amount|importe|valor|total|monto|price|precio|rate/i;
const STOP = /^\s*(sub-?\s?total|total|op\.\s|monto exento|valor total da nota|vencimento|son:|importe con letra|currency:|moneda:|amount in words|tax\b|iva\b)/i;
const numTok = (s) => { const c = s.replace(/^(R\$|US\$|MX\$|S\/|\$)/, "").replace(/[,;:]$/, ""); return /^\d[\d.,]*$/.test(c) ? parseNumber(c) : null; };
function parseRow(line) {
  const cells = line.split("\t").map((c) => c.trim()).filter(Boolean), toks = line.split(/\s+/).filter(Boolean), nums = [];
  toks.forEach((tk, i) => { const v = numTok(tk); if (v != null) nums.push({ i, v }); });
  for (let k = nums.length - 1; k >= 2; k--) for (let j = k - 1; j >= 1; j--) for (let q = j - 1; q >= 0; q--) {
    const [Q, P, A] = [nums[q], nums[j], nums[k]];
    if (A.v > 0 && P.v > 0 && Q.v > 0 && Q.v <= 10000 && Math.abs(Q.v * P.v - A.v) < 0.011) {
      const alpha = cells.filter((c) => /[A-Za-zÀ-ÿ]{3,}/.test(c) && numTok(c) == null && !/^[A-Z]{1,3}\d{2,}$|^[A-Z]{2,3}-\d{3}$/.test(c));
      let desc = cells.length > 1 ? alpha.sort((a, b) => b.length - a.length)[0] : toks.slice(0, Q.i).filter((x, n) => !(n === 0 && /^\d{1,2}$/.test(x)) && !/^\d{6,}$|^[A-Z]{2,3}-\d{3}$/.test(x)).join(" ");
      if (!desc) desc = toks.slice(Q.i + 1, P.i).filter((x) => !/^[A-Z]{1,3}\d*$/.test(x)).join(" ");
      return desc ? { description: desc, qty: Q.v, unitPrice: P.v } : null;
    }
  }
  return null;
}
function tableItems(t, ev) {
  const L = t.split("\n"); let off = 0, h = -1, offs = [];
  for (let i = 0; i < L.length; i++) { offs.push(off); off += L[i].length + 1; if (h < 0 && HEAD_DESC.test(L[i]) && HEAD_QTY.test(L[i]) && HEAD_AMT.test(L[i]) && !/:\s*\S/.test(L[i].replace(/\t/g, " "))) h = i; }
  if (h < 0) { // header not readable (e.g. white-on-dark in a photo): accept stand-alone rows where qty x price = amount
    const items = []; let o = 0, s0 = null, e0 = 0;
    for (const l of L) { const row = !/:/.test(l) && /[A-Za-zÀ-ÿ]{3,}/.test(l) && parseRow(l); if (row) { items.push(row); s0 ??= o; e0 = o + l.length; } o += l.length + 1; }
    if (items.length) ev.line_items = { text: t.slice(s0, e0), start: s0, end: e0, confidence: 0.75 };
    return items;
  }
  const items = []; let last = null, end = h;
  for (let i = h + 1; i < Math.min(L.length, h + 40); i++) {
    const l = L[i]; if (STOP.test(l)) break;
    const row = parseRow(l);
    if (row) { items.push(row); last = row; end = i; continue; }
    if (last && /[A-Za-zÀ-ÿ]/.test(l) && !/:/.test(l) && !/\d[.,]\d/.test(l) && l.trim().length < 80 && i === end + 1) { last.description += " " + l.trim(); end = i; continue; }
    if (items.length && !l.trim()) break;
  }
  if (items.length) ev.line_items = { text: L.slice(h + 1, end + 1).join("\n"), start: offs[h + 1], end: offs[end] + L[end].length, confidence: 0.88 };
  return items;
}

export function extractText(text, reg = VENDORS) {
  const t0 = text.replace(/\r/g, ""), ev = {}, pairs = headerPairs(t0);
  const T = withBase(pairs ? t0 + "\n" + pairs : t0, t0.length); // header/value pairs appended for matching only
  const payeeRaw = findVendor(T, ev, reg);
  const number = first(ev, "invoice_number", T, NUM_RES, 0.95, okNumber) ?? titleNumber(t0, ev) ?? fallbackNumber(t0, ev);
  const dueRaw = first(ev, "due_date", T, DUE_RES, 0.93, (v) => v != null, parseDate);
  const acct = findAcct(t0, ev);
  const date = first(null, "date", T, DATE_RES, 0.9, (v) => v != null, parseDate);
  const am = findAmount(t0), { amount, currency } = am;
  if (amount != null && am.raw) { ev.amount = { text: am.raw, start: am.index, end: am.index + am.raw.length, confidence: 0.95 }; if (currency) ev.currency = { ...ev.amount, confidence: 0.95 }; }
  const vendorKey = matchVendor(payeeRaw, reg);
  if (ev.vendor) ev.vendor.confidence = vendorKey ? ev.vendor.confidence : 0.6; // read fine, but not a registered vendor
  let items = lineItems(t0, ev);
  if (items.length === 1 && items[0].unitPrice == null && amount != null) items = [{ ...items[0], unitPrice: Math.round((amount / items[0].qty) * 100) / 100 }]; // single flat item = the total
  return { payee: payeeRaw, vendorKey, number, amount, currency, due: dueRaw, date, acct,
    injectionSuspected: INJECTION.test(t0), items, evidence: ev, text: t0.slice(0, 6000) };
}
const withBase = (s, base) => { const o = new String(s); o.base = base; return o; };

const CURP = String.raw`(?:R\$|US\$|MX\$|S\/|\$|USD|COP|MXN|BRL|PEN|CLP|ARS|EUR)`, NUMP = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?`;
const IT1 = new RegExp(String.raw`^(.*?)[:,]?\s*(\d+(?:[.,]\d+)?)\s*(horas?|hours?|hrs?|h)\s*x\s*(?:${CURP}\s*)?(${NUMP})(.*)$`, "i");
const IT2 = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s+(.+?)\s+x\s+(?:${CURP}\s*)?(${NUMP})(.*)$`, "i");
const IT3 = new RegExp(String.raw`^(.*?\S)\s+${CURP}\s*(${NUMP})(.*)$`, "i");
/** One "Concepto:" item in free text -> canonical {description, qty, unitPrice, unit}. The qty x price clause is removed from the description
 *  so the same item reads identically from an email line and from a PDF table row (duplicate fingerprints compare across channels). */
export function parseItemText(part) {
  const s = part.trim(); let m;
  if ((m = s.match(IT1))) return { description: (m[1] + " " + m[5].trim()).trim(), qty: parseNumber(m[2]), unitPrice: parseNumber(m[4]), unit: m[3] };
  if ((m = s.match(IT2))) return { description: (m[2] + " " + m[4].trim()).trim(), qty: parseNumber(m[1]), unitPrice: parseNumber(m[3]), unit: "h" };
  if ((m = s.match(IT3))) return { description: (m[1] + " " + m[3].trim()).trim(), qty: 1, unitPrice: parseNumber(m[2]), unit: null };
  return { description: s, qty: 1, unitPrice: null, unit: null };
}
