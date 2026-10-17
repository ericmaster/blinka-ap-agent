import { createWorker } from "tesseract.js";
const B = "http://localhost:8796"; let sid = "";
const call = async (m, p, body) => { const r = await fetch(B + p, { method: m, headers: { "content-type": "application/json", cookie: `sid=${sid}` }, body: body && JSON.stringify(body) }); const c = r.headers.get("set-cookie"); if (c?.startsWith("sid=")) sid = c.slice(4, c.indexOf(";")); return r; };
const { code } = await (await call("POST", "/api/auth/start", { email: "eric@nimble.example" })).json();
await call("POST", "/api/auth/verify", { email: "eric@nimble.example", code });
await call("POST", "/api/reset");
const st = await (await call("GET", "/api/state")).json();
const msgs = [...st.channels.emails, ...st.channels.chats].sort((a, b) => (a.at < b.at ? -1 : 1));
const w = await createWorker(["spa", "eng", "por"], 1, { cachePath: ".cache/tesseract" });
const c = { pay: 0, hold: 0, escalate: 0 };
for (const m of msgs) {
  const att = m.attachment ?? m.attachments?.[0]; const body = { messageId: m.id };
  if (att?.type?.startsWith("image/")) { const b = Buffer.from(await (await call("GET", "/api/blob/" + att.id)).arrayBuffer()); const { data } = await w.recognize(b); body.ocr = { text: data.text, confidence: data.confidence }; }
  const e = await (await call("POST", "/api/process", { ...body })).json(); c[e.action]++; console.log(m.id, e.action, e.reason.slice(0, 110));
}
await w.terminate(); console.log(c, st.model);
