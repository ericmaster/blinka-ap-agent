// FICTIONAL vendor letterheads for generated invoices: legal names match the registry; tax ids, addresses, phones and banks are invented
// (zero-padded ids marked "ficticio", .example domains, XX-FAKE accounts). Unknown payees get a profile derived from their name.
export const NORTHWIND = { name: "Northwind Ridge Inc.", taxLabel: "EIN", taxId: "00-0000001 (fictitious)", addr: ["400 Example Ave, Suite 12", "Wilmington, DE 19899, USA"],
  email: "ap@northwind-ridge.example", contact: "Accounts Payable", rfcForeign: "XEXX010101000", po: "NWR-PO-" };
export const PROFILES = {
  "andes-dev": { country: "CO", taxLabel: "NIT", taxId: "000.000.101-1", addr: ["Cra. 11 # 00-01, Of. 501", "Bogotá D.C., Colombia"], domain: "andesdevstudio.example", phone: "+57 601 000 0101",
    bank: "Banco Ficticio de Colombia", acctType: "Cuenta corriente", swift: "FAKECOB1XXX", contact: ["Laura Méndez", "Facturación y cartera"], style: "dian", color: "#1f6f5c", regime: "Responsable de IVA · No es gran contribuyente · No autorretenedor" },
  "pixel-norte": { country: "MX", taxLabel: "RFC", taxId: "PNO000000FK1", addr: ["Av. Ficticia 245, Col. Americana", "44160 Guadalajara, Jal., México"], domain: "pixelnorte.example", phone: "+52 33 0000 0202",
    bank: "Banco Ficticio del Norte", acctType: "Cuenta CLABE", swift: "FAKEMXM1XXX", contact: ["Diego Salinas", "Cobranza"], style: "cfdi", color: "#6d28d9", regime: "601 General de Ley Personas Morales" },
  "sampa-cloud": { country: "BR", taxLabel: "CNPJ", taxId: "00.000.003/0001-03", addr: ["Rua Exemplo, 300 — 4º andar, Vila Olímpia", "04551-000 São Paulo — SP, Brasil"], domain: "sampacloud.example", phone: "+55 11 0000-0303",
    bank: "Banco Fictício S.A.", acctType: "Conta corrente", swift: "FAKEBRS1XXX", contact: ["Juliana Prado", "Financeiro"], style: "nfse", color: "#0b5cad", im: "0.000.303-0", city: "São Paulo" },
  "lima-support": { country: "PE", taxLabel: "RUC", taxId: "00000000404", addr: ["Av. Ejemplo 404, Of. 12, Miraflores", "Lima 15074, Perú"], domain: "limasupportdesk.example", phone: "+51 1 000 0404",
    bank: "Banco Ficticio del Perú", acctType: "Cuenta corriente", swift: "FAKEPEP1XXX", contact: ["Rosa Quispe", "Administración"], style: "sunat", color: "#b42318" },
  "maria-qa": { country: "CO", taxLabel: "Tax ID (NIT)", taxId: "000.005.005-5", addr: ["Calle 00 # 05-05, Apto 505", "Medellín, Colombia"], domain: "mfrojas-qa.example", phone: "+57 300 000 0505",
    bank: "Banco Ficticio de Colombia", acctType: "USD savings account", swift: "FAKECOB1XXX", contact: ["Maria Fernanda Rojas", "QA Engineer (independent contractor)"], style: "freelance", color: "#0f766e", person: true },
  "rio-legal": { country: "BR", taxLabel: "CNPJ", taxId: "00.000.006/0001-06", addr: ["Av. Fictícia, 606 — sala 1201, Centro", "20040-000 Rio de Janeiro — RJ, Brasil"], domain: "riolegal.example", phone: "+55 21 0000-0606",
    bank: "Banco Fictício S.A.", acctType: "Conta corrente", swift: "FAKEBRS1XXX", contact: ["Dr. Ricardo Alves", "Sócio"], style: "nfse", color: "#7c2d12", im: "0.000.606-0", city: "Rio de Janeiro" },
  "valpo-data": { country: "CL", taxLabel: "RUT", taxId: "00.000.707-K", addr: ["Av. Ejemplo 707, Of. 3", "Valparaíso, Chile"], domain: "valpodata.example", phone: "+56 32 000 0707",
    bank: "Banco Ficticio de Chile", acctType: "Cuenta corriente", swift: "FAKECLR1XXX", contact: ["Tomás Fuentes", "Administración y finanzas"], style: "sii", color: "#c2410c", giro: "Servicios de análisis de datos y licenciamiento de software" },
  "monterrey-ops": { country: "MX", taxLabel: "RFC", taxId: "MOP000000FK8", addr: ["Calle Ejemplo 808, Col. Del Valle", "66220 San Pedro Garza García, N.L., México"], domain: "monterreyops.example", phone: "+52 81 0000 0808",
    bank: "Banco Ficticio del Norte", acctType: "Checking (MXN)", swift: "FAKEMXM1XXX", contact: ["Andrea Garza", "Billing"], style: "spreadsheet", color: "#217346", regime: "601 General de Ley Personas Morales" },
};
const COUNTRY_BY_CUR = { COP: "CO", MXN: "MX", BRL: "BR", PEN: "PE", CLP: "CL", USD: "CO" };
const TAX = { CO: "NIT", MX: "RFC", BR: "CNPJ", PE: "RUC", CL: "RUT", EC: "RUC", PY: "RUC" };
/** Profile for any payee (registry vendor, lookalike or unknown). Deterministic. */
export function profileFor(inv) {
  const p = inv.vendorKey && PROFILES[inv.vendorKey];
  if (p && !inv.profileOverride) return p;
  const h = [...inv.payeeName].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), n = String(h % 900 + 100);
  const country = /Quito/.test(inv.payeeName) ? "EC" : /Asunci/.test(inv.payeeName) ? "PY" : /Recife/.test(inv.payeeName) ? "BR" : COUNTRY_BY_CUR[inv.currency] ?? "CO";
  const base = /Andes Dev/.test(inv.payeeName) ? PROFILES["andes-dev"] : null; // lookalikes copy the real letterhead, with their own tax id
  return { ...(base ?? { addr: ["Calle Ficticia 000, Of. " + n.slice(0, 2), { CO: "Bogotá D.C., Colombia", EC: "Quito, Ecuador", PY: "Asunción, Paraguay", BR: "Recife — PE, Brasil", MX: "Ciudad de México, México", PE: "Lima, Perú", CL: "Santiago, Chile" }[country]],
    phone: "+00 000 000 " + n, bank: "Banco Ficticio", acctType: "Cuenta corriente", swift: "FAKEXXX1XXX", contact: ["Equipo de facturación", ""], color: "#334155", style: "modern" }),
    country, taxLabel: TAX[country] ?? "Tax ID", taxId: base ? "000.000.909-" + (h % 9) : (country === "BR" ? `00.000.${n}/0001-00` : `000.000.${n}-${h % 9}`),
    domain: inv.payeeName.toLowerCase().normalize("NFD").replace(/[^a-z]+/g, "").slice(0, 16) + ".example", style: base ? "dian" : "modern" };
}
