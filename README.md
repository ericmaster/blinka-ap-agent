# Blinka AP Agent · Nimble

**ES** — Agente de cuentas por pagar para el reto **Blinka** (30X Hackathon). Recibe facturas por PDF, imagen, correo o chat, extrae beneficiario, monto, moneda y vencimiento, y decide **pagar / frenar / escalar** con reglas configurables, registro explicable y tablero. El modelo nunca autoriza un pago: las reglas duras viven en código y la duda se escala.

**EN** — Accounts-payable agent for the **Blinka** challenge (30X Hackathon). Ingests invoices from PDF, image, email or chat, extracts payee, amount, currency and due date, and decides **pay / hold / escalate** under configurable rules, with an explainable log and a dashboard. The model never authorizes a payment: hard rules live in code; uncertainty (p 0.2–0.8) or any error escalates. Output is a standard **ISO 20022 pain.001** file — no money moves.

## Arquitectura / Architecture
Reglas deterministas → GLiDE (Fastino, principal) → JEV (respaldo) → pagar · frenar · escalar → log + tablero → pain.001. Detalle: [`docs/SPEC.md`](docs/SPEC.md).

## Uso / Usage
```bash
npm ci && npm test                       # 0 pagos indebidos / zero improper payments (fake model)
node scripts/run.mjs data/curated        # decisions.jsonl, log.md, pain001.xml en out/
FASTINO_API_KEY=... JEV_API_KEY=... node scripts/run.mjs data/curated --real   # GLiDE → JEV
```
Reglas configurables: [`config/rules.json`](config/rules.json). Extracción: [`docs/EXTRACTION.md`](docs/EXTRACTION.md). Datos: [`docs/DATASET.md`](docs/DATASET.md).

## Dashboard
```bash
npm ci && npm run build && npm start      # http://localhost:8796  (FASTINO_API_KEY / JEV_API_KEY optional; without them every invoice escalates)
```
Pendientes / pagadas / frenadas con el porqué, aprobar o rechazar (la aprobación vuelve a verificar las reglas duras), reglas editables, carga de correo/chat/PDF/imagen (OCR en el navegador), prueba de estrés con Autonomía · Pagos indebidos · Explicabilidad, descarga pain.001.
Cloudflare Workers: `wrangler.toml` (KV `STATE`), `npx wrangler secret put FASTINO_API_KEY`, `npx wrangler deploy`.

## Evidencia / Evidence
[`bench/RESULTS.md`](bench/RESULTS.md): 30 facturas sintéticas — GLiDE 100% decisiones correctas, **0 pagos indebidos**.

```bash
cd bench && python3 -m venv .venv && .venv/bin/pip install requests  # if needed
export FASTINO_API_KEY=... JEV_API_KEY=...   # never commit keys
.venv/bin/python bench.py rules glide jev
```

## Repo
- `docs/` — SPEC, PROPUESTA (propuesta de valor, Lean Canvas, MoSCoW), canvas.html/png, PITCH, JUDGE-GUIDE
- `bench/` — bench de modelos de decisión y resultados
- `src/` — `extract/` (texto, PDF, OCR), `engine/` (reglas), `adapters/` (GLiDE, JEV, fakes), `output/` (pain.001), `gen/` (generador)
- `src/ports/` — patrón port/adapter (real vs fake via `ADAPTER_MODE`)

Datos 100% ficticios / fully synthetic data. Licencia MIT.
