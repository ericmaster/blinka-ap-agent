// FICTIONAL data only. Company, vendors, agreements, accounts and history are invented.
export const COMPANY = {
  name: "Northwind Ridge Inc.", country: "US",
  debtorAccount: "US00FAKE0000000001", debtorAgent: "FAKEUS33XXX",
};
// Vendor registry lives in config/rules.json ("vendors") and is editable at runtime (Vendors tab). These are the defaults.
import rules from "../../config/rules.json" with { type: "json" };
export const VENDORS = rules.vendors;
// Already paid in September (for duplicate questions).
export const HISTORY = [
  { vendor: "pixel-norte", number: "PN-0925", date: "2026-09-30", period: "2026-09", amount: 28000, currency: "MXN", lines: "Diseño UI septiembre 2026, tarifa fija" },
  { vendor: "sampa-cloud", number: "SC-2026-09", date: "2026-09-01", period: "2026-09", amount: 2400, currency: "BRL", lines: "Hospedagem setembro 2026" },
  { vendor: "maria-qa", number: "MFR-09", date: "2026-09-30", period: "2026-09", amount: 1600, currency: "USD", lines: "QA services September 2026" },
];
