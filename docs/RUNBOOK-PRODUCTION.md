# Runbook: del prototipo a producción en Blinka

Para el CTO de Blinka: qué cambia, en qué orden, cómo se mide y cómo se vuelve atrás. Supuesto: Clearhold corre como servicio de Blinka (o de un socio) para clientes de Blinka. **No mueve dinero:** produce instrucciones de pago que Blinka ejecuta por sus rieles. KYC, AML/OFAC y la custodia siguen siendo de Blinka y de su banco socio (Portage Bank, según https://blinka.co/).

## 1. Principios que no cambian
1. **El modelo nunca autoriza un pago.** Solo responde preguntas tipadas sí/no; las reglas en código deciden; ante duda o error, se escala. Cada release corre la suite con un modelo «temerario» (siempre «sí», p = 1) y tiene que dar 0 pagos indebidos.
2. **Fallar cerrado.** Cualquier error de extracción, modelo, conector, FX o estado se convierte en escalar, nunca en pagar.
3. **Contenido de entrada = datos.** El texto de facturas, correos y chats nunca es instrucción.
4. **Separación de funciones.** Quien cambia datos maestros de un proveedor no puede aprobar su pago; los cambios de cuenta y de términos requieren a una segunda persona (ya implementado) y verificación fuera de banda.

## 2. Cambios de arquitectura
| Hoy (prototipo) | Producción | Por qué |
|---|---|---|
| Un solo registro en KV con guardado versionado y reintento | **Un Durable Object por tenant** (SQLite): ledger, presupuesto, ventana de duplicados, registro de proveedores y cola de aprobación serializados. KV solo para caché de lectura | Elimina carreras entre presupuesto y duplicados (crítico #2 de la revisión de código). Precios: https://developers.cloudflare.com/workers/platform/pricing/ |
| Ingesta por polling a mocks | **Queues** para ingesta con reintentos y *dead-letter*; idempotencia por `message-id` y huella del documento | Picos de fin de mes; ninguna factura se pierde ni entra dos veces |
| Documentos en el estado | **R2** cifrado por tenant; retención configurable; hash SHA-256 del original en el registro | Evidencia para auditoría; el original nunca se modifica |
| Correo simulado | Entrada: Cloudflare Email Routing → Email Worker en un buzón dedicado (`ap@cliente…`), o Gmail / Microsoft 365 por OAuth con permiso de solo lectura en una etiqueta. Salida: Cloudflare Email Service (`send_email`) con SPF/DKIM/DMARC del dominio | Conectar al buzón que el cliente ya usa |
| WhatsApp simulado | **WhatsApp Business Cloud API**: webhook con verificación de firma `X-Hub-Signature-256`; plantillas *utility* para pedir aprobación; número verificado por tenant. Precio por mensaje según país y categoría (verificar la tabla vigente: https://whatsappbusiness.com/products/platform-pricing/) | En LatAm las facturas y las aprobaciones llegan por WhatsApp |
| OTP de demo en pantalla | **SSO** OIDC/SAML (Google Workspace, Microsoft Entra, Okta) delante con Cloudflare Access o en la app; **passkeys (WebAuthn) como *step-up*** para aprobar por encima del umbral y para confirmar cambios de cuenta | Identidad del aprobador = control clave contra BEC |
| Un rol | **RBAC**: AP clerk (carga y revisa), aprobador (con límite propio en USD), admin de proveedores, auditor (solo lectura). Límites de aprobación por usuario | Matriz de autorización que pide cualquier auditor |
| Salida pain.001 descargable | **Adaptador de pagos de Blinka** (API de *payment intents* con `Idempotency-Key`, riel por moneda: COP, BRL Pix/TED, MXN, PEN, CLP, ARS) + export **ISO 20022 pain.001.001.09** para bancos; ingesta de estado **pain.002** y extractos **camt.053/054** para conciliar | Cerrar el ciclo «pagar → conciliar» sin Excel |
| FX fijo de demo | FX de Blinka con fuente, hora y validez; límites evaluados en USD a esa tasa; si la tasa vence → escalar | Un límite mal convertido cambia decisiones |
| Log en el estado | **Auditoría append-only** con hash encadenado (cada entrada incluye el hash de la anterior), copia diaria a R2 con retención; export CSV/JSON | Inmutabilidad verificable |
| Claves por `wrangler secret` | Secretos por entorno (Workers Secrets / Secrets Store), rotación cada 90 días, claves de API por tenant con alcance mínimo; nada en logs | — |
| Logs de Workers | **Logpush** a SIEM; logs JSON sin PII (redacción de cuentas, correos y teléfonos antes de loguear y antes de mandar texto al modelo) | Ley 1581 (CO), LGPD (BR), LFPDPPP (MX); minimización |
| Bench y stress manuales | **Gate de evaluación por release**: curadas + stress de 5+ semillas + *red team* (inyección, homoglifos, duplicados entre canales, cambio de cuenta) + modelo temerario; bloquea el deploy si hay ≥ 1 indebido | Calidad como código |

### Monitoreo y alertas (SLOs)
- **Seguridad:** cualquier `pay` que luego un humano revierte → P1, *kill switch* automático del tenant y revisión.
- **Deriva del modelo:** tasa de escalamiento o frenados falsos ± 2σ sobre la semana anterior → alerta; latencia p95 del modelo > 2 s o error > 1 % → cambiar a respaldo (GLiDE → JEV) y, si fallan ambos, escalar todo.
- **Disponibilidad:** API 99,9 % mensual; ingesta sin pérdida (cola con DLQ vigilada); tiempo a decisión del agente p95 < 10 s.
- **Panel del cliente:** pagos indebidos, autonomía correcta, escalamientos, frenados falsos, US$ retenidos, tiempo a decisión, costo por factura (definiciones en `MARKET.md` §5).

### Controles tipo SOC 2 (mapa mínimo)
| Área (criterios comunes) | Control |
|---|---|
| CC6 Acceso lógico | SSO + MFA/passkeys, RBAC, revisión trimestral de accesos, offboarding automático por SCIM |
| CC7 Operación del sistema | Logpush + alertas, gestión de incidentes con *runbooks*, pruebas de restauración de R2 y DO |
| CC8 Gestión de cambios | PR con revisión obligatoria, CI (gitleaks, tests, gate de evaluación), despliegue gradual por versiones, rollback documentado |
| CC9 Riesgo de proveedores | Inventario de subprocesadores (Cloudflare, Fastino, TypeSafe, Meta/WhatsApp), DPA firmados, alternativa por proveedor de modelo |
| Integridad de procesamiento | Idempotencia en todo lo que muta, conciliación diaria pain.002/camt contra el ledger, auditoría encadenada |
| Confidencialidad / privacidad | Cifrado en tránsito y reposo, aislamiento por tenant, retención y borrado configurables, redacción de PII |

## 3. Fases del piloto (semanas desde el sí de Blinka)
| Fase | Semanas | Qué pasa | Gate para pasar a la siguiente |
|---|---|---|---|
| **0 · Endurecer** | 1–3 | Durable Objects por tenant, SSO + RBAC, R2, auditoría encadenada, conectores reales de correo (1 buzón) y WhatsApp (1 número), adaptador Blinka en sandbox, gate de evaluación en CI, revisión de seguridad externa | Pen test sin hallazgos críticos o altos abiertos; gate de evaluación verde; DPA con subprocesadores |
| **1 · Sombra** | 4–7 | 3 clientes de Blinka (10–50 proveedores en LatAm cada uno). Clearhold lee facturas reales y decide, **pero no crea nada**; el equipo del cliente sigue como hoy. Se compara cada decisión contra lo que hizo el humano | 0 pagos indebidos en la comparación; frenados falsos ≤ 10 %; ≥ 500 facturas o 4 semanas; la revisión de los discrepantes muestra que el agente tenía razón o escaló |
| **2 · Asistido** | 8–11 | Clearhold prepara *payment intents* en Blinka; **todo** lo aprueba un humano con un clic (correo/WhatsApp/app). Se mide tiempo a decisión y carga del equipo | 0 indebidos; autonomía correcta ≥ 50 %; aprobación humana < 1 día hábil; NPS del controller ≥ 8 |
| **3 · Autonomía limitada** | 12–15 | Pago automático **solo** si: proveedor registrado ≥ 60 días, cuenta sin cambios en 30 días, monto ≤ US$2.000 (o el umbral del cliente) y dentro del contrato, tope diario por tenant. Todo lo demás se escala | 0 indebidos; frenados falsos ≤ 5 %; escalamiento ≤ 25 %; conciliación diaria sin diferencias |
| **4 · GA** | 16+ | Umbrales configurables por cliente; incorporación por autoservicio desde Blinka | Métricas de §2 estables 4 semanas; controles SOC 2 operando (preparar Tipo I, luego Tipo II) |

## 4. Riesgos y mitigación
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Un pago indebido real | Pérdida de dinero y de confianza | Reglas en código, modelo solo frena, control dual, verificación fuera de banda, topes diarios, autonomía por fases, seguro/limitación contractual |
| Toma de cuenta del aprobador (BEC interno) | Aprobación fraudulenta | SSO + passkeys de *step-up*, enlaces de aprobación firmados y de un solo uso, aviso al segundo aprobador |
| Deriva o caída del proveedor de modelo | Más escalamientos, latencia | Cadena de respaldo, banda de incertidumbre, gate de evaluación por versión, versión del modelo fijada |
| Extracción mala en facturas reales (fotos, escaneos) | Escalamientos | OCR en el servidor con confianza; baja confianza → escalar; dataset de facturas reales anonimizadas por cliente |
| Frenados falsos que molestan a proveedores | Relación con el proveedor, retrasos | KPI visible, revisión semanal de reglas, SLA humano |
| Cambios regulatorios o de datos personales en LatAm | Cumplimiento | Minimización, DPA, residencia de datos configurable, retención y borrado |
| Dependencia de WhatsApp / Meta | Canal caído o tarifas | Correo como canal principal de respaldo; plantillas mínimas |

## 5. Rollback
1. **Kill switch por tenant o global** (`AUTONOMY=off`): todas las decisiones pasan a escalar en segundos; no requiere deploy.
2. **Rollback de código:** despliegue gradual por versiones de Workers; volver a la versión anterior con `wrangler rollback` (o el panel) en < 5 min.
3. **Rollback de reglas:** reglas versionadas con autor y fecha; restaurar la versión anterior desde la auditoría.
4. **Pagos en vuelo:** los *payment intents* tienen `Idempotency-Key`; si se revierte una versión, los que no se enviaron quedan en «pendiente de humano»; los ya enviados se concilian con pain.002/camt y, si corresponde, se pide su cancelación o recall a Blinka.
5. **Datos:** snapshots diarios del DO a R2; restauración probada una vez por fase.

## 6. Costo operativo estimado (orden de magnitud)
- Workers Paid: desde US$5/mes con 10 M de requests y 30 M ms de CPU incluidos; DO, Queues y R2 con cuota incluida (https://developers.cloudflare.com/workers/platform/pricing/).
- Modelo de decisión: ~US$0,0001 por factura (bench GLiDE: US$0,0031 por 30 facturas, `bench/RESULTS.md`).
- Correo saliente y WhatsApp: según la tarifa vigente de cada proveedor **[?] verificar al contratar**.
- Conclusión: el software cuesta centavos por factura; el costo dominante sigue siendo el tiempo humano de las escaladas, por eso la meta de autonomía correcta.
