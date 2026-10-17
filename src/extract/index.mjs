// Channel-specific text acquisition, then shared text extraction.
// PDF: embedded text layer via unpdf (pdf.js). Image: local OCR via tesseract.js (free, WASM) — see docs/EXTRACTION.md.
import { extractText } from "./text.mjs";

let ocrWorker = null;
async function ocr(buf) {
  if (!ocrWorker) {
    const { createWorker } = await import("tesseract.js");
    ocrWorker = await createWorker(["spa", "eng", "por"], 1, { cachePath: ".cache/tesseract" });
  }
  const { data } = await ocrWorker.recognize(buf);
  return { text: data.text, confidence: data.confidence };
}
export async function closeOcr() { if (ocrWorker) { await ocrWorker.terminate(); ocrWorker = null; } }

/** Layout-aware PDF text: text items grouped into lines by baseline, sorted by x; wide gaps (table columns) become tabs. */
export async function pdfText(buf) {
  const { extractTextItems, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { items } = await extractTextItems(pdf);
  return items.map(layoutLines).join("\n\n");
}
export function layoutLines(items) {
  const its = items.filter((i) => i.str && i.str.trim()).map((i) => ({ ...i, fontSize: i.fontSize || i.height || 10 })).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of its) {
    const l = lines.find((L) => Math.abs(L.y - it.y) <= Math.max(1, 0.25 * Math.min(L.size, it.fontSize)));
    if (l) l.items.push(it); else lines.push({ y: it.y, size: it.fontSize, items: [it] });
  }
  return lines.sort((a, b) => b.y - a.y).map((L) => {
    const xs = L.items.sort((a, b) => a.x - b.x); let s = "", end = null;
    for (const it of xs) { const gap = end == null ? 0 : it.x - end; s += end == null ? "" : gap > Math.max(3, it.fontSize * 0.55) ? "\t" : gap > it.fontSize * 0.12 ? " " : ""; s += it.str.trim(); end = it.x + (it.width || 0); }
    return s;
  }).join("\n");
}
/** doc: {kind: 'email'|'chat'|'pdf'|'image', path?|content?|buffer?} */
export async function extract(doc) {
  // doc.text = text already extracted upstream (e.g. browser OCR for images in the deployed app).
  let text = doc.text ?? doc.content ?? null, ocrConfidence = doc.ocrConfidence ?? null;
  if (text == null) {
    const buf = doc.buffer ?? (doc.path ? await (await import("node:fs/promises")).readFile(doc.path) : null);
    if (doc.kind === "pdf") text = await pdfText(buf);
    else if (doc.kind === "image") ({ text, confidence: ocrConfidence } = await ocr(buf));
    else text = new TextDecoder().decode(buf);
  }
  const fields = extractText(text, doc.registry);
  return { ...fields, channel: doc.kind, ocrConfidence, clientOcr: !!doc.clientOcr, lang: detectLang(text) };
}

const STOP = { es: ["factura", "proveedor", "vence", "cuenta", "horas", "hola", "concepto", "de la", "por"], en: ["invoice", "vendor", "due", "account", "hours", "the", "hi", "for", "total due"],
  pt: ["fatura", "fornecedor", "vencimento", "conta", "horas", "olá", "oi", "referente", "segue", "não", "ção"] };
export function detectLang(text) {
  const t = " " + (text ?? "").toLowerCase() + " ";
  const sc = Object.fromEntries(Object.entries(STOP).map(([l, ws]) => [l, ws.reduce((n, w) => n + (t.split(w).length - 1), 0)]));
  return Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0];
}
