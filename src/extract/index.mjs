// Channel-specific text acquisition, then shared text extraction.
// PDF: embedded text layer via unpdf (pdf.js). Image: local OCR via tesseract.js (free, WASM) — see docs/EXTRACTION.md.
import { readFile } from "node:fs/promises";
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
  const buf = doc.buffer ?? (doc.path ? await readFile(doc.path) : null);
  let text, ocrConfidence = null;
  if (doc.kind === "pdf") text = await pdfText(buf);
  else if (doc.kind === "image") ({ text, confidence: ocrConfidence } = await ocr(buf));
  else text = doc.content ?? buf.toString("utf8");
  const fields = extractText(text);
  return { ...fields, channel: doc.kind, ocrConfidence };
}
