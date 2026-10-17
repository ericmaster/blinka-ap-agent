# Real vs simulated · Real vs simulado

Checked against the code on `main` (Oct 17, 2026). / Verificado contra el código de `main` (17 oct 2026).

## EN

| Component | Status | What it is | Code |
|---|---|---|---|
| Extraction: email/chat text | **Real** | Regex and heuristic field extraction (payee, amount, currency, due date, account, items) | `src/extract/text.mjs` |
| Extraction: PDF | **Real** | Embedded text layer read with unpdf (pdf.js) | `src/extract/index.mjs` |
| Extraction: images (OCR) | **Real** | tesseract.js (spa/eng/por). On the live Worker it runs in the browser; on the local Node server it runs on the server | `src/server/ui.html`, `src/extract/index.mjs` |
| Rules engine | **Real** | Deterministic code: vendor allowlist, registered bank account, contract items/prices, duplicates, limits, budget, period caps | `src/engine/decide.mjs` |
| Decision models | **Real** (live) | Fastino GLiDE (primary) → TypeSafe JEV `jev-latest` through a reseller key (fallback). They only answer two yes/no questions (duplicate? matches the agreement?). A model can hold or escalate a payment but can never approve one, and p 0.2–0.8 or any error escalates | `src/adapters/index.mjs` |
| Models in CI/tests | Simulated | Fake adapters (oracle, reckless, failing); the reckless one shows 0 improper payments | `test/decisions.test.mjs` |
| Decision log + reasons | **Real** | Every decision is stored with reasons, evidence and history in Cloudflare KV, one workspace per company | `src/server/app.mjs` |
| Login (OTP + sessions) | **Real**, demo mode | 6-digit one-time code (expires in 10 min, 5 tries, rate limited) and an HttpOnly session cookie (7 days). **No email is sent**: in demo mode the code is shown on screen | `src/server/app.mjs` |
| Vendor dual approval | **Real** | Changes to a bank account, terms or currency, and new vendors, wait for a *different* user in the same workspace (same email domain); payments are held while the change is pending | `src/server/app.mjs` |
| pain.001 | **Real** format | ISO 20022 `pain.001.001.09` XML of the paid invoices. It is only a file and goes to no bank | `src/output/pain001.mjs` |
| Translation | **Real** | Workers AI `@cf/meta/m2m100-1.2b`; decisions always use the original text | `src/server/app.mjs` |
| Audit export | **Real** | CSV/JSON download of the invoice decisions and vendor changes | `src/server/app.mjs` (`/api/audit.csv\|json`) |
| Deploy | **Real** | Cloudflare Worker + KV + Workers AI; secrets stored as Worker secrets | `wrangler.toml` |
| Mailbox and WhatsApp | Simulated | Mock services with their own API, reached only through connectors | `src/mocks/service.mjs`, `docs/CONNECTORS.md` |
| Blinka payouts | Simulated | Mock "Blinka Payments" sandbox that we built (Blinka has no public API). Rails are as listed on blinka.co; payments are idempotent. **No money moves** | `src/mocks/blinka.mjs` |
| Outbound notifications | Simulated | Recorded as "simulated"; no email or message is sent | `src/notify/index.mjs` |
| Vendors, invoices, contracts, history | Simulated | Synthetic data for a fictional company, **Northwind Ridge Inc.** (Delaware): 8 vendors, `XX-FAKE-NNNN` accounts, `.example` domains | `src/data/vendors.mjs`, `data/`, `src/gen/` |
| FX rates | Simulated | Fixed table in the rules (USD, COP, MXN, BRL, PEN, CLP); not live market rates | `config/rules.json` (`fx_to_usd`) |
| Stress test inputs | Simulated | Generated invoices; image-type invoices use their text layer, not OCR | `src/server/app.mjs` (`stress`) |

## ES

| Componente | Estado | Qué es | Código |
|---|---|---|---|
| Extracción: correo/chat | **Real** | Regex y heurísticas (beneficiario, monto, moneda, vencimiento, cuenta, ítems) | `src/extract/text.mjs` |
| Extracción: PDF | **Real** | Capa de texto con unpdf (pdf.js) | `src/extract/index.mjs` |
| Extracción: imágenes (OCR) | **Real** | tesseract.js (spa/eng/por). En el Worker en vivo corre en el navegador; en el servidor Node local, en el servidor | `src/server/ui.html`, `src/extract/index.mjs` |
| Motor de reglas | **Real** | Código determinista: lista de proveedores, cuenta registrada, ítems y precios del contrato, duplicados, límites, presupuesto, topes | `src/engine/decide.mjs` |
| Modelos de decisión | **Real** (en vivo) | Fastino GLiDE (principal) → TypeSafe JEV `jev-latest` con llave de revendedor (respaldo). Solo responden dos preguntas sí/no (¿duplicado? ¿cumple el acuerdo?). Un modelo puede frenar o escalar un pago, pero nunca aprobarlo; con p entre 0,2 y 0,8, o ante cualquier error, se escala | `src/adapters/index.mjs` |
| Modelos en CI/tests | Simulado | Adaptadores falsos (oracle, reckless, failing); el «temerario» da 0 pagos indebidos | `test/decisions.test.mjs` |
| Registro de decisiones | **Real** | Cada decisión con razones, evidencia e historial, guardada en Cloudflare KV, un espacio por empresa | `src/server/app.mjs` |
| Login (OTP + sesiones) | **Real**, modo demo | Código de 6 dígitos (vence en 10 min, 5 intentos, límite de solicitudes) y cookie HttpOnly (7 días). **No se envía correo**: en modo demo el código aparece en pantalla | `src/server/app.mjs` |
| Doble aprobación de proveedores | **Real** | Los cambios de cuenta, condiciones o moneda, y los proveedores nuevos, esperan a *otra* persona del mismo espacio (mismo dominio); mientras tanto, los pagos se frenan | `src/server/app.mjs` |
| pain.001 | Formato **real** | XML ISO 20022 `pain.001.001.09` con las facturas pagadas. Es solo un archivo y no va a ningún banco | `src/output/pain001.mjs` |
| Traducción | **Real** | Workers AI `@cf/meta/m2m100-1.2b`; la decisión siempre usa el texto original | `src/server/app.mjs` |
| Exportación de auditoría | **Real** | Descarga CSV/JSON de las decisiones y de los cambios de proveedores | `src/server/app.mjs` |
| Despliegue | **Real** | Cloudflare Worker + KV + Workers AI; secretos guardados como secretos del Worker | `wrangler.toml` |
| Correo y WhatsApp | Simulado | Servicios mock con API propia, a los que solo se accede por conectores | `src/mocks/service.mjs`, `docs/CONNECTORS.md` |
| Pagos Blinka | Simulado | Sandbox «Blinka Payments» hecho por nosotros (Blinka no tiene API pública). Rieles según blinka.co; pagos idempotentes. **No se mueve dinero** | `src/mocks/blinka.mjs` |
| Notificaciones | Simulado | Quedan registradas como «simulated»; no se envía ningún correo ni mensaje | `src/notify/index.mjs` |
| Proveedores, facturas, contratos, historial | Simulado | Datos sintéticos de una empresa ficticia, **Northwind Ridge Inc.** (Delaware): 8 proveedores, cuentas `XX-FAKE-NNNN`, dominios `.example` | `src/data/vendors.mjs`, `data/`, `src/gen/` |
| Tipos de cambio | Simulado | Tabla fija en las reglas (USD, COP, MXN, BRL, PEN, CLP); no son tasas de mercado | `config/rules.json` (`fx_to_usd`) |
| Entradas del stress test | Simulado | Facturas generadas; las de tipo imagen usan su capa de texto, sin OCR | `src/server/app.mjs` (`stress`) |
