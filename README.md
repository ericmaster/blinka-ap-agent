# Blinka AP Agent · Nimble

**ES** — Agente de cuentas por pagar para el reto **Blinka** (30X Hackathon). Recibe facturas por PDF, imagen, correo o chat, extrae beneficiario, monto, moneda y vencimiento, y decide **pagar / frenar / escalar** con reglas configurables, registro explicable y tablero. El modelo nunca autoriza un pago: las reglas duras viven en código y la duda se escala.

**EN** — Accounts-payable agent for the **Blinka** challenge (30X Hackathon). Ingests invoices from PDF, image, email or chat, extracts payee, amount, currency and due date, and decides **pay / hold / escalate** under configurable rules, with an explainable log and a dashboard. The model never authorizes a payment: hard rules live in code; uncertainty (p 0.2–0.8) or any error escalates. Output is a standard **ISO 20022 pain.001** file — no money moves.

## Arquitectura / Architecture
Reglas deterministas → GLiDE (Fastino, principal) → JEV (respaldo) → pagar · frenar · escalar → log + tablero → pain.001. Detalle: [`docs/SPEC.md`](docs/SPEC.md).

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
- `src/ports/` — patrón port/adapter (real vs fake via `ADAPTER_MODE`)

Datos 100% ficticios / fully synthetic data. Licencia MIT.
