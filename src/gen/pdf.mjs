// Minimal single-page text PDF writer (WinAnsi, Helvetica). No dependencies.
export function textPdf(lines) {
  const esc = (s) => Buffer.from(s.replace(/[\\()]/g, (c) => "\\" + c), "latin1");
  const parts = [Buffer.from("BT /F1 11 Tf 14 TL 50 790 Td\n", "latin1")];
  for (const l of lines) parts.push(Buffer.from("("), esc(l), Buffer.from(") Tj T*\n"));
  parts.push(Buffer.from("ET"));
  const stream = Buffer.concat(parts);
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ].map((o) => Buffer.from(o, "latin1"));
  objs.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]));
  const chunks = [Buffer.from("%PDF-1.4\n")], offs = [];
  let pos = chunks[0].length;
  objs.forEach((o, i) => { const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]); offs.push(pos); pos += b.length; chunks.push(b); });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
}
