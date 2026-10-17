# Backlog del sábado 17 oct (antes del freeze del dom 10:00 ECT)

Cada ítem va en su **rama** y se prueba en un **Worker de preview separado** antes de mergear a `main` (que es lo que ve el jurado).

## Cómo hacer los previews sin tocar la demo en vivo
- `wrangler.toml` tiene `preview_urls = false` y un solo KV (`STATE`). Si un preview usa el mismo KV, **pisa el estado de la demo en vivo**.
- Propuesta (cambio en `wrangler.toml`, no en el código de la app): agregar un entorno `[env.preview]` con **otro** namespace KV (`npx wrangler kv namespace create STATE_PREVIEW`) y desplegar cada rama con un nombre propio:
  `npx wrangler deploy --env preview --name blinka-ap-agent-<rama>` → `https://blinka-ap-agent-<rama>.ericmaster.workers.dev`.
- Secretos por Worker: `npx wrangler secret put FASTINO_API_KEY --name blinka-ap-agent-<rama>` (o dejar que el preview escale todo sin claves).
- Gate para mergear: `npm test` en Node 22 + CI verde + guía del jurado recorrida a mano en el preview + stress de 100 con 0 indebidos.
- Después del merge: `npx wrangler delete --name blinka-ap-agent-<rama>` (es destructivo pero solo afecta al preview).

## Ranking (impacto en la rúbrica vs esfuerzo)
Puntaje = impacto ponderado (1–5) ÷ horas. IR = Impacto 30 %, IN = Innovación 20 %, VT = Viabilidad técnica, VI = Implementación, PR = Presentación; A/S/E = Autonomía, Seguridad, Explicabilidad (Blinka).

| # | Rama | Qué | Criterios | Impacto | Horas | Por qué ahora |
|---|---|---|---|---|---|---|
| 1 | `feat/demo-sandbox` | Estado por sesión (clave KV `state:<sid>` o `state:<workspace>`), sembrado al iniciar sesión; botón **Reset my demo**; los mocks de Mailbox/WhatsApp también por sesión | PR, VT, S | 5 | 2–3 | Hoy todos los jurados comparten una cola que ya está procesada: la guía y el video no se pueden reproducir. Es la causa más probable de una mala primera impresión |
| 2 | `feat/real-escalation-email` | Al **escalar** o **frenar por cambio de cuenta**: correo real al aprobador (enlace firmado HMAC de un solo uso para aprobar o rechazar, con la evidencia) y correo de **verificación fuera de banda** al contacto registrado del proveedor (nunca al remitente). Cloudflare Email Service (`send_email` binding; destinatarios arbitrarios requieren Workers Paid: https://developers.cloudflare.com/email-service/platform/pricing/). Detrás de `EMAIL_ENABLED=1`; sin flag queda en el log como «enviado (simulado)» | IR, IN, PR | 5 | 3–4 | Es la lección que más pesó en el podio anterior («algo real fuera de la pantalla») y es literal en el reto: «pide permiso si se sale de reglas» |
| 3 | `feat/honest-kpis` | En el encabezado y en el marcador del stress: **autonomía correcta** (decisiones correctas sin humano / total), **frenados falsos**, **tasa de escalamiento**, **tiempo a decisión** p50/p95, **costo por factura** estimado (tokens × precio + Workers) | A, S, PR, IR | 4 | 1,5–2 | El jurado de Blinka mide autonomía; la definición actual cuenta un frenado incorrecto como autónomo |
| 4 | `feat/blinka-rails-adapter` | Mock «Blinka Payments» como servicio aparte (igual que Mailbox): `POST /blinka/api/payment-intents` con `Idempotency-Key`; mapea moneda a riel (COP transferencia, BRL Pix, MXN, PEN, CLP), estados `created → submitted → settled`; botón «Send approved to Blinka (sandbox)» además de pain.001 | VI, IR | 4 | 2–3 | «Conectar, no reemplazar» con el sistema del sponsor. Rieles tomados de https://blinka.co/ |
| 5 | `feat/audit-export-mix` | Export CSV/JSON del log (razón, reglas, evidencia, quién y cuándo); selector de mezcla en stress («realista» 80/20 vs «trampas») | E, A, VT | 3 | 1,5 | Conciliación y auditoría son el dolor de «concilia en Excel» del reto |
| 6 | `feat/fx-dated` | Tabla FX con fecha y fuente visibles; actualizarla (hoy COP = 0,00025 USD, ~4.000 COP/USD; la tabla de Ramp muestra 0,000329 hoy: https://ramp.com/international-payments-pricing) | VT, S | 2 | 0,5 | Límites en USD mal convertidos cambian decisiones |
| 7 | `feat/ap2-mandate` | Exportar las reglas vigentes como mandato estilo AP2 (JSON firmado) | IN | 2 | 1 | Innovación barata; solo si sobra tiempo |
| 8 | `feat/webhooks` | Webhooks de los mocks en vez de polling | VT | 2 | 2 | No cambia lo que ve el jurado |
| — | `feat/durable-object-state` | Estado por tenant en Durable Object | VT | 3 | 4–6 | **No antes del freeze** (lección: no tocar infra cerca del cierre). Va al RUNBOOK |

## Tareas obligatorias que no son funciones (ya, en `docs/` o `README.md`)
- Encabezado del README: URL en vivo, `docs/JUDGE-GUIDE.md`, video de 3 min, badge de CI, «Node ≥ 22», tabla real vs simulado; quitar `src/ports/` de la lista del repo.
- PITCH y VIDEO-SCRIPT: cifra IC3 **2025** (US$3.046.598.558 en BEC, 24.768 denuncias): https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf
- DATASET.md: 29 curadas (no 26); PITCH: 29 + 600 = 629 (coincide con los tests).
- Reset de la demo en vivo justo antes de grabar y otra vez antes de enviar.
- Video de 3 min, descripción en HackRadar (`docs/SUBMISSION.md`), commit congelado en la descripción.

## Orden sugerido del día (ECT)
| Bloque | Trabajo |
|---|---|
| 09:00–12:00 | #1 sandbox (preview → merge) + tareas obligatorias de docs |
| 12:00–16:00 | #2 correo real (preview → merge) |
| 16:00–17:30 | #3 KPIs; mentoría de pitch o de Blinka (anotar la cita) |
| 17:30–20:00 | #4 adaptador Blinka |
| 20:00–22:00 | Grabar el video sobre una demo reseteada; #5 si sobra tiempo |
| Dom 07:00–10:00 | Solo arreglos verificados, descripción, envío ≤ 11:00 |
