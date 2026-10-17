const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const W = __dirname + "/", D = path.resolve(__dirname, "../..") + "/";
// Speaker notes come from the <aside class="notes"> blocks of template.html (single source).
const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, "\u00A0").replace(/&amp;/g, "&");
const NOTES = [...fs.readFileSync(W + "template.html", "utf8").matchAll(/<aside class="notes">([\s\S]*?)<\/aside>/g)].map(m => decode(m[1].trim()));
const VIDEO = D + "pitch/demo-narrated.mp4";
const POSTER = D + "screenshots/guided-demo-done.png";
const LIVE = "https://blinka-ap-agent.ericmaster.workers.dev", REPO = "https://github.com/ericmaster/blinka-ap-agent";
const C = { ink: "1C253A", accent: "2A4BD0", soft: "B9C8FF", paper: "F7F7F4", surface: "FDFDFD", line: "DEDFDC", muted: "656975", slate: "47525D", pale: "D0D9E4", pale2: "B2BBC7", hold: "C98A12", pay: "1F8A5B", esc: "C2410C" };
const F = "Inter", M = "Geist Mono";
const X = 0.833, CW = 11.667, R = X + CW; // margins
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; pres.author = "Eric Aguayo · Equipo Nimble"; pres.company = "Nimblersoft"; pres.title = "Clearhold by Blinka · Pitch 3:00";
pres.theme = { headFontFace: F, bodyFontFace: F };
const T = (s, text, o) => s.addText(text, Object.assign({ fontFace: F, margin: 0, valign: "top", color: C.ink }, o));
const box = (s, o) => s.addShape(o.r ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE, Object.assign({ line: { type: "none" } }, o, o.r ? { rectRadius: o.r } : {}));
const rule = (s, x, y, w, color, pt) => s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width: pt || 1 } });
const kicker = (s, text, y, color, x) => T(s, text.toUpperCase(), { x: x ?? X, y, w: x ? 4 : 8, h: 0.3, fontSize: 12, bold: true, charSpacing: 1.5, color: color || C.accent });
const pageno = (s, n, dark) => T(s, `${n}/7`, { x: R - 0.4, y: 7.05, w: 0.8, h: 0.25, fontSize: 10, fontFace: M, color: dark ? C.pale2 : C.muted, align: "right" });
const src = (s, text, dark, w) => T(s, text, { x: X, y: 7.03, w: w || 10.8, h: 0.3, fontSize: 10, color: dark ? C.pale2 : C.muted });
const logo = (s, x, y, dark) => {
  s.addImage({ path: W + (dark ? "mark-dark.png" : "mark.png"), x, y, w: 0.53, h: 0.53, altText: "Clearhold" });
  T(s, "Clearhold", { x: x + 0.68, y: y - 0.02, w: 3, h: 0.36, fontSize: 23, bold: true, color: dark ? "FFFFFF" : C.ink });
  T(s, "by Blinka", { x: x + 0.69, y: y + 0.35, w: 3, h: 0.22, fontSize: 11, color: dark ? C.pale2 : C.muted });
};
const tag = (s, text, x, y, w, fill, color, size) => box(s, { x, y, w, h: 0.42, r: 0.21, fill: { color: fill }, }) && T(s, text, { x, y, w, h: 0.42, fontSize: size || 13, bold: true, color, align: "center", valign: "middle" });

// 1 · Portada + dolor
let s = pres.addSlide(); s.background = { color: C.paper };
logo(s, X, 0.61);
kicker(s, "30X Hackathon · Reto Blinka", 1.72);
T(s, "El piloto automático de cuentas por pagar.", { x: X, y: 2.02, w: 6.7, h: 1.45, fontSize: 39, bold: true, lineSpacingMultiple: 0.95 });
T(s, "Paga lo acordado, detiene lo sospechoso y te pregunta lo dudoso.", { x: X, y: 3.5, w: 6.6, h: 0.75, fontSize: 19, color: C.slate });
box(s, { x: X, y: 4.38, w: 0.045, h: 1.6, fill: { color: C.accent } });
T(s, [{ text: "Laura, controller" }, { text: "   PERSONA FICTICIA", options: { fontSize: 11, color: C.muted, charSpacing: 1 } }], { x: X + 0.25, y: 4.38, w: 6.3, h: 0.36, fontSize: 17, bold: true });
T(s, "Su empresa en EE. UU. paga a proveedores en Latinoamérica. Cierra el mes revisando a mano cientos de facturas que llegan por correo y WhatsApp. Un correo que pide cambiar la cuenta de un proveedor es justo por donde se pierde el dinero.", { x: X + 0.25, y: 4.76, w: 6.3, h: 1.22, fontSize: 14, color: C.slate });
T(s, [{ text: "Eric Aguayo", options: { bold: true, color: C.ink } }, { text: " · Equipo Nimble", options: { breakLine: true } }, { text: "Co-fundador y Director de IA Aplicada, Nimblersoft" }], { x: X, y: 6.12, w: 6.9, h: 0.6, fontSize: 13, color: C.slate });
box(s, { x: 7.95, y: 0.45, w: 4.95, h: 6.25, r: 0.2, fill: { color: C.ink } });
kicker(s, "El dolor", 1.05, C.soft, 8.4);
T(s, [{ text: "US$", options: { fontSize: 36, color: C.soft } }, { text: "3.046", options: { fontSize: 68, color: "FFFFFF" } }], { x: 8.4, y: 1.4, w: 4.45, h: 1.15, bold: true, valign: "bottom" });
T(s, "millones", { x: 8.4, y: 2.58, w: 4, h: 0.55, fontSize: 32, bold: true, color: "FFFFFF" });
T(s, "perdidos por fraude de correo empresarial (BEC) reportados al FBI en 2025.¹", { x: 8.4, y: 3.3, w: 4.1, h: 1.3, fontSize: 18, color: "E9EDF1" });
rule(s, 8.4, 4.75, 4.05, "4A5263", 1);
[[8.4, "79 %", "de las empresas sufrió intento o fraude de pagos en 2024.²"], [10.5, "8,2 días", "y US$9,84 cuesta procesar cada factura.³"]].forEach(([x, b, p]) => {
  T(s, b, { x, y: 4.92, w: 1.95, h: 0.5, fontSize: 26, bold: true, color: "FFFFFF" });
  T(s, p, { x, y: 5.45, w: 1.95, h: 1.0, fontSize: 13, color: C.pale });
});
src(s, "¹ FBI IC3, 2025 Internet Crime Report · ² AFP, 2025 Payments Fraud and Control Survey · ³ Ardent Partners, State of ePayables 2025", false, 11.0); pageno(s, 1);
s.addNotes(NOTES[0]);

// 2 · Gobernanza por diseño
s = pres.addSlide(); s.background = { color: C.ink };
kicker(s, "Gobernanza por diseño", 0.61, C.soft);
T(s, [{ text: "La IA puede " }, { text: "detener", options: { color: C.soft } }, { text: " un pago. Lo aprueban las reglas en código y, sobre US$2.000, una persona." }], { x: X, y: 0.9, w: CW, h: 1.25, fontSize: 32, bold: true, color: "FFFFFF", lineSpacingMultiple: 0.95 });
const sw = 3.52, ga = 0.556, sy = 2.45, sh = 2.7;
const steps = [["01", "Las reglas en código deciden", "Proveedor y cuenta registrados, contrato, duplicados, límites y presupuesto."], ["02", "El modelo solo dice sí o no", "¿Es duplicada? ¿Cumple el contrato? Solo puede detener; si duda o falla, te pregunta."], ["03", "Cada decisión trae su prueba", "Pagar solo si todas las reglas pasan. La duda nunca se paga."]];
steps.forEach(([n, h, p], k) => {
  const x = X + k * (sw + ga), out = k === 2;
  box(s, { x, y: sy, w: sw, h: sh, r: 0.17, fill: { color: out ? C.surface : "283146" }, line: { color: out ? C.surface : "3A4356", width: 1 } });
  T(s, n, { x: x + 0.3, y: sy + 0.3, w: 1, h: 0.25, fontSize: 13, fontFace: M, color: out ? C.accent : C.soft });
  T(s, h, { x: x + 0.3, y: sy + 0.6, w: sw - 0.6, h: 0.8, fontSize: 22, bold: true, color: out ? C.ink : "FFFFFF" });
  if (out) {
    tag(s, "Pagar", x + 0.3, sy + 1.45, 0.88, "DDEDE5", "14633F"); tag(s, "Detener", x + 1.26, sy + 1.45, 0.92, "F4E8D0", "8A5D06"); tag(s, "Escalar", x + 2.26, sy + 1.45, 0.96, "F5E0D7", "9A330A");
    T(s, p, { x: x + 0.3, y: sy + 1.98, w: sw - 0.6, h: 0.6, fontSize: 14, color: C.slate });
  } else T(s, p, { x: x + 0.3, y: sy + 1.45, w: sw - 0.6, h: 1.1, fontSize: 16, color: C.pale });
  if (k < 2) T(s, "→", { x: x + sw, y: sy + 1.0, w: ga, h: 0.6, fontSize: 28, color: C.soft, align: "center", valign: "middle" });
});
box(s, { x: X, y: 5.6, w: CW, h: 0.9, r: 0.14, fill: { color: "252E42" } });
tag(s, "Detenida", X + 0.25, 5.84, 1.25, C.hold, "FFFFFF", 15);
T(s, [{ text: "«La cuenta " }, { text: "MX-FAKE-9999", options: { fontFace: M, color: C.soft } }, { text: " no coincide con la registrada para Monterrey Ops Partners S.C.»" }], { x: X + 1.75, y: 5.6, w: CW - 1.9, h: 0.9, fontSize: 17, color: "FFFFFF", valign: "middle" });
src(s, "Ejemplo real de la demo, con datos sintéticos.", true); pageno(s, 2, true);
s.addNotes(NOTES[1]);

// 3 · Demo
s = pres.addSlide(); s.background = { color: C.paper };
kicker(s, "Demo", 0.44);
T(s, "Tres facturas. Dos trampas detenidas.", { x: X, y: 0.77, w: 8.5, h: 0.6, fontSize: 28, bold: true });
box(s, { x: R - 2.75, y: 0.66, w: 2.75, h: 0.55, r: 0.27, fill: { color: C.ink } });
s.addShape(pres.shapes.OVAL, { x: R - 2.48, y: 0.88, w: 0.11, h: 0.11, fill: { color: C.hold }, line: { type: "none" } });
T(s, "Datos sintéticos", { x: R - 2.3, y: 0.66, w: 2.1, h: 0.55, fontSize: 15, bold: true, color: "FFFFFF", valign: "middle" });
const vx = X, vy = 1.45, vw = 7.78, vh = 5.4;
box(s, { x: vx - 0.015, y: vy - 0.015, w: vw + 0.03, h: vh + 0.03, fill: { color: C.line } });
const hasVideo = fs.existsSync(VIDEO);
if (hasVideo) s.addMedia({ type: "video", path: VIDEO, cover: fs.readFileSync(POSTER).toString("base64").replace(/^/, "image/png;base64,"), x: vx, y: vy, w: vw, h: vh });
else s.addImage({ path: POSTER, x: vx, y: vy, w: vw, h: vh, altText: "Demo guiada de Clearhold (datos sintéticos)", hyperlink: { url: LIVE, tooltip: "Abrir la demo en vivo" } });
const sx = R - 3.33;
[["Normal → pagada", "Proveedor con contrato y cuenta registrada."], ["Otra cuenta → detenida", "Te dice por qué, en una línea."], ["Reenviada → detenida", "La misma factura, ahora por WhatsApp."]].forEach(([b, p], k) => {
  const y = 1.72 + k * 1.28; rule(s, sx, y, 3.33, C.line, 1.5);
  T(s, b, { x: sx, y: y + 0.13, w: 3.4, h: 0.38, fontSize: 19, bold: true });
  T(s, p, { x: sx, y: y + 0.52, w: 3.33, h: 0.6, fontSize: 15, color: C.slate });
});
T(s, hasVideo ? "Pruébala en vivo:" : "Video: demo-narrated.mp4 · En vivo:", { x: sx, y: 5.9, w: 3.4, h: 0.25, fontSize: 12, color: C.muted });
T(s, [{ text: "blinka-ap-agent.ericmaster.workers.dev", options: { hyperlink: { url: LIVE } } }], { x: sx, y: 6.17, w: 3.6, h: 0.3, fontSize: 12, bold: true, color: C.accent });
pageno(s, 3);
s.addNotes(NOTES[2] + (hasVideo ? "" : "\n[Nota de build: demo-narrated.mp4 no existía al generar este PPTX; la diapositiva muestra el póster con enlace a la demo en vivo. Insertar el video en PowerPoint sobre el póster: Insertar → Video.]"));

// 4 · Real vs simulado
s = pres.addSlide(); s.background = { color: C.paper };
kicker(s, "Real vs simulado", 0.61);
T(s, "Lo que decide es real. Lo que mueve dinero, todavía no.", { x: X, y: 0.9, w: CW + 0.3, h: 0.8, fontSize: 30, bold: true });
const cw2 = 5.55, c2x = X + cw2 + 0.56;
const col = (x, title, items, sim) => {
  if (sim) s.addShape(pres.shapes.OVAL, { x, y: 2.17, w: 0.17, h: 0.17, fill: { color: C.paper }, line: { color: C.muted, width: 2.5 } });
  else s.addShape(pres.shapes.OVAL, { x, y: 2.17, w: 0.17, h: 0.17, fill: { color: C.pay }, line: { type: "none" } });
  T(s, title, { x: x + 0.3, y: 2.04, w: cw2 - 0.3, h: 0.42, fontSize: 22, bold: true, color: sim ? C.slate : C.ink, valign: "middle" });
  rule(s, x, 2.6, cw2, sim ? C.muted : C.ink, 2.25);
  let y = 2.62;
  items.forEach(([a, b]) => {
    const h = b ? 0.86 : 0.66;
    T(s, b ? [{ text: a, options: { breakLine: true } }, { text: b, options: { fontSize: 14, color: C.muted } }] : a, { x, y: y + 0.14, w: cw2, h: h - 0.14, fontSize: 18 });
    y += h; rule(s, x, y, cw2, C.line, 0.75);
  });
};
col(X, "Real, en producción hoy", [["Extracción de correo, chat, PDF y fotos (OCR)"], ["Motor de reglas y modelos de decisión en vivo"], ["Doble aprobación de cambios de cuenta"], ["Registro con evidencia y export de auditoría"], ["pain.001 ISO 20022 · Cloudflare Workers"]]);
col(c2x, "Simulado", [["Correo y WhatsApp", "Servicios mock con su propia API"], ["Pagos Blinka", "Sandbox nuestro: no se mueve dinero"], ["Datos", "Empresa ficticia Northwind Ridge Inc."], ["Notificaciones y tipos de cambio fijos"]], true);
src(s, "Detalle verificado contra el código: docs/REAL-VS-SIMULATED.md"); pageno(s, 4);
s.addNotes(NOTES[3]);

// 5 · Costo e impacto
s = pres.addSlide(); s.background = { color: C.paper };
kicker(s, "Costo e impacto", 0.61);
T(s, "Menos de 1 centavo por factura. Ningún pago indebido.", { x: X, y: 0.9, w: CW + 0.3, h: 0.8, fontSize: 30, bold: true });
const g = 0.194, u = (CW - 3 * g) / 4.25, ky = 2.3, kh = 2.78;
const kpis = [
  [1.25, [{ text: "<1¢" }], [{ text: "por factura (modelo + serverless). Hoy procesar una cuesta " }, { text: "US$9,84", options: { bold: true } }, { text: " en promedio.¹" }], true],
  [1, [{ text: "0" }], [{ text: "pagos indebidos en 629 facturas sintéticas, incluso con un modelo que aprueba todo." }]],
  [1, [{ text: "28" }, { text: "%", options: { fontSize: 24, color: C.muted } }], [{ text: "se escala a una persona en la demo en vivo (8 de 29). Meta de piloto: ≤\u00A035\u00A0%." }]],
  [1, [{ text: "21" }, { text: "%", options: { fontSize: 24, color: C.muted } }], [{ text: "está muy seguro de detectar a tiempo un cambio de cuenta fraudulento.²" }]],
];
let kx = X;
kpis.forEach(([f, v, p, hero]) => {
  const w = u * f;
  box(s, { x: kx, y: ky, w, h: kh, r: 0.17, fill: { color: hero ? C.accent : C.surface }, line: { color: hero ? C.accent : C.line, width: 1.5 } });
  T(s, v, { x: kx + 0.27, y: ky + 0.3, w: w - 0.5, h: 0.85, fontSize: 56, bold: true, color: hero ? "FFFFFF" : C.ink, valign: "bottom" });
  T(s, p, { x: kx + 0.27, y: ky + 1.3, w: w - 0.5, h: 1.35, fontSize: 15, color: hero ? "E4E9FF" : C.slate });
  kx += w + g;
});
box(s, { x: X, y: 5.42, w: CW, h: 1.22, r: 0.17, fill: { color: C.ink } });
T(s, [{ text: "Ramp, BILL y Tipalti", options: { bold: true, color: "FFFFFF" } }, { text: " ya tienen agentes de cuentas por pagar. Recomiendan o marcan." }], { x: X + 0.36, y: 5.42, w: 4.7, h: 1.22, fontSize: 17, color: C.pale, valign: "middle" });
T(s, [{ text: "Clearhold " }, { text: "prueba", options: { color: C.soft } }, { text: " que ningún modelo puede aprobar un pago." }], { x: X + 5.6, y: 5.42, w: 5.8, h: 1.22, fontSize: 23, bold: true, color: "FFFFFF", valign: "middle" });
src(s, "¹ Ardent Partners, State of ePayables 2025 · ² Tipalti, 2026 Global Finance Outlook (2.116 encuestados) · Costo y pruebas: bench/RESULTS.md, test/decisions.test.mjs", false, 11.2); pageno(s, 5);
s.addNotes(NOTES[4]);

// 6 · Por qué Blinka
s = pres.addSlide(); s.background = { color: C.paper };
kicker(s, "Por qué Blinka", 0.61);
T(s, "Los mismos proveedores, las mismas monedas, ahora con controles.", { x: X, y: 0.9, w: CW, h: 1.2, fontSize: 32, bold: true });
const fw = 5.53; let fy = 2.3;
["Plataforma bancaria para empresas globales, con respaldo de Y Combinator", "Cuentas en USD y pagos con rutas locales a COP, MXN, BRL, PEN, CLP y ARS", "Gestión de proveedores, facturación y contabilidad con automatizaciones"].forEach(t => {
  box(s, { x: X, y: fy + 0.25, w: 0.125, h: 0.125, fill: { color: C.accent } });
  T(s, t, { x: X + 0.3, y: fy + 0.15, w: fw - 0.3, h: 0.75, fontSize: 17 });
  fy += 1.0; rule(s, X, fy, fw, C.line, 0.75);
});
T(s, [{ text: "Clearhold decide " }, { text: "qué", options: { color: C.accent } }, { text: " pagar antes de que Blinka lo pague." }], { x: X, y: fy + 0.3, w: fw, h: 0.85, fontSize: 19, bold: true });
const tx = X + fw + 0.61, tw = R - tx;
T(s, "Piloto en sombra con 3 clientes de Blinka", { x: tx, y: 2.3, w: tw, h: 0.4, fontSize: 19, bold: true });
let py = 2.9;
[["Sem 1–3", "Endurecer", "SSO, auditoría y conectores reales"], ["Sem 4–7", "Sombra", "Decide sobre facturas reales sin pagar nada. Gate: 0 pagos indebidos", true], ["Sem 8–15", "Asistido → autonomía limitada", "Un humano aprueba; luego, montos bajos"]].forEach(([w_, b, p, on]) => {
  const h = on ? 1.3 : 1.12;
  if (on) box(s, { x: tx - 0.17, y: py, w: tw + 0.34, h, fill: { color: "ECEEF6" } });
  rule(s, on ? tx - 0.17 : tx, py, on ? tw + 0.34 : tw, on ? C.accent : C.line, on ? 2.25 : 1.5);
  T(s, w_, { x: tx, y: py + 0.2, w: 1.15, h: 0.3, fontSize: 13, fontFace: M, color: C.muted });
  T(s, b, { x: tx + 1.35, y: py + 0.16, w: tw - 1.35, h: 0.36, fontSize: 18, bold: true, color: on ? C.accent : C.ink });
  T(s, p, { x: tx + 1.35, y: py + 0.52, w: tw - 1.35, h: h - 0.55, fontSize: 14, color: C.slate });
  py += h;
});
src(s, "Fuentes: blinka.co · docs/RUNBOOK-PRODUCTION.md §3"); pageno(s, 6);
s.addNotes(NOTES[5]);

// 7 · Cierre
s = pres.addSlide(); s.background = { color: C.ink };
logo(s, X, 0.61, true);
T(s, [{ text: "¿Cuántos pagos aprobó tu equipo esta semana " }, { text: "sin mirar la cuenta bancaria", options: { color: C.soft } }, { text: "?" }], { x: X, y: 1.75, w: 11.2, h: 2.6, fontSize: 48, bold: true, color: "FFFFFF", lineSpacingMultiple: 0.98 });
[[X, "Demo en vivo", "blinka-ap-agent.ericmaster.workers.dev", LIVE], [X + 6.0, "Repositorio", "github.com/ericmaster/blinka-ap-agent", REPO]].forEach(([x, l, t, url]) => {
  rule(s, x, 4.95, 5.6, "4A5263", 1.5);
  T(s, l.toUpperCase(), { x, y: 5.1, w: 5, h: 0.3, fontSize: 12, bold: true, charSpacing: 1, color: C.pale2 });
  T(s, [{ text: t, options: { hyperlink: { url } } }], { x, y: 5.45, w: 5.7, h: 0.4, fontSize: 17, fontFace: M, color: "FFFFFF" });
});
T(s, "PAGA LO ACORDADO. DETIENE LO SOSPECHOSO.", { x: X, y: 6.55, w: 5.6, h: 0.3, fontSize: 12, bold: true, charSpacing: 1.5, color: C.soft });
T(s, [{ text: "Eric Aguayo", options: { bold: true, color: "FFFFFF" } }, { text: " · Nimblersoft · Equipo Nimble" }], { x: R - 6, y: 6.5, w: 6, h: 0.35, fontSize: 13, color: C.pale, align: "right" });
pageno(s, 7, true);
s.addNotes(NOTES[6]);

pres.writeFile({ fileName: D + "pitch/clearhold-pitch.pptx" }).then(f => console.log("wrote", f, "video:", hasVideo));
