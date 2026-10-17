// Shared formatting + seeded RNG for the synthetic invoice generator.
export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (s) => [...String(s)].reduce((a, c) => Math.imul(a ^ c.codePointAt(0), 16777619) >>> 0, 2166136261);
export const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
export const MONTHS = {
  es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
  pt: ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
};
export function fmtDate(iso, lang, style) {
  const [y, m, d] = iso.split("-").map(Number);
  if (style === 0) return iso;
  if (style === 1 && lang !== "en") return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
  if (lang === "en") return `${MONTHS.en[m-1]} ${d}, ${y}`;
  return `${d} de ${MONTHS[lang][m-1]} de ${y}`;
}
const latinOf = (cur, lang, style) => (lang !== "en" && cur !== "USD") || style === 1; // 1.234,56 vs 1,234.56
export function fmtNum(n, cur, lang, style = 0, decimals) {
  const dec = decimals ?? (["COP", "CLP"].includes(cur) ? 0 : 2);
  const [i, f] = n.toFixed(dec).split("."), latin = latinOf(cur, lang, style);
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, latin ? "." : ",");
  return f ? g + (latin ? "," : ".") + f : g;
}
export function fmtAmount(n, cur, lang, style = 0) {
  const num = fmtNum(n, cur, lang, style);
  if (cur === null) return `$ ${num}`; // ambiguous currency trap
  const sym = { BRL: "R$", USD: "US$" }[cur];
  if (style === 2 && sym) return `${sym} ${num}`;
  return style === 3 ? `${num} ${cur}` : `${cur} ${num}`;
}
