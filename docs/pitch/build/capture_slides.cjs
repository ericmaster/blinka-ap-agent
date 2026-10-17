// Screenshots of each slide of ../index.html at 1920x1080 (needs Google Chrome + `npm i --no-save playwright-core`).
const { chromium } = require("playwright-core");
const path = require("path"), out = process.argv[2] || path.join(__dirname, ".pitch-video");
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: true, args: ["--hide-scrollbars"] });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + "#1"); await p.waitForTimeout(1500);
  await p.addStyleTag({ content: "#progress,#hint,#notes{display:none!important}" });
  for (let n = 1; n <= 7; n++) {
    await p.evaluate(n => { location.hash = "#" + n }, n); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(out, `slide${n}.png`) });
  }
  await b.close(); console.log("slides ->", out);
})();
