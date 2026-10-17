// Builds data/curated and data/stress-s1: one file per invoice + manifest.json. FICTIONAL data only.
//   email: <id>.email.txt (realistic vendor email, summary in the body) + <id>.att.pdf (the invoice PDF it attaches)
//   chat:  <id>.chat.txt     pdf: <id>.pdf (realistic invoice; emailed with a short cover note)
//   image: <id>.img-src.pdf -> <id>.jpg via scripts/render_images.py (phone photo of the printed invoice)
import { mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { curated, generate, renderEmail, renderChat, rng } from "../src/gen/generator.mjs";
import { invoicePdf } from "../src/gen/invoice.mjs";

export function writeSet(dir, invoices, seed, { attachments = true } = {}) {
  mkdirSync(dir, { recursive: true });
  const r = rng(seed), manifest = [];
  for (const inv of invoices) {
    let file, attachment;
    if (inv.format === "email") { writeFileSync(`${dir}/${(file = inv.id + ".email.txt")}`, renderEmail(inv, r)); if (attachments) writeFileSync(`${dir}/${(attachment = inv.id + ".att.pdf")}`, invoicePdf(inv)); }
    else if (inv.format === "chat") writeFileSync(`${dir}/${(file = inv.id + ".chat.txt")}`, renderChat(inv, r));
    else if (inv.format === "pdf") writeFileSync(`${dir}/${(file = inv.id + ".pdf")}`, invoicePdf(inv));
    else { writeFileSync(`${dir}/${inv.id}.img-src.pdf`, invoicePdf(inv, { pages: 1 })); file = inv.id + ".jpg"; }
    manifest.push({ ...inv, file, ...(attachment ? { attachment } : {}) });
  }
  writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 1));
  return manifest;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const d of ["data/curated", "data/stress-s1"]) for (const f of (() => { try { return readdirSync(d); } catch { return []; } })()) if (/\.(txt|pdf|json)$/.test(f)) rmSync(`${d}/${f}`);
  writeSet("data/curated", curated(), 7);
  writeSet("data/stress-s1", generate(1, 40), 1);
  console.log("ok; now run: python3 scripts/render_images.py data/curated data/stress-s1");
}
