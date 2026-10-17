// Outbound notifications behind one interface. Real email is NOT built yet (needs Eric's decision on provider and
// sender domain). Today every notification is recorded as "simulated" on the entry and nothing leaves the system.
// A real transport (e.g. Cloudflare Email Service `send_email` binding, see docs/RUNBOOK-PRODUCTION.md) plugs in here
// behind EMAIL_ENABLED=1 without touching the rules engine.
/** @typedef {{ kind: "approval_request" | "vendor_verification", to: string, subject: string, text: string, entryId: string }} Notice */

/** Transport interface: send(notice) -> { status: "sent" | "simulated" | "failed", id?, error? } */
export const simulatedTransport = { name: "simulated", async send() { return { status: "simulated" }; } };

export function createNotifier(env = {}, transport = simulatedTransport) {
  const t = env.EMAIL_ENABLED === "1" ? transport : simulatedTransport;
  return {
    transport: t.name,
    /** Who to tell for a decision. Vendor verification goes to the contact on file, never to the invoice sender. */
    noticesFor(e, vendor) {
      const out = [];
      if (e.action === "escalate") out.push({ kind: "approval_request", to: "approvers", subject: `Approve or reject ${e.id}`, text: e.reason, entryId: e.id });
      if (e.action === "hold" && /Bank account .* does not match/.test(e.reason ?? "") && vendor)
        out.push({ kind: "vendor_verification", to: `contact on file for ${vendor.name}`, subject: `Please confirm your bank details (${e.id})`, text: "We received an invoice with a bank account that differs from the one on file.", entryId: e.id });
      return out;
    },
    async notify(e, vendor) {
      const sent = [];
      for (const n of this.noticesFor(e, vendor)) { let r; try { r = await t.send(n); } catch (err) { r = { status: "failed", error: String(err.message) }; } sent.push({ kind: n.kind, to: n.to, ...r, at: new Date().toISOString() }); }
      return sent;
    },
  };
}
