import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { processDoc, kindOf } from "../src/pipeline.mjs";
import { newLedger } from "../src/engine/decide.mjs";
import { writeSet } from "../scripts/build-dataset.mjs";
import { generate } from "../src/gen/generator.mjs";

export const rules = JSON.parse(readFileSync("config/rules.json", "utf8"));
export const load = (dir) => JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
export function stressSet(seed, n = 60) { // no Pillow in CI: images re-rendered as PDFs here; committed data/stress-s1 has real PNGs
  const dir = mkdtempSync(`${tmpdir()}/blinka-`);
  return { dir, manifest: writeSet(dir, generate(seed, n).map((i) => (i.format === "image" ? { ...i, format: "pdf" } : i)), seed) };
}
export async function run(dir, manifest, adapter) {
  const ledger = newLedger(), log = [];
  for (const m of manifest) log.push(await processDoc({ id: m.id, kind: kindOf(m.file), path: `${dir}/${m.file}` }, { ledger, rules, adapter }));
  return log;
}
import { improper as judge } from "../src/score.mjs";
export const improper = (log, manifest) => judge(log, manifest, rules);
export { counts } from "../src/score.mjs";
