// Amount in words (ES/PT/EN), as printed on LatAm invoices ("SON: ...", "Valor por extenso"). Integers up to 999.999.999.
const ES_U = "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintitrés veinticuatro veinticinco veintiséis veintisiete veintiocho veintinueve".split(" ");
const ES_T = ",,,treinta,cuarenta,cincuenta,sesenta,setenta,ochenta,noventa".split(",");
const ES_H = ",ciento,doscientos,trescientos,cuatrocientos,quinientos,seiscientos,setecientos,ochocientos,novecientos".split(",");
const apoc = (s) => s.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
function es(n) {
  if (n < 30) return ES_U[n];
  if (n < 100) return ES_T[Math.floor(n / 10)] + (n % 10 ? " y " + ES_U[n % 10] : "");
  if (n === 100) return "cien";
  if (n < 1000) return ES_H[Math.floor(n / 100)] + (n % 100 ? " " + es(n % 100) : "");
  if (n < 1e6) { const k = Math.floor(n / 1000); return (k === 1 ? "mil" : apoc(es(k)) + " mil") + (n % 1000 ? " " + es(n % 1000) : ""); }
  const m = Math.floor(n / 1e6); return (m === 1 ? "un millón" : apoc(es(m)) + " millones") + (n % 1e6 ? " " + es(n % 1e6) : "");
}
const PT_U = "zero um dois três quatro cinco seis sete oito nove dez onze doze treze catorze quinze dezesseis dezessete dezoito dezenove".split(" ");
const PT_T = ",,vinte,trinta,quarenta,cinquenta,sessenta,setenta,oitenta,noventa".split(",");
const PT_H = ",cento,duzentos,trezentos,quatrocentos,quinhentos,seiscentos,setecentos,oitocentos,novecentos".split(",");
function pt(n) {
  if (n < 20) return PT_U[n];
  if (n < 100) return PT_T[Math.floor(n / 10)] + (n % 10 ? " e " + PT_U[n % 10] : "");
  if (n === 100) return "cem";
  if (n < 1000) return PT_H[Math.floor(n / 100)] + (n % 100 ? " e " + pt(n % 100) : "");
  const join = (r) => (r ? (r < 100 || r % 100 === 0 ? " e " : " ") + pt(r) : "");
  if (n < 1e6) { const k = Math.floor(n / 1000); return (k === 1 ? "mil" : pt(k) + " mil") + join(n % 1000); }
  const m = Math.floor(n / 1e6); return (m === 1 ? "um milhão" : pt(m) + " milhões") + join(n % 1e6);
}
const EN_U = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const EN_T = ",,twenty,thirty,forty,fifty,sixty,seventy,eighty,ninety".split(",");
function en(n) {
  if (n < 20) return EN_U[n];
  if (n < 100) return EN_T[Math.floor(n / 10)] + (n % 10 ? "-" + EN_U[n % 10] : "");
  if (n < 1000) return EN_U[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + en(n % 100) : "");
  if (n < 1e6) return en(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + en(n % 1000) : "");
  return en(Math.floor(n / 1e6)) + " million" + (n % 1e6 ? " " + en(n % 1e6) : "");
}
const CUR = { es: { COP: "pesos colombianos M/CTE", MXN: "pesos mexicanos", CLP: "pesos chilenos", PEN: "soles", BRL: "reales", USD: "dólares estadounidenses" },
  pt: { BRL: "reais", USD: "dólares americanos" }, en: { USD: "US dollars", MXN: "Mexican pesos", COP: "Colombian pesos", PEN: "soles", BRL: "Brazilian reais", CLP: "Chilean pesos" } };
export function amountInWords(amount, currency, lang) {
  const i = Math.floor(amount + 1e-9), c = Math.round((amount - i) * 100), cc = String(c).padStart(2, "0");
  const name = CUR[lang]?.[currency] ?? currency;
  if (lang === "pt") return `${pt(i)} ${name}${c ? ` e ${pt(c)} centavos` : ""}`.replace(/^./, (x) => x.toUpperCase());
  if (lang === "en") return `${en(i)} ${name} and ${cc}/100`.replace(/^./, (x) => x.toUpperCase());
  const w = apoc(es(i)) + (/(millón|millones)$/.test(es(i)) ? " de" : "");
  return `${w} ${name}${["COP", "CLP"].includes(currency) ? "" : ` ${cc}/100${currency === "MXN" ? " M.N." : ""}`}`.toUpperCase();
}
