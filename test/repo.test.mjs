import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
test("no .env committed", () => assert.equal(existsSync(".env"), false));
test("adapters read keys only from env", () => {
  const s = readFileSync("bench/adapters.py", "utf8");
  assert.match(s, /os\.environ\["FASTINO_API_KEY"\]/);
  assert.doesNotMatch(s, /(sk|gho|ghp)_[A-Za-z0-9]{10,}/);
});
