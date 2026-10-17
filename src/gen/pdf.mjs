// Small dependency-free PDF writer (WinAnsi, base-14 fonts). Runs in Node and in the Worker. FICTIONAL documents only.
// textPdf(lines): legacy one-column text page. pdfDoc(): multi-page canvas with text, rules, boxes and fills (top-left origin, points).
import { W } from "./fontmetrics.mjs";

const CP = { "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f };
const code = (c) => { const u = c.codePointAt(0); return CP[c] ?? (u < 256 && !(u >= 0x80 && u < 0xa0) ? u : 0x3f); };
/** WinAnsi bytes, PDF string escaped. */
const enc = (s) => { const out = []; for (const c of String(s)) { const b = code(c); if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c); out.push(b); } return Buffer.from(out); };
const FONTS = { H: "Helvetica", HB: "Helvetica-Bold", HI: "Helvetica-Oblique", C: "Courier", CB: "Courier-Bold" };
export function textWidth(s, font = "H", size = 10) {
  if (font[0] === "C") return [...String(s)].length * 0.6 * size;
  const t = W[font === "HB" ? "HB" : "H"]; let w = 0;
  for (const c of String(s)) { const b = code(c); w += (b >= 32 ? t[b - 32] : 0) || 556; }
  return (w / 1000) * size;
}
const rgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(" "); };
const f2 = (n) => (Math.round(n * 100) / 100).toString();

export function pdfDoc({ width = 595.28, height = 841.89 } = {}) {
  const pages = []; let cur = null;
  const doc = {
    width, height,
    page() { cur = []; pages.push(cur); return doc; },
    get pageCount() { return pages.length; },
    text(x, y, s, { font = "H", size = 10, color = "#000000", align = "left" } = {}) {
      if (s == null || s === "") return doc;
      const w = textWidth(s, font, size), dx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
      cur.push(Buffer.concat([Buffer.from(`BT /${font} ${f2(size)} Tf ${rgb(color)} rg ${f2(dx)} ${f2(height - y)} Td (`), enc(s), Buffer.from(") Tj ET\n")]));
      return doc;
    },
    rect(x, y, w, h, { fill = null, stroke = null, lw = 0.5 } = {}) {
      const ops = [`${f2(x)} ${f2(height - y - h)} ${f2(w)} ${f2(h)} re`];
      cur.push(Buffer.from(`q ${lw} w ${fill ? rgb(fill) + " rg " : ""}${stroke ? rgb(stroke) + " RG " : ""}${ops[0]} ${fill && stroke ? "B" : fill ? "f" : "S"} Q\n`));
      return doc;
    },
    line(x1, y1, x2, y2, { color = "#000000", lw = 0.5, dash = null } = {}) {
      cur.push(Buffer.from(`q ${lw} w ${rgb(color)} RG ${dash ? `[${dash.join(" ")}] 0 d ` : ""}${f2(x1)} ${f2(height - y1)} m ${f2(x2)} ${f2(height - y2)} l S Q\n`));
      return doc;
    },
    /** Greedy word wrap to a width; returns lines. */
    wrap(s, maxW, font = "H", size = 10) {
      const out = []; let line = "";
      for (const word of String(s).split(/\s+/)) { const t = line ? line + " " + word : word; if (textWidth(t, font, size) <= maxW || !line) line = t; else { out.push(line); line = word; } }
      if (line) out.push(line); return out;
    },
    build(meta = {}) {
      const objs = [], add = (b) => { objs.push(Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1")); return objs.length; };
      add("<< /Type /Catalog /Pages 2 0 R >>"); add(""); // pages placeholder
      const fontIds = Object.fromEntries(Object.entries(FONTS).map(([k, n]) => [k, add(`<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`)]));
      const res = `<< /Font << ${Object.entries(fontIds).map(([k, id]) => `/${k} ${id} 0 R`).join(" ")} >> >>`;
      const kids = [];
      for (const p of pages) {
        const stream = Buffer.concat(p);
        const cid = add(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]));
        kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f2(width)} ${f2(height)}] /Resources ${res} /Contents ${cid} 0 R >>`));
      }
      objs[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`);
      const info = add(Buffer.concat([Buffer.from("<< /Producer ("), enc(meta.producer ?? "Clearhold synthetic invoice generator (fictional data)"), Buffer.from(") /Title ("), enc(meta.title ?? "Invoice"), Buffer.from(")"),
        ...(meta.creator ? [Buffer.from(" /Creator ("), enc(meta.creator), Buffer.from(")")] : []), Buffer.from(" >>")]));
      const chunks = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")], offs = []; let pos = chunks[0].length;
      objs.forEach((o, i) => { const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]); offs.push(pos); pos += b.length; chunks.push(b); });
      chunks.push(Buffer.from(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") +
        `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
      return Buffer.concat(chunks);
    },
  };
  return doc;
}

/** Legacy: one column of text lines (used by the contract PDF). */
export function textPdf(lines) {
  const d = pdfDoc().page(); let y = 52;
  for (const l of lines) { d.text(50, y, l, { size: 11 }); y += 14; if (y > 800) { d.page(); y = 52; } }
  return d.build();
}
