// FICTIONAL data only. Company, vendors, agreements, accounts and history are invented.
export const COMPANY = {
  name: "Northwind Ridge Inc.", country: "US",
  debtorAccount: "US00FAKE0000000001", debtorAgent: "FAKEUS33XXX",
};
// key = canonical id; aliases are accepted spellings (normalized compare).
export const VENDORS = {
  "andes-dev": { name: "Andes Dev Studio SAS", aliases: ["Andes Dev Studio"], country: "CO", currency: "COP", lang: "es",
    acct: "CO-FAKE-1001", agreement: "Desarrollo de software: COP 180.000 por hora, máximo 60 horas al mes. Sin cargos adicionales." },
  "pixel-norte": { name: "Pixel Norte S.A. de C.V.", aliases: ["Pixel Norte"], country: "MX", currency: "MXN", lang: "es",
    acct: "MX-FAKE-2002", agreement: "Diseño UI: tarifa fija MXN 28,000.00 por mes." },
  "sampa-cloud": { name: "Sampa Cloud Serviços Ltda", aliases: ["Sampa Cloud"], country: "BR", currency: "BRL", lang: "pt",
    acct: "BR-FAKE-3003", agreement: "Hospedagem em nuvem: BRL 2.400,00 por mês, plano fixo. Sem taxas extras." },
  "lima-support": { name: "Lima Support Desk SAC", aliases: ["Lima Support Desk"], country: "PE", currency: "PEN", lang: "es",
    acct: "PE-FAKE-4004", agreement: "Soporte al cliente nivel 1: PEN 45.00 por hora, hasta 120 horas al mes." },
  "maria-qa": { name: "Maria Fernanda Rojas (contractor)", aliases: ["Maria Fernanda Rojas"], country: "CO", currency: "USD", lang: "en",
    acct: "CO-FAKE-5005", agreement: "QA contractor: USD 1,600.00 flat per month." },
  "rio-legal": { name: "Rio Legal Consultoria Ltda", aliases: ["Rio Legal Consultoria"], country: "BR", currency: "BRL", lang: "pt",
    acct: "BR-FAKE-6006", agreement: "Consultoria jurídica: BRL 650,00 por hora. Despesas só com aprovação prévia por escrito." },
  "valpo-data": { name: "Valpo Data SpA", aliases: ["Valpo Data"], country: "CL", currency: "CLP", lang: "es",
    acct: "CL-FAKE-7007", agreement: "Licencia analítica: CLP 950.000 por mes." },
  "monterrey-ops": { name: "Monterrey Ops Partners S.C.", aliases: ["Monterrey Ops Partners"], country: "MX", currency: "MXN", lang: "en",
    acct: "MX-FAKE-8008", agreement: "Bookkeeping services: MXN 520.00 per hour, up to 40 hours per month." },
};
// Already paid in September (for duplicate questions).
export const HISTORY = [
  { vendor: "pixel-norte", number: "PN-0925", date: "2026-09-30", amount: 28000, currency: "MXN", lines: "Diseño UI septiembre 2026, tarifa fija" },
  { vendor: "sampa-cloud", number: "SC-2026-09", date: "2026-09-01", amount: 2400, currency: "BRL", lines: "Hospedagem setembro 2026" },
  { vendor: "maria-qa", number: "MFR-09", date: "2026-09-30", amount: 1600, currency: "USD", lines: "QA services September 2026" },
];
