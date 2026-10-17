# Blinka · bench de modelos de decisión

> Bench histórico de selección de modelo (dataset anterior). El producto usa el dataset Northwind LatAm de `docs/DATASET.md`.

Datos 100% ficticios: 30 facturas de *Panadería Andina SAS*, 8 proveedores con acuerdos, reglas en `data.py`.
Verdad: 14 pay / 13 hold / 3 escalate. Trampas: 3 duplicados difusos + 1 exacto, 2 proveedores nuevos, 1 cuenta bancaria cambiada, 5 que no cumplen el acuerdo, 1 sobre el límite por pago, topes por proveedor y presupuesto.
El código aplica las reglas duras (límites, sumas, presupuesto, beneficiarios, cuentas, duplicado exacto). Los modelos sólo responden 2 preguntas noul por factura (`is_duplicate`, `matches_agreement`). Un modelo nunca puede autorizar un pago que las reglas bloquean; con p entre 0.2 y 0.8 la factura se escala.

| Modelo | Acc. decisión | Acc. preguntas | Brier | p50 ms | p95 ms | Costo 30 fact. | **Pagos indebidos** | Pagos bloqueados de más |
|---|---|---|---|---|---|---|---|---|
| Fastino GLiDE (API) | 100% | 100% | 0.004 | 373 | 466 | $0.0031 | 0 | 0 |
| JEV jev-latest (reseller) | 93% | 100% | 0.025 | 808 | 876 | $0.0082 | 0 | 2 |
| GLiNER-2.5-Decide (API Fastino) | 67% | 86% | 0.119 | 732 | 834 | n/d (8378 tok) | **4** (F09, F14, F18, F27) | 4 |
| GLiNER2.5-Decide (local CPU, 8 vCPU) | 50% | 62% | 0.193 | 650 | 1655 | $0 | 0 | 14 |
| Solo reglas (sin modelo) | 43% | 50% | 0.250 | 0 | 0 | $0 | 0 | 14 |

Latencia = un request por factura con 2 preguntas (GLiNER: 2 llamadas o pasadas, una por pregunta). Precios: GLiDE $0.15/M tokens de entrada, JEV reseller $0.42/M. No encontré la tarifa de GLiNER API.

## Recomendación
- **Fastino GLiDE como motor principal.** Acertó 100% de las decisiones con 0 pagos indebidos, tiene la mejor calibración (Brier 0.004) y la menor latencia de los modelos remotos (p50 ~0.35 s). El costo es despreciable (~$0.0001 por factura).
- **JEV de respaldo.** Respondió bien todas las preguntas, pero con probabilidades menos extremas (0.2–0.45 en algunos casos que no eran duplicados), así que 2 pagos válidos terminaron escalados. Es seguro pero más lento (~0.8 s), y la clave pasa por un revendedor no oficial.
- **No usar GLiNER-2.5-Decide para estos juicios.** Por API aprobó 4 pagos indebidos (falló en detectar facturas que no cumplen el acuerdo y un duplicado, con alta confianza). En local no causó daño, pero tampoco aprobó ningún pago válido (siempre dudoso o 'duplicado'). Sirve para clasificar texto, no para comparar contra un acuerdo.
- Lección de seguridad: la franja de incertidumbre no protege de un modelo que se equivoca con seguridad. Para la demo: GLiDE + reglas duras, y ante cualquier error del modelo o de la API, escalar (ya implementado: si hay error, p=0.5 → escalate).

Reproducir: `.venv/bin/python bench.py rules glide jev gliner_api gliner_local` (claves en env). Detalle por factura (acción + razones = log explicable) en `results/*.json`.
