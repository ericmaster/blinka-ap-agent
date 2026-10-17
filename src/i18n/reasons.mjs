// Spanish for every decision reason, rule name, API error and note the server produces, as keyed templates.
// The engine stays in English (rules, tests and the audit log match on it); the UI translates for display only.
// Template syntax: $n = captured text as is (names, numbers, ids, quotes from the invoice stay in their original language),
// {{n}} = translate the capture again (nested reasons), {{Fn}} = a field label from FIELDS.
// Inlined into the UI by scripts/build-ui.mjs; test/i18n.test.mjs checks every reason the engine can produce is covered.
export const FIELDS = { vendor: "proveedor", amount: "monto", currency: "moneda", "due date": "fecha de vencimiento", "invoice number": "número de factura", "bank account": "cuenta bancaria" };
const R = String.raw;
export const ES = [
  // decision reasons (src/engine/decide.mjs)
  [R`Approved vendor, registered account, matches the agreement, not a duplicate, within limits and budget\.`, "Proveedor aprobado, cuenta registrada, cumple el acuerdo, no es duplicado, dentro de los límites y del presupuesto."],
  [R`A bank account or terms change for (.+) is waiting for a second approver; payments to this vendor are held\.`, "Un cambio de cuenta bancaria o de condiciones de $1 espera un segundo aprobador; los pagos a este proveedor quedan retenidos."],
  [R`Image was read in the browser, so a person must confirm the fields\.`, "La imagen se leyó en el navegador, así que una persona debe confirmar los datos."],
  [R`Invoice contains instructions addressed to the agent \(possible prompt injection\); ignored and held\.`, "La factura contiene instrucciones dirigidas al agente (posible inyección de prompt); se ignoraron y se retuvo."],
  [R`Could not read with confidence: (.+)\.`, "No se pudo leer con confianza: {{F1}}."],
  [R`Low OCR confidence \((\S+)%\)\.`, "Confianza de OCR baja ($1%)."],
  [R`Vendor "(.+)" is not in the approved vendor registry\.`, "El proveedor \"$1\" no está en el registro de proveedores aprobados."],
  [R`Bank account (\S+) does not match the registered account for (.+)\.`, "La cuenta bancaria $1 no coincide con la cuenta registrada de $2."],
  [R`Exact duplicate: (.+) already submitted invoice (\S+)\.`, "Duplicado exacto: $1 ya envió la factura $2."],
  [R`Line item outside the contracted service \((.+?)\): "([\s\S]*)"\.`, "Ítem fuera del servicio contratado ($1): \"$2\"."],
  [R`Duplicate: identical fingerprint to invoice (\S+) \(same items, amount, date, number and account\)\.`, "Duplicado: huella idéntica a la factura $1 (mismos ítems, monto, fecha, número y cuenta)."],
  [R`Possible duplicate: same items and amount as invoice (\S+), with a different date or number\.`, "Posible duplicado: mismos ítems y monto que la factura $1, con otra fecha o número."],
  [R`Invoice number very similar to another from the same vendor \(possible resend\)\.`, "Número de factura muy parecido a otro del mismo proveedor (posible reenvío)."],
  [R`Possible duplicate: same vendor, amount and nearby date as already-paid invoice (\S+)\.`, "Posible duplicado: mismo proveedor, monto y fecha cercana que la factura ya pagada $1."],
  [R`Same vendor and amount as recently received invoice (\S+) \(possible duplicate via another channel\)\.`, "Mismo proveedor y monto que la factura $1, recibida hace poco (posible duplicado por otro canal)."],
  [R`Does not match the agreement: ([\s\S]+)`, "No cumple el acuerdo: {{1}}"],
  [R`No exchange rate configured for (\S+)\.`, "No hay tipo de cambio configurado para $1."],
  [R`Amount US\$(\S+) exceeds the per-payment limit of US\$(\S+)\.`, "El monto US$$1 supera el límite por pago de US$$2."],
  [R`Exceeds the period cap for (.+) \(US\$(\S+)\)\.`, "Supera el tope del período para $1 (US$$2)."],
  [R`Insufficient budget: US\$(\S+) left, invoice is US\$(\S+)\.`, "Presupuesto insuficiente: quedan US$$1 y la factura es de US$$2."],
  [R`Amount US\$(\S+) is above US\$(\S+): requires human approval\.`, "El monto US$$1 supera US$$2: requiere aprobación humana."],
  [R`Decision model failed \(([\s\S]*)\); escalated for safety\.`, "Falló el modelo de decisión ($1); se escaló por seguridad."],
  [R`Incomplete model answer; escalated\.`, "Respuesta incompleta del modelo; se escaló."],
  [R`Model unsure whether duplicate \(p=(\S+)\)\.`, "El modelo no está seguro de si es un duplicado (p=$1)."],
  [R`Model: likely duplicate of a processed invoice \(p=(\S+)\)\.`, "Modelo: probable duplicado de una factura ya procesada (p=$1)."],
  [R`Model unsure whether it matches the agreement \(p=(\S+)\)\.`, "El modelo no está seguro de si cumple el acuerdo (p=$1)."],
  [R`Model: does not match the vendor agreement \(p=(\S+)\)\.`, "Modelo: no cumple el acuerdo con el proveedor (p=$1)."],
  [R`No model evaluation; escalated\.`, "Sin evaluación del modelo; se escaló."],
  [R`Safety invariant: missing data\.`, "Invariante de seguridad: faltan datos."],
  [R`Also: ([\s\S]+)`, "Además: {{1}}"],
  // agreement checks
  [R`No agreement configured for this vendor\.`, "No hay un acuerdo configurado para este proveedor."],
  [R`Currency (\S+) differs from the contracted currency \((\S+)\)\.`, "La moneda $1 difiere de la moneda contratada ($2)."],
  [R`Amount (\S+) differs from the contracted flat fee \((\S+) (\S+)\)\.`, "El monto $1 difiere de la tarifa fija contratada ($2 $3)."],
  [R`The (\S+) monthly fee was already paid \(possible duplicate\)\.`, "La tarifa mensual de $1 ya se pagó (posible duplicado)."],
  [R`Amount is not a whole number of hours at the contracted rate \((\S+) (\S+)/h\)\.`, "El monto no equivale a un número entero de horas a la tarifa contratada ($1 $2/h)."],
  [R`Would exceed the (\S+) contracted hours this period \(already paid (\S+), this invoice (\S+)\)\.`, "Superaría las $1 horas contratadas del período (ya pagadas: $2; esta factura: $3)."],
  // human decisions (src/server/app.mjs)
  [R`Approved by (\S+) at (\S+); hard rules re-checked\. Duplicate override: "([\s\S]*)"\.`, "Aprobada por $1 el $2; reglas duras verificadas de nuevo. Excepción de duplicado: \"$3\"."],
  [R`Approved by (\S+) at (\S+); hard rules re-checked\.`, "Aprobada por $1 el $2; reglas duras verificadas de nuevo."],
  [R`Rejected by (\S+) at (\S+)\.`, "Rechazada por $1 el $2."],
  [R`Vendor details changed at (\S+); re-checked on approval\.`, "Los datos del proveedor cambiaron el $1; se verifican de nuevo al aprobar."],
  // approval refusals
  [R`Only pending invoices can be approved\.`, "Solo se pueden aprobar facturas pendientes."],
  [R`Vendor not in registry: add it to the vendor registry before approving\.`, "El proveedor no está registrado: agrégalo al registro de proveedores antes de aprobar."],
  [R`Invoice data is missing; cannot approve\.`, "Faltan datos de la factura; no se puede aprobar."],
  [R`Still flagged as a possible duplicate: ([\s\S]+) To pay anyway, give an override reason \(it is logged\)\.`, "Sigue marcada como posible duplicado: {{1}} Para pagarla de todas formas, indica un motivo (queda registrado)."],
  // rules applied (RULE_CATALOG)
  [R`Fields extracted with confidence`, "Datos extraídos con confianza"],
  [R`Vendor in registry`, "Proveedor registrado"],
  [R`Registered bank account`, "Cuenta bancaria registrada"],
  [R`No prompt injection`, "Sin inyección de prompt"],
  [R`Not a duplicate \(number, fingerprint, near match, channel\)`, "No es duplicado (número, huella, coincidencia cercana, canal)"],
  [R`Line items within contracted service`, "Ítems dentro del servicio contratado"],
  [R`Matches agreement \(price, hours, flat fee\)`, "Cumple el acuerdo (precio, horas, tarifa fija)"],
  [R`Per-payment limit`, "Límite por pago"],
  [R`Vendor period cap`, "Tope del período por proveedor"],
  [R`Budget`, "Presupuesto"],
  [R`Human approval threshold`, "Umbral de aprobación humana"],
  [R`Decision model \(yes/no signal only\)`, "Modelo de decisión (solo señal sí/no)"],
  // API errors and notes
  [R`A different person must approve this change\.`, "Otra persona debe aprobar este cambio."],
  [R`Already processed`, "Ya procesada"],
  [R`Busy, please retry`, "Ocupado, inténtalo de nuevo"],
  [R`Code expired, request a new one`, "El código venció; pide uno nuevo"],
  [R`Email delivery is not configured on this deployment\.`, "El envío de correos no está configurado en este despliegue."],
  [R`Enter a valid email`, "Escribe un correo válido"],
  [R`File too large \(max 4 MB\)`, "Archivo demasiado grande (máx. 4 MB)"],
  [R`Attachment too large \(max 4 MB\)`, "Adjunto demasiado grande (máx. 4 MB)"],
  [R`Empty message`, "Mensaje vacío"],
  [R`No payouts service configured`, "No hay servicio de pagos configurado"],
  [R`No pending change`, "No hay cambios pendientes"],
  [R`No such message`, "El mensaje no existe"],
  [R`Only pending invoices can be decided`, "Solo se pueden decidir facturas pendientes"],
  [R`Too many codes requested\. Try again in 10 minutes\.`, "Pediste demasiados códigos. Inténtalo de nuevo en 10 minutos."],
  [R`Vendor already exists or name missing`, "El proveedor ya existe o falta el nombre"],
  [R`Wrong code`, "Código incorrecto"],
  [R`attachment unavailable`, "adjunto no disponible"],
  [R`auth required`, "inicia sesión"],
  [R`Please sign in`, "Inicia sesión"],
  [R`Sign in to Clearhold first`, "Primero inicia sesión en Clearhold"],
  [R`model not configured`, "modelo no configurado"],
  [R`needs OCR`, "requiere OCR"],
  [R`not found`, "no encontrado"],
  [R`vendor no longer in registry`, "el proveedor ya no está registrado"],
  [R`Human approval threshold must be ≤ the per-payment limit`, "El umbral de aprobación humana debe ser ≤ al límite por pago"],
  [R`That vendor is waiting for a second approver`, "Ese proveedor espera un segundo aprobador"],
  [R`(\S+) must be a number ≥ 0`, "$1 debe ser un número ≥ 0"],
  [R`invalid uncertain_band`, "uncertain_band no válido"],
  [R`invalid allowlist`, "lista de permitidos no válida"],
  [R`No route for (\S+) to (\S+)`, "No hay ruta para $1 hacia $2"],
  // payout rails (src/mocks/blinka.mjs railFor)
  [R`Colombia · COP bank transfer`, "Colombia · transferencia bancaria COP"],
  [R`Brazil · Pix`, "Brasil · Pix"],
  [R`Mexico · MXN local transfer`, "México · transferencia local MXN"],
  [R`Argentina · CBU / CVU / Alias`, "Argentina · CBU / CVU / Alias"],
  [R`Chile · CLP bank transfer`, "Chile · transferencia bancaria CLP"],
  [R`Peru · PEN bank transfer`, "Perú · transferencia bancaria PEN"],
  [R`Bolivia · BOB bank transfer`, "Bolivia · transferencia bancaria BOB"],
  [R`Costa Rica · CRC bank transfer`, "Costa Rica · transferencia bancaria CRC"],
  [R`United States · ACH`, "Estados Unidos · ACH"],
  [R`Local USD route \((\S+)\)`, "Ruta local en USD ($1)"],
  [R`SWIFT \(USD\)`, "SWIFT (USD)"],
  // notification recipients (src/notify)
  [R`approvers`, "aprobadores"],
  [R`contact on file for (.+)`, "contacto registrado de $1"],
  [R`Already in English`, "Ya está en inglés"],
  [R`Translation unavailable here \(no translation model configured\); showing the original\.`, "Traducción no disponible aquí (no hay modelo de traducción configurado); se muestra el original."],
  [R`Machine translation \(Workers AI m2m100\)\. Decisions always use the original text\.`, "Traducción automática (Workers AI m2m100). Las decisiones siempre usan el texto original."],
];
const TABLES = { es: ES.map(([re, tpl]) => [new RegExp(`^${re}$`), tpl]) };
const LABELS = { es: FIELDS };

/** Translate one engine/server message. Unknown text is returned unchanged; multi-sentence text is translated sentence by sentence. */
export function translateReason(s, lang = "en") {
  const table = TABLES[lang];
  if (!table || s == null) return s;
  s = String(s);
  const one = (x) => {
    for (const [re, tpl] of table) {
      const m = x.match(re);
      if (m) return tpl.replace(/\{\{(F?)(\d)\}\}|\$(\d)/g, (_, f, a, b) => (b ? m[b] ?? "" : f ? m[a].split(", ").map((x) => LABELS[lang][x] ?? x).join(", ") : translateReason(m[a], lang)));
    }
    return null;
  };
  const whole = one(s.trim());
  if (whole != null) return whole;
  // joined reasons ("Held because X. Also: Y."): split at sentence ends that start a new capitalised sentence
  const parts = s.split(/(?<=[.)])\s+(?=(?:Also: |[A-Z][a-z]|"))/);
  return parts.length > 1 ? parts.map((p) => one(p) ?? p).join(" ") : s;
}
/** True when a message has a translation (used by the coverage test). */
export const hasTranslation = (s, lang) => translateReason(s, lang) !== s;
/** Browser copy of translateReason (inlined into the UI by scripts/build-ui.mjs, so client and tests share one table). */
export const reasonsClientJs = () => `const TABLES={es:${JSON.stringify(ES)}.map(([re,tpl])=>[new RegExp("^"+re+"$"),tpl])},LABELS={es:${JSON.stringify(FIELDS)}};\n${translateReason.toString()}`;
