// Builds data/curated: one file per invoice (email .txt, chat .txt, .pdf, image .txt spec -> .png via render_images.py) + manifest.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { curated, generate, bodyLines, renderEmail, renderChat, rng } from "../src/gen/generator.mjs";
import { textPdf } from "../src/gen/pdf.mjs";

export function writeSet(dir, invoices, seed) {
  mkdirSync(dir, { recursive: true });
  const r = rng(seed), manifest = [];
  for (const inv of invoices) {
    let file;
    if (inv.format === "email") writeFileSync(`${dir}/${(file = inv.id + ".email.txt")}`, renderEmail(inv, r));
    else if (inv.format === "chat") writeFileSync(`${dir}/${(file = inv.id + ".chat.txt")}`, renderChat(inv, r));
    else if (inv.format === "pdf") writeFileSync(`${dir}/${(file = inv.id + ".pdf")}`, textPdf(bodyLines(inv, r)));
    else { writeFileSync(`${dir}/${inv.id}.img-src.txt`, bodyLines(inv, r).join("\n")); file = inv.id + ".png"; }
    manifest.push({ ...inv, file });
  }
  writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 1));
  return manifest;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  writeSet("data/curated", curated(), 7);
  writeSet("data/stress-s1", generate(1, 40), 1);
  console.log("ok; now run: python3 scripts/render_images.py data/curated data/stress-s1");
}
