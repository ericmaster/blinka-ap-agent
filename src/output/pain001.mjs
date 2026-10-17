// ISO 20022 pain.001.001.09 CustomerCreditTransferInitiation for approved payments. Output file only — no money moves.
import { COMPANY, VENDORS } from "../data/vendors.mjs";
const x = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
const dec = (n, cur) => (["COP", "CLP"].includes(cur) ? n.toFixed(0) : n.toFixed(2));
export function pain001(payments, { registry = VENDORS, msgId = "NWR-" + Date.now(), now = new Date().toISOString().slice(0, 19), execDate } = {}) {
  const ctrl = payments.reduce((s, p) => s + p.amount, 0);
  const tx = payments.map((p, i) => `
      <CdtTrfTxInf>
        <PmtId><InstrId>${x(p.id)}</InstrId><EndToEndId>${x(p.number)}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${x(p.currency)}">${dec(p.amount, p.currency)}</InstdAmt></Amt>
        <Cdtr><Nm>${x(registry[p.vendorKey]?.name ?? p.payee)}</Nm><PstlAdr><Ctry>${registry[p.vendorKey]?.country ?? "XX"}</Ctry></PstlAdr></Cdtr>
        <CdtrAcct><Id><Othr><Id>${x(p.acct)}</Id></Othr></Id></CdtrAcct>
        <RmtInf><Ustrd>${x("Invoice " + p.number)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- DEMO OUTPUT: fictional data, not sent to any bank. No money moves. -->
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>${x(msgId)}</MsgId><CreDtTm>${now}</CreDtTm><NbOfTxs>${payments.length}</NbOfTxs><CtrlSum>${ctrl.toFixed(2)}</CtrlSum><InitgPty><Nm>${x(COMPANY.name)}</Nm></InitgPty></GrpHdr>
    <PmtInf>
      <PmtInfId>${x(msgId)}-1</PmtInfId><PmtMtd>TRF</PmtMtd><NbOfTxs>${payments.length}</NbOfTxs><CtrlSum>${ctrl.toFixed(2)}</CtrlSum>
      <ReqdExctnDt><Dt>${execDate ?? now.slice(0, 10)}</Dt></ReqdExctnDt>
      <Dbtr><Nm>${x(COMPANY.name)}</Nm><PstlAdr><Ctry>US</Ctry></PstlAdr></Dbtr>
      <DbtrAcct><Id><Othr><Id>${COMPANY.debtorAccount}</Id></Othr></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BICFI>${COMPANY.debtorAgent}</BICFI></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${tx}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}
