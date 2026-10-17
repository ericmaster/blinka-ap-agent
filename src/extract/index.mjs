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

export async function pdfText(buf) {
  const { extractText: ex, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await ex(pdf, { mergePages: true });
  return text;
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
  const fields = extractText(text);
  return { ...fields, channel: doc.kind, ocrConfidence, clientOcr: !!doc.clientOcr, lang: detectLang(text) };
}

const STOP = { es: ["factura", "proveedor", "vence", "cuenta", "horas", "hola", "concepto", "de la", "por"], en: ["invoice", "vendor", "due", "account", "hours", "the", "hi", "for", "total due"],
  pt: ["fatura", "fornecedor", "vencimento", "conta", "horas", "olá", "oi", "referente", "segue", "não", "ção"] };
export function detectLang(text) {
  const t = " " + (text ?? "").toLowerCase() + " ";
  const sc = Object.fromEntries(Object.entries(STOP).map(([l, ws]) => [l, ws.reduce((n, w) => n + (t.split(w).length - 1), 0)]));
  return Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0];
}
