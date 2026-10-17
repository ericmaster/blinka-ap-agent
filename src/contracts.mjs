// Fictional vendor contracts generated from the registry, so the document always matches the hard rules in force.
import { textPdf } from "./gen/pdf.mjs";
const price = (v) => (v.terms?.type === "flat" ? `${v.currency} ${Number(v.terms.amount).toLocaleString("en-US")} flat fee per calendar month` : `${v.currency} ${Number(v.terms?.rate).toLocaleString("en-US")} per hour, capped at ${v.terms?.max_units_per_period} hours per calendar month`);
export function contractLines(key, v, company) {
  return [
    `SERVICES AGREEMENT  (FICTIONAL - DEMO ONLY)`, `Contract ID: NWR-${key.toUpperCase()}-2026`, ``,
    `Client: ${company.name} (fictional, Delaware, USA)`, `Vendor: ${v.name} (${v.country})`, ``,
    `1. Services. Vendor provides: ${v.category}.`, `   Invoice line items must describe these services (keywords: ${(v.keywords ?? []).join(", ")}).`,
    `2. Price. ${price(v)}. Invoices in ${v.currency}.`, `3. No other charges (expenses, hardware, extras) without prior written approval.`,
    `4. Payment. To the registered account ${v.acct} only. Account changes require a signed change form.`,
    `5. Invoices. One invoice per period; resubmissions must reference the original number.`, ``,
    `Effective: 2026-01-01. Term: 12 months.`, `Signed (fictional): ${company.name} / ${v.name}`,
  ];
}
export const contractMarkdown = (k, v, c) => `# ${contractLines(k, v, c)[0]}\n\n` + contractLines(k, v, c).slice(1).join("\n") + "\n";
export const contractPdf = (k, v, c) => textPdf(contractLines(k, v, c));
export function contractHtml(k, v, c) {
  const esc = (s) => String(s).replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[x]);
  return `<!doctype html><meta charset="utf-8"><title>Contract · ${esc(v.name)}</title><style>body{font:15px/1.6 Inter,system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1c253a;background:#f7f7f4}pre{white-space:pre-wrap;font:inherit;background:#fdfdfd;border:1px solid #dedfdc;border-radius:16px;padding:24px}a{color:#2a4bd0}</style>
<pre>${esc(contractLines(k, v, c).join("\n"))}</pre><p><a href="/api/vendors/${k}/contract.pdf">Download PDF</a> · <a href="/api/vendors/${k}/contract.md">Markdown</a></p>`;
}
