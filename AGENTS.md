# AGENTS.md
- Qué: agente de cuentas por pagar (pagar/frenar/escalar) · Reto: Blinka · Freeze: dom 18 oct 10:00 ECT (deadline 11:59)
- Rúbrica: Impacto 30%, Innovación 20%, Viabilidad técnica, Implementación, Presentación · Métricas Blinka: Autonomía, Seguridad, Explicabilidad
- Stack: Node 22 ESM, Cloudflare Worker + KV + Workers AI, unpdf, tesseract.js; tests node:test  · Real vs simulado: ver docs/SPEC.md
## Reglas no negociables
- Nada de secretos en el repo; `.env` gitignored; repo será público.
- Solo datos sintéticos. Sin PII en logs ni prompts.
- Sistemas externos solo vía `src/adapters/*` y conectores (`docs/CONNECTORS.md`).
- Tareas chicas, commits cortos, tests con cada cambio; CI verde antes de seguir.
- No cambiar deps core/infra tras el checkpoint 2. Nada no verificado entra.
- Seguir docs/SPEC.md; si falta una decisión, preguntar, no improvisar.
