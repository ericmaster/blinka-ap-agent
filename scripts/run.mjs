// Usage: node scripts/run.mjs data/curated [--real]  -> out/<set>/{decisions.jsonl,log.md,pain001.xml}
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { processDoc, kindOf } from "../src/pipeline.mjs";
import { newLedger } from "../src/engine/decide.mjs";
import { chain, glide, jev, oracle } from "../src/adapters/index.mjs";
import { closeOcr } from "../src/extract/index.mjs";
import { pain001 } from "../src/output/pain001.mjs";

const dir = process.argv[2] ?? "data/curated", real = process.argv.includes("--real");
const rules = JSON.parse(readFileSync("config/rules.json", "utf8"));
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
const adapter = real ? chain(glide(), jev()) : chain(oracle(Object.fromEntries(manifest.map((m) => [m.id, m.truth]))));
const ledger = newLedger(), log = [];
for (const m of manifest) {
  const e = await processDoc({ id: m.id, kind: kindOf(m.file), path: `${dir}/${m.file}` }, { ledger, rules, adapter });
  log.push(e); console.log(`${e.id.padEnd(8)} ${e.channel.padEnd(6)} ${e.action.padEnd(9)} ${e.reason}`);
}
await closeOcr();
const out = `out/${basename(dir)}${real ? "-real" : ""}`; mkdirSync(out, { recursive: true });
writeFileSync(`${out}/decisions.jsonl`, log.map((l) => JSON.stringify(l)).join("\n") + "\n");
writeFileSync(`${out}/log.md`, "| Factura | Canal | Decisión | Por qué |\n|---|---|---|---|\n" + log.map((l) => `| ${l.id} | ${l.channel} | ${l.action} | ${l.reason} |`).join("\n") + "\n");
writeFileSync(`${out}/pain001.xml`, pain001(log.filter((l) => l.action === "pay").map((l) => ({ id: l.id, ...l.extracted })), { msgId: `NWR-${basename(dir)}`, now: "2026-10-16T21:00:00", execDate: "2026-10-19" }));
const c = log.reduce((a, l) => ((a[l.action] = (a[l.action] ?? 0) + 1), a), {});
console.log(c, "->", out, `(adapter: ${adapter.name})`);
