// Screenshots of each slide of ../index.html at 1920x1080 (needs Google Chrome + `npm i --no-save playwright-core`).
// Also renders slide5-pop-00..NN.png: the "0 pagos indebidos" box popping in (scale overshoot + green glow), used by pitch_video.py.
const { chromium } = require("playwright-core");
const path = require("path"), out = process.argv[2] || path.join(__dirname, ".pitch-video");
const POP_FRAMES = 14; // 30 fps -> ~0.47 s
const mix = (a, b, t) => "rgb(" + [0, 2, 4].map(i => Math.round(parseInt(a.substr(i + 1, 2), 16) * (1 - t) + parseInt(b.substr(i + 1, 2), 16) * t)).join(",") + ")";
const easeOutBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: true, args: ["--hide-scrollbars"] });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + "#1"); await p.waitForTimeout(1500);
  await p.addStyleTag({ content: "#progress,#hint,#notes{display:none!important}" });
  for (let n = 1; n <= 7; n++) {
    await p.evaluate(n => { location.hash = "#" + n }, n); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(out, `slide${n}.png`) });
    if (n !== 5) continue;
    for (let i = 0; i < POP_FRAMES; i++) {
      const t = (i + 1) / POP_FRAMES, a = Math.min(1, t * 1.4), s = 1 + 0.045 * easeOutBack(t);
      await p.evaluate(({ s, a, ink }) => {
        const k = document.querySelector(".s5 .kpi:nth-child(2)"), v = k.querySelector(".v");
        Object.assign(k.style, { transition: "none", transform: `scale(${s})`, position: "relative", zIndex: 2,
          borderColor: `rgba(31,138,91,${a})`, background: `rgba(31,138,91,${0.07 * a})`,
          boxShadow: `0 0 0 ${8 * a}px rgba(31,138,91,${0.14 * a}), 0 24px 70px rgba(31,138,91,${0.32 * a})` });
        v.style.transition = "none"; v.style.color = ink;
      }, { s, a, ink: mix("#1c253a", "#1f8a5b", a) });
      await p.waitForTimeout(60);
      await p.screenshot({ path: path.join(out, `slide5-pop-${String(i).padStart(2, "0")}.png`) });
    }
    await p.evaluate(() => { const k = document.querySelector(".s5 .kpi:nth-child(2)"); k.removeAttribute("style"); k.querySelector(".v").removeAttribute("style"); });
  }
  await b.close(); console.log("slides ->", out);
})();
