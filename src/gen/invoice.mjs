// Realistic synthetic invoices: a structured model (letterhead, bill-to, meta, line items, taxes, totals, bank block, notes, fiscal stamps)
// rendered as PDF in several visual styles modelled on public templates and LatAm e-invoice printouts (see docs/INVOICE-FORMATS.md).
// ALL data is fictional: invented tax ids marked as such, .example domains, XX-FAKE accounts. Amounts equal the invoice facts exactly.
import { pdfDoc, textWidth } from "./pdf.mjs";
import { rng, hash, pick, fmtDate, fmtNum, fmtAmount } from "./format.mjs";
import { amountInWords } from "./words.mjs";
import { profileFor, NORTHWIND } from "../data/vendor-profiles.mjs";
import { parseItemText } from "../extract/text.mjs";

const T = {
  es: { invoice: "FACTURA", invNo: "Factura N°", issue: "Fecha de emisión", due: "Fecha de vencimiento", po: "Orden de compra", billTo: "FACTURAR A", currency: "Moneda",
    desc: "Descripción", qty: "Cant.", unit: "Unidad", price: "Valor unitario", amount: "Valor total", subtotal: "Subtotal", total: "Total a pagar", words: "SON",
    pay: "Datos para el pago", bank: "Banco", holder: "Titular", acct: "Cuenta", swift: "SWIFT/BIC", ref: "Referencia", notes: "Observaciones", terms: "Condiciones",
    page: (a, b) => `Página ${a} de ${b}`, hours: "horas", month: "mes", service: "servicio", dueOn: "con vencimiento el", thanks: "Gracias por su confianza.",
    termsTxt: (d) => `Pago a ${d} días por transferencia bancaria. Indique el número de factura como referencia. Los cargos bancarios del exterior corren por cuenta del ordenante.`,
    tax: "IVA 0% (exportación de servicios)", wh: "Retenciones (no aplica — cliente del exterior)", annex: "Anexo — Detalle de horas", date: "Fecha", activity: "Actividad", totalHours: "Total horas",
    tcTitle: "Términos y condiciones", tc: ["1. Esta factura corresponde a servicios prestados según el contrato marco vigente con Northwind Ridge Inc.", "2. Los pagos realizados después de la fecha de vencimiento podrán generar intereses de mora según lo pactado.", "3. Cualquier reclamo sobre esta factura debe presentarse dentro de los 10 días siguientes a su recepción.", "4. Los datos bancarios solo cambian mediante comunicación firmada y verificada por teléfono con el contacto registrado."] },
  en: { invoice: "INVOICE", invNo: "Invoice number", issue: "Date of issue", due: "Due date", po: "PO number", billTo: "BILL TO", currency: "Currency",
    desc: "Description", qty: "Qty", unit: "Unit", price: "Unit price", amount: "Amount", subtotal: "Subtotal", total: "Total due", words: "Amount in words",
    pay: "Payment instructions", bank: "Bank", holder: "Account holder", acct: "Account number", swift: "SWIFT/BIC", ref: "Reference", notes: "Notes", terms: "Terms",
    page: (a, b) => `Page ${a} of ${b}`, hours: "hours", month: "month", service: "service", dueOn: "due", thanks: "Thank you for your business!",
    termsTxt: (d) => `Net ${d}. Please pay by bank transfer and quote the invoice number as reference. Sender pays all bank fees.`,
    tax: "Tax 0% (export of services)", wh: "Withholding (n/a — foreign customer)", annex: "Annex — Timesheet", date: "Date", activity: "Activity", totalHours: "Total hours",
    tcTitle: "Terms and conditions", tc: ["1. Services are provided under the master services agreement in force with Northwind Ridge Inc.", "2. Late payments may accrue interest as agreed in the contract.", "3. Any dispute about this invoice must be raised within 10 days of receipt.", "4. Our bank details only change through a signed notice confirmed by phone with your registered contact."] },
  pt: { invoice: "FATURA", invNo: "Fatura nº", issue: "Data de emissão", due: "Data de vencimento", po: "Pedido de compra", billTo: "FATURAR PARA", currency: "Moeda",
    desc: "Descrição", qty: "Qtd.", unit: "Unid.", price: "Valor unitário", amount: "Valor total", subtotal: "Subtotal", total: "Total a pagar", words: "Valor por extenso",
    pay: "Dados para pagamento", bank: "Banco", holder: "Titular", acct: "Conta", swift: "SWIFT/BIC", ref: "Referência", notes: "Observações", terms: "Condições",
    page: (a, b) => `Página ${a} de ${b}`, hours: "horas", month: "mês", service: "serviço", dueOn: "com vencimento em", thanks: "Obrigado pela preferência.",
    termsTxt: (d) => `Pagamento em ${d} dias por transferência internacional. Informe o número da fatura como referência. Tarifas bancárias por conta do remetente.`,
    tax: "Tributos (exportação — 0%)", wh: "Retenções na fonte", annex: "Anexo — Relatório de horas", date: "Data", activity: "Atividade", totalHours: "Total de horas",
    tcTitle: "Termos e condições", tc: ["1. Serviços prestados conforme o contrato vigente com Northwind Ridge Inc.", "2. Pagamentos após a data de vencimento podem gerar juros conforme o contrato.", "3. Contestações devem ser enviadas em até 10 dias do recebimento.", "4. Dados bancários só mudam por comunicado assinado e confirmado por telefone com o contato cadastrado."] },
};
const ACT = { es: ["Desarrollo y pruebas", "Revisión de código", "Reunión de seguimiento", "Soporte a usuarios", "Documentación técnica", "Atención de tickets"],
  en: ["Reconciliations", "Accounts payable review", "Month-end close", "Ledger clean-up", "Client call", "Reporting"], pt: ["Análise de contratos", "Reunião com cliente", "Pareceres", "Revisão documental", "Pesquisa jurídica"] };

/** Structured items whose amounts sum to the invoice total (no rounding drift). */
export function itemsFor(inv, L) {
  const parts = inv.lines.split(/\s\+\s/).map(parseItemText);
  const known = parts.filter((p) => p.unitPrice != null).reduce((a, p) => a + p.qty * p.unitPrice, 0), open = parts.filter((p) => p.unitPrice == null);
  let items = parts;
  if (open.length === 1 && inv.amount - known > 0.004) open[0].unitPrice = Math.round((inv.amount - known) * 100) / 100;
  else if (open.length || Math.abs(known - inv.amount) > 0.004) items = [{ description: inv.lines, qty: 1, unitPrice: inv.amount, unit: null }];
  return items.map((p) => ({ ...p, unit: p.unit ? L.hours : items.length === 1 && /mensual|monthly|mensal|fija|fixo|fee|licencia|hospedagem/i.test(p.description) ? L.month : L.service, amount: Math.round(p.qty * p.unitPrice * 100) / 100 }));
}
const hex = (r, n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
const b64 = (r, n) => Array.from({ length: n }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[Math.floor(r() * 64)]).join("");

export function invoiceModel(inv, opts = {}) {
  const r = rng(hash(inv.id + "|" + inv.number)), p = profileFor(inv), lang = inv.lang, L = T[lang], cur = inv.currency;
  const auto = /^G/.test(inv.id) && !inv.layout ? rng(hash(inv.id + "style")) : null; // stress invoices: vary styles and page counts
  const style = opts.style ?? inv.layout?.style ?? (auto ? pick(auto, [p.style, p.style, p.style, "spreadsheet", "modern"]) : p.style);
  if (style === "freelance" && lang !== "en") return invoiceModel(inv, { ...opts, style: "modern" });
  const ds = style === "spreadsheet" || style === "cfdi" ? 0 : lang === "en" ? pick(r, [0, 2]) : pick(r, [1, 1, 2]), as = cur === "BRL" && r() < 0.6 ? 2 : pick(r, [0, 0, 3]);
  const money = (n) => fmtAmount(n, cur, lang, as), num = (n) => fmtNum(n, cur, lang, as), qtyf = (q) => (Number.isInteger(q) ? String(q) : fmtNum(q, "USD", lang === "en" ? "en" : lang, 0, 1));
  const items = itemsFor(inv, L), subtotal = items.reduce((a, i) => a + i.amount, 0);
  const termDays = inv.due ? Math.round((Date.parse(inv.due) - Date.parse(inv.date)) / 864e5) : 0;
  const hourly = items.some((i) => i.unit === L.hours);
  return {
    inv, p, lang, L, cur, style, money, num, qtyf, items, subtotal, total: inv.amount, r,
    pages: opts.pages ?? inv.layout?.pages ?? (hourly && items[0].qty >= 30 ? 2 : auto && auto() < 0.15 ? 2 : 1), hourly,
    issue: fmtDate(inv.date, lang, ds), issueIso: inv.date, due: inv.due ? fmtDate(inv.due, lang, ds) : null, termDays,
    po: NORTHWIND.po + String(1000 + (hash(inv.number) % 9000)), words: cur ? amountInWords(inv.amount, cur, lang) : null,
    cufe: hex(r, 96), uuid: [8, 4, 4, 4, 12].map((n) => hex(r, n).toUpperCase()).join("-"), sello: b64(r, 344), selloSat: b64(r, 344), verif: hex(r, 8).toUpperCase(),
    holder: p.person ? p.contact[0] : inv.payeeName, legal: p.person ? p.contact[0] : inv.payeeName,
  };
}

// ---------- drawing helpers ----------
const M = 40, RIGHT = 555.28, GRAY = "#555555", LIGHT = "#e5e7eb";
function initials(name) { return name.replace(/\(.*?\)/g, "").split(/\s+/).filter((w) => /^[A-ZÁÉÍÓÚ]/.test(w) && !/^(S\.?A|SAS|SAC|SpA|Ltda|S\.C\.|C\.V\.)/.test(w)).slice(0, 2).map((w) => w[0]).join("") || "IN"; }
function logo(d, x, y, m, size = 34) { d.rect(x, y, size, size, { fill: m.p.color ?? "#334155" }); d.text(x + size / 2, y + size / 2 + 5, initials(m.legal), { font: "HB", size: size * 0.42, color: "#ffffff", align: "center" }); }
function vendorLines(m) { return [`${m.p.taxLabel} ${m.p.taxId} (${m.lang === "en" ? "fictitious" : m.lang === "pt" ? "fictício" : "ficticio"})`, ...m.p.addr, `${billingEmail(m)} · ${m.p.phone}`]; }
export const billingEmail = (m) => `${m.lang === "pt" ? "financeiro" : m.lang === "en" ? "billing" : "facturacion"}@${m.p.domain}`;
function billTo(m) {
  const c = m.p.country;
  return [NORTHWIND.name, c === "MX" ? `RFC ${NORTHWIND.rfcForeign} · ${m.lang === "en" ? "Tax residence" : "Residencia fiscal"}: USA` : `${NORTHWIND.taxLabel} ${NORTHWIND.taxId}`, ...NORTHWIND.addr, NORTHWIND.email];
}
function kv(d, x, y, rows, { lw = 92, size = 8.5, gap = 12, sep = "", valueFont = "HB", labelColor = GRAY, rightAt = null } = {}) {
  for (const [k, v] of rows) { if (v == null) continue;
    d.text(x, y, k + sep, { size, color: labelColor });
    if (rightAt) d.text(rightAt, y, v, { font: valueFont, size, align: "right" }); else d.text(x + lw, y, v, { font: valueFont, size });
    y += gap; }
  return y;
}
/** Item table. cols: [{t, w, a, f(item)}]. Returns y after the table. */
function table(d, m, y, cols, { head = "#f3f4f6", headColor = "#111111", grid = false, zebra = false, size = 8.5, rowH = 15, x0 = M, border = "#d1d5db" } = {}) {
  const W = cols.reduce((a, c) => a + c.w, 0);
  d.rect(x0, y, W, rowH + 2, { fill: head, stroke: grid ? border : null });
  let x = x0; for (const c of cols) { d.text(c.a === "r" ? x + c.w - 4 : x + 4, y + rowH - 3, c.t, { font: "HB", size, color: headColor, align: c.a === "r" ? "right" : "left" }); x += c.w; }
  y += rowH + 2;
  m.items.forEach((it, idx) => {
    const descCol = cols.find((c) => c.desc), lines = d.wrap(it.description, descCol.w - 8, "H", size), h = Math.max(rowH, lines.length * (size + 2.5) + 6) + (m.subline ? 9 : 0);
    if (zebra && idx % 2) d.rect(x0, y, W, h, { fill: "#f9fafb" });
    let cx = x0;
    for (const c of cols) {
      if (c.desc) lines.forEach((l, i) => d.text(cx + 4, y + rowH - 4 + i * (size + 2.5), l, { size }));
      else d.text(c.a === "r" ? cx + c.w - 4 : cx + 4, y + rowH - 4, c.f(it, idx), { size, font: c.bold ? "HB" : "H", align: c.a === "r" ? "right" : "left" });
      if (grid) d.rect(cx, y, c.w, h, { stroke: border });
      cx += c.w;
    }
    if (m.subline) d.text(x0 + cols[0].w + 4, y + h - 4, m.subline(it), { size: 6.3, color: GRAY });
    if (!grid) d.line(x0, y + h, x0 + W, y + h, { color: LIGHT });
    y += h;
  });
  return y;
}
function totals(d, m, y, rows, { x = 340, right = RIGHT, size = 9, gap = 14, box = null, strong = "#111111" } = {}) {
  for (const [k, v, bold] of rows) {
    if (bold && box) d.rect(x - 6, y - size - 3, right - x + 6, size + 9, { fill: box });
    d.text(x, y, k, { size, font: bold ? "HB" : "H", color: bold ? strong : GRAY }); d.text(right - 4, y, v, { size, font: bold ? "HB" : "H", align: "right", color: bold ? strong : "#111111" });
    y += gap;
  }
  return y;
}
function para(d, x, y, text, w, { size = 8, color = "#333333", font = "H", lead = 1.35 } = {}) {
  for (const l of d.wrap(text, w, font, size)) { d.text(x, y, l, { size, color, font }); y += size * lead; }
  return y;
}
function footer(d, m, n, total, extra) {
  d.line(M, 806, RIGHT, 806, { color: LIGHT });
  d.text(M, 818, extra ?? `${m.legal} · ${m.p.taxLabel} ${m.p.taxId}`, { size: 6.5, color: "#888888" });
  d.text(RIGHT, 818, m.L.page(n, total), { size: 6.5, color: "#888888", align: "right" });
  d.text(M, 828, m.lang === "en" ? "Synthetic sample document — fictional company and data (Clearhold demo)." : m.lang === "pt" ? "Documento de exemplo sintético — empresa e dados fictícios (demo Clearhold)." : "Documento de muestra sintético — empresa y datos ficticios (demo Clearhold).", { size: 6, color: "#aaaaaa" });
}
function fakeQr(d, x, y, seed, size = 64) {
  const r = rng(hash(seed)), n = 25, c = size / n;
  d.rect(x, y, size, size, { fill: "#ffffff", stroke: "#cccccc" });
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const finder = (a, b) => i >= a && i < a + 7 && j >= b && j < b + 7;
    const f = finder(0, 0) || finder(0, n - 7) || finder(n - 7, 0);
    const on = f ? (i % (n - 7) === 0 || i % (n - 7) === 6 || j % (n - 7) === 0 || j % (n - 7) === 6 || ((i % (n - 7)) >= 2 && (i % (n - 7)) <= 4 && (j % (n - 7)) >= 2 && (j % (n - 7)) <= 4)) : r() < 0.48;
    if (on) d.rect(x + j * c, y + i * c, c, c, { fill: "#111111" });
  }
}
function barcode(d, x, y, w, h, seed) { const r = rng(hash(seed)); let cx = x; while (cx < x + w) { const bw = 0.6 + r() * 2; if (r() < 0.55) d.rect(cx, y, bw, h, { fill: "#111111" }); cx += bw + 0.4; } }
function payBlock(d, m, x, y, w, { title = true, size = 8 } = {}) {
  const L = m.L, p = m.p;
  if (title) { d.text(x, y, L.pay, { font: "HB", size: 9 }); y += 13; }
  const rows = [[L.bank, p.bank], [L.holder, m.holder], [`${L.acct} (${p.acctType})`, m.inv.acct], [L.swift, p.swift], [L.ref, m.inv.number]];
  for (const [k, v] of rows) { d.text(x, y, `${k}: ${v}`, { size }); y += size + 3.5; }
  return y;
}
function notesBlock(d, m, x, y, w) {
  const L = m.L; d.text(x, y, L.notes, { font: "HB", size: 9 }); y += 12;
  if (m.inv.injection) y = para(d, x, y, m.inv.injection, w, { size: 8, color: "#111111" }) + 2;
  y = para(d, x, y, `${L.terms}: ${L.termsTxt(m.termDays || 0)}`, w);
  if (m.inv.tags?.includes("trap:account-changed")) y = para(d, x, y + 2, { es: "IMPORTANTE: actualizamos nuestros datos bancarios; por favor utilice la cuenta indicada en esta factura.", en: "IMPORTANT: our banking details have been updated; please use the account shown on this invoice.", pt: "IMPORTANTE: atualizamos nossos dados bancários; utilize a conta indicada nesta fatura." }[m.lang], w, { font: "HB", color: "#111111" });
  return para(d, x, y + 2, L.thanks, w, { color: GRAY });
}
const STD_COLS = (m, { unit = true, idx = false } = {}) => [
  ...(idx ? [{ t: m.lang === "en" ? "#" : "Ítem", w: 30, f: (_, i) => String(i + 1) }] : []),
  { t: m.L.desc, w: (unit ? 255 : 305) - (idx ? 30 : 0), desc: true }, { t: m.L.qty, w: 40, a: "r", f: (i) => m.qtyf(i.qty) },
  ...(unit ? [{ t: m.L.unit, w: 50, f: (i) => i.unit }] : []), { t: m.L.price, w: 85, a: "r", f: (i) => m.num(i.unitPrice) }, { t: m.L.amount, w: 85, a: "r", f: (i) => m.num(i.amount), bold: true }];
const taxRows = (m) => {
  const z = m.money(0), c = m.p.country, L = m.L;
  if (c === "MX") return [[L.subtotal, m.money(m.subtotal)], ["IVA trasladado 0% (art. 29 LIVA)", z]];
  if (c === "BR") return [[L.subtotal, m.money(m.subtotal)], ["ISS (exportação — não incide)", z], ["PIS/COFINS (exportação)", z]];
  if (c === "PE") return [["Op. exportación", m.money(m.subtotal)], ["Op. gravada", z], ["IGV 18%", z]];
  if (c === "CL") return [["Monto exento", m.money(m.subtotal)], ["IVA (exento — exportación)", z]];
  if (c === "CO") return [[L.subtotal, m.money(m.subtotal)], [m.lang === "en" ? "VAT 0% (exempt export, Art. 481 E.T.)" : "IVA 0% (exento, Art. 481 E.T.)", z], [m.lang === "en" ? "Withholding (n/a)" : "ReteFuente (no aplica)", z]];
  return [[L.subtotal, m.money(m.subtotal)], [L.tax, z]];
};

// ---------- styles ----------
const STYLES = {
  modern(d, m) { // SaaS-billing look (Stripe/QuickBooks/Xero-like)
    const L = m.L; logo(d, M, 40, m, 38);
    d.text(M + 50, 54, m.legal, { font: "HB", size: 12.5 });
    vendorLines(m).forEach((l, i) => d.text(M + 50, 68 + i * 10.5, l, { size: 7.8, color: GRAY }));
    d.text(RIGHT, 56, L.invoice, { font: "HB", size: 22, color: m.p.color, align: "right" });
    kv(d, 350, 84, [[L.invNo, m.inv.number], [L.issue, m.issue], [L.due, m.due], [L.po, m.po], ...(m.cur ? [[L.currency, m.cur]] : [])], { rightAt: RIGHT, size: 9.5, gap: 13.5, labelColor: "#333333" });
    d.text(M, 156, L.billTo, { font: "HB", size: 7.5, color: GRAY }); billTo(m).forEach((l, i) => d.text(M, 169 + i * 10.5, l, { size: 8.5, font: i ? "H" : "HB" }));
    if (m.due) d.text(M, 245, `${m.money(m.total)} ${L.dueOn} ${m.due}`, { font: "HB", size: 14, color: "#111111" });
    let y = table(d, m, 262, STD_COLS(m), { head: "#f3f4f6" });
    y = totals(d, m, y + 18, [...taxRows(m), [L.total, m.money(m.total), true]], { box: "#eef2ff" });
    if (m.words) y = para(d, 300, y + 2, `${L.words}: ${m.words}`, 255, { size: 7, color: GRAY });
    const y2 = payBlock(d, m, M, y + 20, 250);
    notesBlock(d, m, 310, y + 20, 245);
    return y2;
  },
  freelance(d, m) { // Google Docs / Word freelancer template
    const L = m.L; d.text(M, 70, L.invoice, { font: "HB", size: 30, color: m.p.color });
    d.text(RIGHT, 48, m.legal, { font: "HB", size: 12, align: "right" }); d.text(RIGHT, 61, m.p.contact[1], { size: 8.5, color: GRAY, align: "right" });
    vendorLines(m).forEach((l, i) => d.text(RIGHT, 74 + i * 10.5, l, { size: 8, color: GRAY, align: "right" }));
    d.line(M, 128, RIGHT, 128, { color: m.p.color, lw: 1.2 });
    d.text(M, 148, "BILLED TO", { font: "HB", size: 8, color: m.p.color }); billTo(m).forEach((l, i) => d.text(M, 161 + i * 10.5, l, { size: 8.5 }));
    kv(d, 330, 150, [["Invoice No.:", m.inv.number], ["Issue date:", m.issue], ["Due date:", m.due], ["PO:", m.po]], { lw: 70, size: 9, gap: 13 });
    let y = table(d, m, 232, [{ t: "DESCRIPTION", w: 285, desc: true }, { t: "QTY", w: 60, a: "r", f: (i) => m.qtyf(i.qty) }, { t: "RATE", w: 85, a: "r", f: (i) => m.num(i.unitPrice) }, { t: "AMOUNT", w: 85, a: "r", f: (i) => m.num(i.amount) }], { head: "#ffffff", headColor: m.p.color });
    y = totals(d, m, y + 20, [[L.subtotal, m.money(m.subtotal)], ["Tax (0%)", m.money(0)], ["Total", m.money(m.total)], ["Amount paid", m.money(0)], [`Balance due${m.cur ? ` (${m.cur})` : ""}`, m.money(m.total), true]], { box: "#ecfdf5", strong: m.p.color });
    const y2 = payBlock(d, m, M, y + 22, 260);
    notesBlock(d, m, 320, y + 22, 235);
    return y2;
  },
  spreadsheet(d, m) { // Excel/Sheets template exported to PDF: gridlines, Arial-like 10pt, header fill
    const L = m.L, G = "#d0d0d0", colW = [235, 55, 55, 85, 85], X = [M]; colW.forEach((w) => X.push(X.at(-1) + w));
    d.text((M + RIGHT) / 2, 26, `${m.inv.number}.xlsx`, { size: 7, color: "#777777", align: "center" });
    for (let y = 40; y <= 780; y += 16) d.line(M, y, X.at(-1), y, { color: G, lw: 0.3 });
    for (const x of X) d.line(x, 40, x, 780, { color: G, lw: 0.3 });
    const cell = (c, row, s, o = {}) => d.text(o.a === "r" ? X[c + 1] - 3 : X[c] + 3, 40 + row * 16 + 12, s, { size: o.size ?? 10, font: o.font ?? "H", align: o.a === "r" ? "right" : "left", color: o.color ?? "#000000" });
    cell(0, 0, m.legal, { font: "HB", size: 13 }); cell(3, 0, L.invoice, { font: "HB", size: 16, color: "#1f4e78" });
    vendorLines(m).forEach((l, i) => cell(0, 1 + i, l, { size: 9 }));
    const hdr = [L.invNo.replace(/ number$/, " #"), L.issue.replace("Date of issue", "Date"), L.due, L.po];
    d.rect(X[1], 40 + 6 * 16, X[5] - X[1], 16, { fill: "#d9e1f2" });
    hdr.forEach((h, i) => cell(i + 1, 6, h.toUpperCase(), { font: "HB", size: 8.5 }));
    [m.inv.number, m.issue, m.due ?? "", m.po].forEach((v, i) => cell(i + 1, 7, v, { size: 9.5 }));
    cell(0, 6, L.billTo, { font: "HB", size: 9 }); billTo(m).forEach((l, i) => cell(0, 7 + i, l, { size: 9 }));
    const top = 40 + 13 * 16; d.rect(M, top, X[5] - M, 16, { fill: "#1f4e78" });
    [L.desc, L.qty, L.unit, L.price, L.amount].forEach((h, i) => d.text(i === 0 || i === 2 ? X[i] + 3 : X[i + 1] - 3, top + 12, h.toUpperCase(), { font: "HB", size: 9, color: "#ffffff", align: i === 0 || i === 2 ? "left" : "right" }));
    let row = 14;
    for (const it of m.items) { const ls = d.wrap(it.description, colW[0] - 6, "H", 10);
      ls.forEach((l, j) => cell(0, row + j, l)); cell(1, row, m.qtyf(it.qty), { a: "r" }); cell(2, row, it.unit); cell(3, row, m.num(it.unitPrice), { a: "r" }); cell(4, row, m.num(it.amount), { a: "r" }); row += ls.length; }
    row = Math.max(row + 1, 19);
    const tr = [[L.subtotal.toUpperCase(), m.num(m.subtotal)], [m.lang === "en" ? "TAX RATE" : "TASA IVA", "0.00%"], [m.lang === "en" ? "TAX" : "IVA", m.num(0)], [L.total.toUpperCase(), m.money(m.total)]];
    tr.forEach(([k, v], i) => { if (i === 3) d.rect(X[3], 40 + (row + i) * 16, X[5] - X[3], 16, { fill: "#fff2cc" }); cell(3, row + i, k, { font: i === 3 ? "HB" : "H", size: 9 }); cell(4, row + i, v, { a: "r", font: i === 3 ? "HB" : "H" }); });
    if (m.cur) cell(0, row, `${L.currency}: ${m.cur}`, { size: 9 });
    cell(0, row + 5, L.pay.toUpperCase(), { font: "HB", size: 9 });
    [`${L.bank}: ${m.p.bank}`, `${L.holder}: ${m.holder}`, `${L.acct}: ${m.inv.acct}`, `${L.swift}: ${m.p.swift}`].forEach((l, i) => cell(0, row + 6 + i, l, { size: 9 }));
    if (m.inv.injection) cell(0, row + 11, m.inv.injection.slice(0, 95), { size: 8.5 });
    if (m.inv.tags?.includes("trap:account-changed")) cell(0, row + 12, m.lang === "en" ? "NOTE: new bank account — please update your records." : "NOTA: nueva cuenta bancaria — actualice sus registros.", { font: "HB", size: 9 });
    cell(0, row + 13, `${L.terms}: ${m.lang === "en" ? `Net ${m.termDays}` : `${m.termDays} días`}. ${L.thanks}`, { size: 9 });
    return 0;
  },
  dian(d, m) { // Colombia: representación gráfica de factura electrónica de venta
    const L = m.L; d.rect(M, 36, RIGHT - M, 92, { stroke: "#9ca3af" }); logo(d, M + 10, 46, m, 40);
    d.text(M + 60, 58, m.legal, { font: "HB", size: 12 });
    [`NIT ${m.p.taxId} (ficticio)`, m.p.regime ?? "Responsable de IVA", m.p.addr.join(", "), `${billingEmail(m)} · ${m.p.phone}`].forEach((l, i) => d.text(M + 60, 72 + i * 10, l, { size: 7.3, color: "#333333" }));
    d.rect(392, 36, RIGHT - 392, 92, { fill: "#f1f5f9", stroke: "#9ca3af" });
    d.text(473.6, 56, "FACTURA ELECTRÓNICA DE VENTA", { font: "HB", size: 8.5, align: "center" }); d.text(473.6, 76, `No. ${m.inv.number}`, { font: "HB", size: 14, color: m.p.color, align: "center" });
    ["Resolución DIAN No. 00000000000001 (ficticia)", `Prefijo ${m.inv.number.split("-")[0]} · Rango 1000 al 9999`, "Vigencia: 12 meses desde 2026-01-15"].forEach((l, i) => d.text(473.6, 92 + i * 9, l, { size: 6.3, color: GRAY, align: "center" }));
    d.text(M, 146, "ADQUIRIENTE", { font: "HB", size: 8, color: m.p.color });
    kv(d, M, 160, [["Razón social:", NORTHWIND.name], ["Identificación:", `${NORTHWIND.taxLabel} ${NORTHWIND.taxId} (extranjero)`], ["Dirección:", NORTHWIND.addr.join(", ")], ["Correo:", NORTHWIND.email]], { lw: 62, size: 7.8, gap: 11, valueFont: "H" });
    kv(d, 330, 160, [[`${L.issue}:`, `${m.issue} 09:41`], [`${L.due}:`, m.due], ["Forma de pago:", `Crédito ${m.termDays} días`], ["Medio de pago:", "Transferencia internacional"], [`${L.po}:`, m.po], ...(m.cur ? [[`${L.currency}:`, m.cur]] : [])], { lw: 92, size: 7.8, gap: 11, valueFont: "H" });
    let y = table(d, m, 236, STD_COLS(m, { idx: true }), { grid: true, head: "#e2e8f0", size: 8 });
    y = totals(d, m, y + 16, [...taxRows(m), [L.total, m.money(m.total), true]], { x: 300, size: 8.3, gap: 13, box: "#e2e8f0" });
    if (m.words) y = para(d, M, y + 4, `${L.words}: ${m.words}`, 515, { size: 7.5, font: "HB" });
    const y2 = payBlock(d, m, M, y + 14, 300, { size: 7.6 });
    notesBlock(d, m, M, y2 + 8, 400);
    fakeQr(d, RIGHT - 70, 700, m.cufe, 66);
    d.text(M, 716, "CUFE:", { font: "HB", size: 6.5 }); d.text(M + 24, 716, m.cufe.slice(0, 64), { font: "C", size: 6 }); d.text(M + 24, 724, m.cufe.slice(64), { font: "C", size: 6 });
    d.text(M, 738, "Representación gráfica de la factura electrónica de venta (documento sintético, sin validez fiscal).", { size: 6.5, color: GRAY });
    d.text(M, 747, "Proveedor tecnológico: Facturador Ficticio S.A.S. · Software propio v2.3", { size: 6.5, color: GRAY });
    return y2;
  },
  cfdi(d, m) { // Mexico: representación impresa de un CFDI 4.0
    const L = m.L, es = (s, e) => (m.lang === "en" ? e : s); logo(d, M, 40, m, 40);
    d.text(M + 52, 52, m.legal, { font: "HB", size: 12 });
    [`RFC: ${m.p.taxId} (ficticio)`, `Régimen fiscal: ${m.p.regime}`, m.p.addr.join(", "), `Lugar de expedición (C.P.): ${(m.p.addr[1].match(/\d{5}/) ?? ["00000"])[0]}`].forEach((l, i) => d.text(M + 52, 65 + i * 10, l, { size: 7.3, color: "#333333" }));
    d.rect(400, 38, RIGHT - 400, 80, { stroke: m.p.color, lw: 1 });
    d.text(477.6, 54, "FACTURA", { font: "HB", size: 13, color: m.p.color, align: "center" });
    kv(d, 406, 68, [["Folio:", m.inv.number], ["CFDI:", "4.0 · Tipo I — Ingreso"], ["Exportación:", "01 No aplica"]], { lw: 50, size: 7.3, gap: 10, valueFont: "H" });
    d.text(406, 106, "Folio fiscal (UUID):", { size: 6.3, color: GRAY }); d.text(406, 114, m.uuid, { font: "C", size: 4.9 });
    d.rect(M, 128, RIGHT - M, 14, { fill: m.p.color }); d.text(M + 6, 138, es("RECEPTOR", "RECEPTOR / CUSTOMER"), { font: "HB", size: 8, color: "#ffffff" });
    kv(d, M, 155, [["Receptor:", NORTHWIND.name], ["RFC receptor:", NORTHWIND.rfcForeign], ["Residencia fiscal:", "USA"], ["Núm. reg. id. trib.:", NORTHWIND.taxId.split(" ")[0]], ["Régimen fiscal receptor:", "616 Sin obligaciones fiscales"], ["Uso CFDI:", "S01 Sin efectos fiscales"]], { lw: 98, size: 7.6, gap: 10.5, valueFont: "H" });
    kv(d, 330, 155, [["Fecha de emisión:", `${m.issueIso}T10:22:31`], ["Fecha de vencimiento:", m.due], ["Método de pago:", "PPD Pago en parcialidades o diferido"], ["Forma de pago:", "99 Por definir"], ...(m.cur ? [["Moneda:", m.cur]] : []), ["Orden de compra:", m.po]], { lw: 88, size: 7.6, gap: 10.5, valueFont: "H" });
    m.subline = () => "Objeto imp.: 02 Sí objeto de impuesto · Traslado: 002 IVA · Tipo factor: Tasa · Tasa o cuota: 0.000000 · Importe: 0.00";
    let y = table(d, m, 226, [{ t: "Clave prod./serv.", w: 62, f: () => (m.hourly ? "80111600" : "81112100") }, { t: "Cant.", w: 32, a: "r", f: (i) => m.qtyf(i.qty) }, { t: "Clave unidad", w: 50, f: () => (m.hourly ? "HUR" : "E48") }, { t: "Descripción", w: 211, desc: true }, { t: "Valor unitario", w: 80, a: "r", f: (i) => m.num(i.unitPrice) }, { t: "Importe", w: 80, a: "r", f: (i) => m.num(i.amount), bold: true }], { grid: true, head: "#f5f3ff", size: 7.6, rowH: 14 });
    m.subline = null;
    y = totals(d, m, y + 16, [...taxRows(m), ["Total", m.money(m.total), true]], { x: 300, size: 8.3, gap: 13, box: "#f5f3ff" });
    if (m.words) y = para(d, M, y + 2, `Importe con letra: ${m.words}`, 515, { size: 7.5, font: "HB" });
    const y2 = payBlock(d, m, M, y + 12, 300, { size: 7.6 });
    notesBlock(d, m, 330, y + 12, 225);
    let sy = Math.max(y2, 640) + 12;
    for (const [k, v] of [["Sello digital del CFDI:", m.sello], ["Sello digital del SAT:", m.selloSat]]) { d.text(M, sy, k, { font: "HB", size: 6.3 }); sy += 7.5; for (let i = 0; i < 2; i++) { d.text(M, sy, v.slice(i * 118, (i + 1) * 118), { font: "C", size: 5.2 }); sy += 6.5; } sy += 2; }
    d.text(M, sy, `Cadena original del complemento de certificación digital del SAT: ||1.1|${m.uuid}|${m.issueIso}T10:22:58|PAC000000FK0 (ficticio)|${m.sello.slice(0, 40)}||`, { size: 5.4, color: GRAY }); sy += 8;
    d.text(M, sy, "No. de serie del CSD del emisor: 00001000000700000000 · No. de serie del certificado del SAT: 00001000000700000001", { size: 6, color: GRAY }); sy += 8;
    d.text(M, sy, "Este documento es una representación impresa de un CFDI (documento sintético, sin validez fiscal).", { size: 6.5, font: "HB", color: GRAY });
    fakeQr(d, RIGHT - 60, sy - 64, m.uuid, 58);
    return y2;
  },
  nfse(d, m) { // Brazil: DANFSe-like NFS-e printout
    const C = m.p.color, box = (y, h, title) => { d.rect(M, y, RIGHT - M, h, { stroke: "#6b7280" }); if (title) { d.rect(M, y, RIGHT - M, 12, { fill: "#e5e7eb" }); d.text((M + RIGHT) / 2, y + 9, title, { font: "HB", size: 7.5, align: "center" }); } };
    box(36, 62); logo(d, M + 8, 46, m, 40);
    d.text(M + 58, 56, "NFS-e — NOTA FISCAL DE SERVIÇOS ELETRÔNICA", { font: "HB", size: 11, color: C });
    d.text(M + 58, 69, `Município de ${m.p.city ?? "São Paulo"} · representação sintética (sem validade fiscal)`, { size: 7, color: GRAY });
    kv(d, 395, 52, [["Número da nota:", m.inv.number], ["Data e hora de emissão:", `${m.issue} 10:15:02`], ["Código de verificação:", m.verif]], { lw: 86, size: 7.3, gap: 11 });
    box(104, 64, "PRESTADOR DE SERVIÇOS");
    kv(d, M + 8, 128, [["Nome/Razão Social:", m.legal], ["CNPJ:", `${m.p.taxId} (fictício) · Inscrição municipal: ${m.p.im ?? "0.000.000-0"}`], ["Endereço:", m.p.addr.join(", ")], ["E-mail:", `${billingEmail(m)} · Telefone: ${m.p.phone}`]], { lw: 78, size: 7.5, gap: 10, valueFont: "H" });
    box(174, 54, "TOMADOR DE SERVIÇOS");
    kv(d, M + 8, 198, [["Nome/Razão Social:", NORTHWIND.name], ["NIF (exterior):", `${NORTHWIND.taxId} · País: Estados Unidos`], ["Endereço:", NORTHWIND.addr.join(", ")]], { lw: 78, size: 7.5, gap: 10, valueFont: "H" });
    box(234, 30, "DISCRIMINAÇÃO DOS SERVIÇOS");
    d.text(M + 8, 257, `${m.inv.lines.split(/\s\+\s/)[0].replace(/:.*$/, "")} — competência ${m.issueIso.slice(5, 7)}/${m.issueIso.slice(0, 4)}. ${m.L.po}: ${m.po}.${m.cur ? ` Moeda: ${m.cur}.` : ""}`, { size: 7.5 });
    let y = table(d, m, 270, STD_COLS(m), { grid: true, head: "#f3f4f6", size: 8 });
    d.text(M + 8, y + 14, `Vencimento: ${m.due ?? "à vista"}`, { size: 8, font: "HB" });
    d.rect(M, y + 22, RIGHT - M, 18, { fill: "#f3f4f6", stroke: "#6b7280" });
    d.text(M + 8, y + 35, `VALOR TOTAL DA NOTA = ${m.money(m.total)}`, { font: "HB", size: 10.5 });
    y += 52; box(y, 40, "TRIBUTAÇÃO MUNICIPAL (ISSQN) — OPERAÇÃO NÃO SUJEITA AO ISSQN");
    const cells = [["Valor dos serviços", m.money(m.subtotal)], ["Deduções", m.money(0)], ["Base de cálculo", m.money(0)], ["Valor do ISS", m.money(0)], ["ISS retido", "Não"]];
    cells.forEach(([k, v], i) => { const x = M + 6 + i * 103; d.text(x, y + 24, k, { size: 6.5, color: GRAY }); d.text(x, y + 34, v, { size: 8, font: "HB" }); });
    y += 48; d.text(M, y, "Exportação de serviços: ISS não incide (LC 116/2003, art. 2º, I); PIS/COFINS não incidem (ingresso de divisas).", { size: 7, color: GRAY });
    y = totals(d, m, y + 16, [["Retenções federais", m.money(0)], ["Valor líquido da nota", m.money(m.total), true]], { x: 330, size: 8.5 });
    if (m.words) y = para(d, M, y + 2, `${m.L.words}: ${m.words}`, 515, { size: 7.5 });
    box(y + 6, 80, "OUTRAS INFORMAÇÕES");
    const y2 = payBlock(d, m, M + 8, y + 30, 300, { title: false, size: 7.6 });
    notesBlock(d, m, M + 8, y + 104, 500);
    return y2;
  },
  sunat(d, m) { // Peru: representación impresa de factura electrónica
    const L = m.L; logo(d, M, 40, m, 40);
    d.text(M + 52, 54, m.legal, { font: "HB", size: 12.5 });
    [m.p.addr.join(", "), `${billingEmail(m)} · ${m.p.phone}`].forEach((l, i) => d.text(M + 52, 68 + i * 10, l, { size: 7.5, color: "#333333" }));
    d.rect(380, 36, RIGHT - 380, 72, { stroke: m.p.color, lw: 1.4 });
    d.text(467.6, 54, `R.U.C. N° ${m.p.taxId} (ficticio)`, { font: "HB", size: 9, align: "center" });
    d.rect(380, 62, RIGHT - 380, 18, { fill: m.p.color }); d.text(467.6, 75, "FACTURA ELECTRÓNICA", { font: "HB", size: 10.5, color: "#ffffff", align: "center" });
    d.text(467.6, 98, m.inv.number, { font: "HB", size: 13, align: "center" });
    kv(d, M, 130, [["Señor(es):", NORTHWIND.name], ["Doc. identidad:", "— (no domiciliado)"], ["Dirección:", NORTHWIND.addr.join(", ")], ["Tipo de operación:", "0201 Exportación de servicios"]], { lw: 80, size: 7.8, gap: 11, valueFont: "H" });
    kv(d, 340, 130, [[`${L.issue}:`, m.issue], [`${L.due}:`, m.due], ...(m.cur ? [[`${L.currency}:`, m.cur]] : []), ["Forma de pago:", `Crédito — ${m.termDays} días`], [`${L.po}:`, m.po]], { lw: 92, size: 7.8, gap: 11, valueFont: "H" });
    let y = table(d, m, 196, [{ t: "Cant.", w: 40, a: "r", f: (i) => m.qtyf(i.qty) }, { t: "Unidad", w: 50, f: (i) => i.unit }, { t: "Descripción", w: 255, desc: true }, { t: "Valor unitario", w: 85, a: "r", f: (i) => m.num(i.unitPrice) }, { t: "Importe", w: 85, a: "r", f: (i) => m.num(i.amount), bold: true }], { grid: true, head: "#fde8e8", size: 8 });
    y = totals(d, m, y + 16, [...taxRows(m), ["Importe total", m.money(m.total), true]], { x: 330, size: 8.5, box: "#fde8e8" });
    if (m.words) y = para(d, M, y + 2, `${L.words}: ${m.words}`, 515, { size: 7.5, font: "HB" });
    const y2 = payBlock(d, m, M, y + 14, 300, { size: 7.6 });
    notesBlock(d, m, 330, y + 14, 225);
    d.text(M, 760, "Representación impresa de la FACTURA ELECTRÓNICA (documento sintético). Autorizado mediante resolución ficticia.", { size: 6.5, color: GRAY });
    d.text(M, 769, `Resumen (hash): ${m.cufe.slice(0, 28)}`, { size: 6.5, font: "C", color: GRAY });
    return y2;
  },
  sii(d, m) { // Chile: factura de exportación electrónica (DTE 110) printout
    const L = m.L, red = "#c81e1e"; logo(d, M, 40, m, 40);
    d.text(M + 52, 54, m.legal, { font: "HB", size: 12.5 });
    [`Giro: ${m.p.giro ?? "Servicios"}`, m.p.addr.join(", "), `${billingEmail(m)} · ${m.p.phone}`].forEach((l, i) => d.text(M + 52, 68 + i * 10, l, { size: 7.5, color: "#333333" }));
    d.rect(372, 36, RIGHT - 372, 82, { stroke: red, lw: 1.8 });
    [[`R.U.T.: ${m.p.taxId} (ficticio)`, 56, 9.5], ["FACTURA DE EXPORTACIÓN", 72, 9.5], ["ELECTRÓNICA", 84, 9.5], [`N° ${m.inv.number}`, 102, 12]].forEach(([s, y, z]) => d.text(463.6, y, s, { font: "HB", size: z, color: red, align: "center" }));
    d.text(463.6, 130, "S.I.I. — VALPARAÍSO (ficticio)", { font: "HB", size: 7.5, color: red, align: "center" });
    kv(d, M, 146, [["Señor(es):", NORTHWIND.name], ["País receptor:", "Estados Unidos"], ["Dirección:", NORTHWIND.addr.join(", ")], ["Modalidad de venta:", "A firme · Servicios"]], { lw: 86, size: 7.8, gap: 11, valueFont: "H" });
    kv(d, 340, 146, [["Fecha emisión:", m.issue], ["Fecha vencimiento:", m.due], ...(m.cur ? [["Moneda:", m.cur]] : []), ["Forma de pago:", "Cobranza / transferencia"], ["Orden de compra:", m.po]], { lw: 88, size: 7.8, gap: 11, valueFont: "H" });
    let y = table(d, m, 206, [{ t: "Código", w: 45, f: (_, i) => `SV-${String(i + 1).padStart(3, "0")}` }, { t: "Descripción", w: 250, desc: true }, { t: "Cant.", w: 40, a: "r", f: (i) => m.qtyf(i.qty) }, { t: "Unidad", w: 40, f: (i) => i.unit }, { t: "Precio unit.", w: 70, a: "r", f: (i) => m.num(i.unitPrice) }, { t: "Valor", w: 70, a: "r", f: (i) => m.num(i.amount), bold: true }], { grid: true, head: "#fee2e2", size: 8 });
    y = totals(d, m, y + 16, [...taxRows(m), ["Total", m.money(m.total), true]], { x: 330, size: 8.5, box: "#fee2e2" });
    if (m.words) y = para(d, M, y + 2, `${L.words}: ${m.words}`, 515, { size: 7.5, font: "HB" });
    const y2 = payBlock(d, m, M, y + 14, 300, { size: 7.6 });
    notesBlock(d, m, 330, y + 14, 225);
    barcode(d, M, 700, 200, 48, m.cufe); d.text(M, 760, "Timbre Electrónico SII · Res. Ex. N° 00 de 2026 (ficticia) · Documento sintético", { size: 6.5, color: GRAY });
    return y2;
  },
};
function annex(d, m) {
  const L = m.L, it = m.items[0], r = rng(hash(m.inv.number + "ts"));
  d.text(M, 56, `${L.annex} · ${m.inv.number}`, { font: "HB", size: 13 });
  d.text(M, 70, `${m.legal} → ${NORTHWIND.name}`, { size: 8.5, color: GRAY });
  if (!m.hourly) { let y = 96; d.text(M, y, L.tcTitle, { font: "HB", size: 11 }); y += 16; for (const t of L.tc) y = para(d, M, y, t, 515, { size: 8.5 }) + 4; return; }
  const total = it.qty, rows = []; let left = total, day = 1;
  while (left > 0) { const dt = new Date(Date.UTC(2026, 9, day)); day++; if ([0, 6].includes(dt.getUTCDay())) continue; const h = Math.min(left, pick(r, [4, 6, 8, 8])); rows.push([dt.toISOString().slice(0, 10), pick(r, ACT[m.lang]), h]); left -= h; if (day > 31) day = 1; }
  let y = 92; d.rect(M, y, 515, 15, { fill: "#f3f4f6" });
  [[L.date, M + 4], [L.activity, M + 110], [L.hours, RIGHT - 4]].forEach(([s, x], i) => d.text(x, y + 11, s, { font: "HB", size: 8.5, align: i === 2 ? "right" : "left" }));
  y += 15;
  for (const [dt, a, h] of rows) { d.text(M + 4, y + 11, fmtDate(dt, m.lang, 1), { size: 8.5 }); d.text(M + 110, y + 11, a, { size: 8.5 }); d.text(RIGHT - 4, y + 11, String(h), { size: 8.5, align: "right" }); d.line(M, y + 15, RIGHT, y + 15, { color: LIGHT }); y += 15; }
  d.text(M + 110, y + 14, L.totalHours, { font: "HB", size: 9 }); d.text(RIGHT - 4, y + 14, String(total), { font: "HB", size: 9, align: "right" });
}

/** Render an invoice (fact object from the generator) as a realistic PDF. opts: {style, pages}. */
export function invoicePdf(inv, opts = {}) {
  const m = invoiceModel(inv, opts), d = pdfDoc(), render = STYLES[m.style] ?? STYLES.modern;
  d.page(); render(d, m);
  if (m.style !== "spreadsheet") footer(d, m, 1, m.pages); else d.text((M + RIGHT) / 2, 800, `Sheet1 · ${m.L.page(1, m.pages)}`, { size: 7, color: "#777777", align: "center" });
  if (m.pages > 1) { d.page(); annex(d, m); footer(d, m, 2, m.pages); }
  return d.build({ title: `${m.L.invoice} ${inv.number} - ${inv.payeeName}`, creator: m.style === "spreadsheet" ? "Spreadsheet export (synthetic)" : `${inv.payeeName} billing (synthetic)` });
}
export const STYLE_NAMES = Object.keys(STYLES);
export { textWidth };
