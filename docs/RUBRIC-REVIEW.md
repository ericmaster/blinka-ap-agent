# Clearhold · Revisión contra la rúbrica (sáb 17 oct 2026, 03:00 ECT)

Estado revisado: `main` @ `ec3e569` (vie 16 oct 19:57 ECT) y el deploy en vivo https://blinka-ap-agent.ericmaster.workers.dev.
Deadline: **dom 18 oct, 11:59 ECT** (freeze recomendado dom 10:00). Fuentes de la rúbrica: `/workspace/scratch/30x/BRIEF.md` [K = kickoff 30:00–32:00] y `RETOS.md`.

## 0. Qué se verificó (no son supuestos)
| Verificación | Resultado |
|---|---|
| `GET /` en vivo | 200, 0,15 s. Banner «synthetic data · the model can stop a payment, never approve one» presente |
| Login demo (`/api/auth/start`) | Devuelve el código en JSON (modo demo, esperado) |
| `/api/state` en vivo | Modelo «Fastino GLiDE → TypeSafe JEV»; **29 facturas ya procesadas** (10 pagar / 11 frenar / 8 escalar), autonomía 72 %, US$12.044 retenidos, 0 pagos indebidos |
| Stress en vivo, 3 × 100 facturas (semillas 111/222/333) | **0 pagos indebidos** en las 300; «autonomía» 87–88 %; explicabilidad 100 %; ~0,13 s por factura con GLiDE real |
| Carga ligera: 20 `GET /api/state` + 8 stress en paralelo | Todo 200; 0,3 s las lecturas, 1,4–2,6 s cada stress de 10 |
| `npm test` (Node 22) | **30/30 pasan**. Con Node 20 fallan 7 (unpdf necesita `Iterator` global): el README no lo advierte |
| CI GitHub (gitleaks + test + build) | Verde en los últimos 3 commits |
| Repo | Público, licencia MIT |

## 1. Puntaje actual por criterio
Escala 0–10 = mi estimación de cómo lo vería el jurado hoy. Los pesos de los tres últimos criterios no se dijeron en voz alta en el kickoff (estaban en la lámina): **? confirmar en HackRadar**. Si se reparten igual, cada uno pesa ~16,7 %.

| Criterio (peso) | Hoy | Evidencia | Brecha principal | Acción concreta para llegar al 100 % | Esfuerzo |
|---|---|---|---|---|---|
| **Impacto en el reto (30 %)** | 7,5 | Resuelve las 5 trampas del reto (duplicado, beneficiario nuevo, no cuadra, sobre límite, sin presupuesto) más cambio de cuenta, duplicado entre canales e inyección de prompt; pain.001; ES/EN/PT; KPIs en el encabezado | 1) No hay **cuantificación de valor** para un cliente de Blinka (horas, US$ por factura, riesgo evitado). 2) La escalación no **sale** de la pantalla: «pide permiso» del reto se queda en la cola. 3) El cliente de Blinka no ve dónde encaja en Blinka (rieles COP/BRL/MXN, gestión de proveedores) | a) Slide/tabla de ROI con fuentes de `MARKET.md` (US$9,84 → <US$1 por factura; 8,2 días → minutos). b) **Escalación real por correo** al aprobador con evidencia y enlace firmado de aprobar/rechazar. c) Adaptador simulado «Blinka Payments» que convierte pagos aprobados en *payment intents* por riel local | a) 45 min · b) 3–4 h · c) 2–3 h |
| **Innovación (20 %)** | 7 | «El modelo solo puede frenar, nunca pagar»; preguntas tipadas sí/no con banda de incertidumbre; bench de 4 motores con un modelo que aprobó 4 indebidos (evidencia de por qué la arquitectura importa); stress con verdad conocida en vivo; prueba con modelo «temerario» | Cuesta verlo como algo más que «otro agente de AP» (Ramp, BILL y Tipalti ya anuncian agentes de AP, ver `MARKET.md`). El diferenciador no se nombra frente a ellos | a) Un slide «ellos recomiendan, nosotros garantizamos»: los agentes de la competencia sugieren o marcan; Clearhold prueba que **ningún** modelo puede autorizar (test con modelo temerario: 600 facturas, 0 indebidos). b) **Verificación fuera de banda** del cambio de cuenta: el agente escribe al contacto registrado del proveedor, nunca al remitente (el control que recomiendan AFP/IOFM, automatizado). c) Opcional: mandato estilo AP2 en JSON | a) 30 min · b) 2 h (comparte código con 1b) · c) 1 h |
| **Viabilidad técnica** | 8 | 30 tests, CI con gitleaks, despliegue en Workers, bench reproducible, 300 facturas en vivo sin indebidos, revisión de código con críticos corregidos (control dual, guardado versionado, rate-limit de OTP, demo-off falla cerrado) | 1) **Estado global único**: todos los jurados comparten la misma cola. 2) KV con reintentos, no serialización fuerte (en backlog: Durable Object). 3) Node 22 requerido sin aviso. 4) Una sola revisión independiente (la lección pide dos) | a) Sandbox por sesión + botón «Reset my demo». b) README: «Node ≥ 22». c) Segunda revisión de `main` con otro agente, triage en `docs/reviews/` | a) 2–3 h · b) 5 min · c) 1 h |
| **Viabilidad de implementación** | 6,5 | Cloudflare serverless (~US$5/mes de base), <1 centavo de modelo por factura, salida ISO 20022 que un banco entiende, adaptadores de modelo, conectores con contrato (`CONNECTORS.md`), no se ata a ningún ERP | No hay **plan de piloto** con fases, gates y rollback; no hay ruta a SSO/auditoría/SOC 2; integración con Blinka solo narrada | a) `docs/RUNBOOK-PRODUCTION.md` (este PR) enlazado desde el README y en 1 slide: «piloto en sombra de 6 semanas con 3 clientes de Blinka». b) Adaptador Blinka simulado (ver Impacto c) | a) hecho en este PR · b) 2–3 h |
| **Presentación** | 6 | PITCH de 5 slides con cifra del FBI, guion de 3 min, JUDGE-GUIDE de 2 min, capturas, video de respaldo de 55 s, banner de datos sintéticos | 1) **Falta el video de 3 min.** 2) La guía del jurado ya no coincide con el estado en vivo: la demo guiada **ya corrió** (el botón «Run guided demo» no aparece) y «Process N new» no tiene nada nuevo. 3) README sin URL en vivo, sin enlace a la guía ni al video, sin badge de CI, y menciona `src/ports/`, que se borró. 4) La cifra del FBI es la de 2024; ya salió la de 2025. 5) Los números del dataset no coinciden (DATASET dice 26 curadas; hay 29) | a) Grabar el video sobre una demo reseteada (sáb, después del sandbox). b) Encabezado del README: URL, guía, video, badge CI, real vs simulado. c) Actualizar a IC3 2025: **US$3.046 millones, 24.768 denuncias de BEC**. d) Alinear 29/600/629 en DATASET, PITCH, README | a) 2 h · b) 30 min · c) 15 min · d) 15 min |

**Riesgo de descalificación «repo ≠ demo» [K 30:00]:** hoy es bajo, pero la deriva de docs (README `src/ports/`, conteos del dataset) y una guía que no se puede reproducir en el estado en vivo son justo lo que un prejurado nota. Arreglar antes del freeze.

## 2. Criterios específicos de Blinka (RETOS.md)
| Criterio | Hoy | Evidencia | Brecha | Acción | Esfuerzo |
|---|---|---|---|---|---|
| **Autonomía** | 7 | En vivo 72 % (decidido por el agente sin humano); en stress 87–88 % | 1) La métrica cuenta como «autónomo» cualquier pagar/frenar, **aunque el frenado sea incorrecto**. Un jurado técnico lo va a preguntar. 2) No se muestran **frenados falsos** (facturas válidas frenadas o escaladas), que es el costo de la seguridad. 3) El generador de stress trae muchas trampas (68–75 % frenadas), así que el número de autonomía no representa una mezcla real | a) Definir **autonomía correcta** = decisiones correctas sin humano / total, y mostrar aparte **frenados falsos** y **tasa de escalamiento** en el marcador del stress y en el encabezado. b) Selector de «mezcla realista» en stress (p. ej. 80 % limpias / 20 % trampas) con la fuente del supuesto (excepciones promedio 18,4 %, Ardent 2025) | a) 1,5 h · b) 45 min |
| **Seguridad (un pago indebido descalifica)** | 9 | 0 indebidos en: curadas, 5 semillas × 60, modelo temerario 10 × 60 = 600, y 300 en vivo hoy. Control dual en cambios de cuenta y términos, approve re-verifica reglas, inyección → frenar, homoglifos, montos ambiguos → null | 1) Cualquiera entra con cualquier correo y comparte estado: un jurado puede editar un proveedor y ver cómo otro aprueba algo (el control dual lo frena, pero ensucia la demo). 2) Endpoints de escritura de los mocks y `/api/reset` global sin aislamiento | Sandbox por sesión (la misma acción de Viabilidad técnica a). Mantener el «try to break it» de la guía, porque el jurado de Blinka lo va a intentar | incluido |
| **Explicabilidad** | 9 | Razón en una línea por decisión, evidencia por campo con su span, reglas que pasaron y que fallaron, historial de quién y cuándo, traducción | El detalle no se puede **exportar** como auditoría (CSV/JSON); no hay una vista «por qué se pagó» tan visible como «por qué se frenó» | Export CSV/JSON del log con razón, reglas y quién aprobó (sirve también para la conciliación) | 1 h |
| **Métricas de éxito del brief** (problema con número, KPI en la app, acción real saliente, wow en el primer minuto) | 7 | Número del FBI ✓, KPI en el encabezado ✓, wow: trampa frenada antes del minuto 1:15 del guion ✓ | **Acción real saliente ✗** (correo o WhatsApp de verdad) | Escalación por correo real (Impacto b) | 3–4 h |

## 3. Checklist de entregables (HackRadar)
| Ítem | Estado | Acción |
|---|---|---|
| Nombre | ✓ «Clearhold by Blinka» | «by Blinka» puede leerse como producto oficial de Blinka. Decir en la descripción que es una propuesta para el reto Blinka (ya está en `SUBMISSION.md`) |
| Reto | ✓ Blinka | — |
| Descripción ≤ 5000 caracteres | Borrador en `docs/SUBMISSION.md`: 4.456 caracteres (contado con script) | Revisar cifras y pegar |
| Repo público = demo | ✓ público, MIT, CI verde | Arreglar la deriva del README/DATASET; congelar el deploy en el mismo commit del video; poner el commit en la descripción |
| Video de 3 min | ✗ (solo respaldo de 55 s) | Grabar sáb tarde o noche sobre una demo reseteada; subir como no listado a YouTube; enlazar desde el README |
| URL de la demo | ✓ 200 | Mantenerla viva hasta el mié 21 (ganadores) y no cambiar de cuenta. Resetear antes de enviar y antes del Demo Day |
| Licencia | ✓ MIT | — |
| Secretos fuera del repo | ✓ gitleaks en CI; claves por `wrangler secret` | — |

## 4. Lecciones del evento anterior que todavía faltan
Fuentes: `hackathon-kit/LESSONS.md`, `PLAYBOOK.md`, `ARCHITECTURE.md`, `hackathon-teams/REPORTE.md`.
| Lección | Estado | Qué hacer |
|---|---|---|
| **Una acción real fuera de la pantalla** (CuyOS envió WhatsApp de verdad) | ✗ Falta | Correo real al aprobador cuando se escala o se frena, y verificación fuera de banda del cambio de cuenta (Cloudflare Email Service, `send_email` binding) |
| **Botón «reiniciar demo» / datos en 1 clic** (ARCHITECTURE §9) | ✗ Falta, y el estado es compartido | Sandbox por sesión + «Reset my demo» |
| **Guía del jurado reproducible** | ⚠️ Escrita, pero no se reproduce sobre el estado en vivo actual | Depende del sandbox |
| **Validación citada** del mentor o sponsor (Technoloqie) | ✗ Falta | Pedir hoy una mentoría de 15–30 min en HackRadar → Mentores (ideal: alguien de Blinka). Anotar una frase textual y ponerla en el slide 5 |
| **Dos reviews independientes** | ⚠️ Una (16 oct, Cursor) | Segunda revisión de `main` con otro agente, solo lectura; triage verificado |
| **Pedido de piloto concreto al cierre** («piloto en N semanas») | ⚠️ El cierre es una pregunta | Cerrar con: «Piloto en sombra de 6 semanas con 3 clientes de Blinka; gate: 0 pagos indebidos» (RUNBOOK) |
| **README para jueces arriba** (URL, video, capturas, real vs simulado, badge CI) | ⚠️ Parcial | Encabezado del README |
| **Load test con jueces virtuales** | ✓ ligero hoy (20 + 8 en paralelo, todo 200) | Repetir después del sandbox (más escrituras a KV) |
| **Video y capturas versionados** (las demos mueren) | ✓ respaldo de 55 s + 11 capturas | Agregar el video final de 3 min (enlace) |
| **Puente entre retos/sponsors** | ✓ implícito: JEV (reto de 30X) es el respaldo | Decirlo en voz alta en el pitch y la descripción |
| **Problema con número / KPI en la app / badge de datos simulados** | ✓ | Actualizar el número a IC3 2025 |
| **Construye en público** (premio extra de Instagram) | ? | 1 carrusel en el feed con la factura trampa frenada + cifra FBI, link al grupo de WhatsApp «Construye en público» |
| **Mentoría de pitch sábado tarde** | ? | Ir con el video en borrador |
| **Contrato OpenAPI / PII fuera de logs** (técnica de CuyOS) | ✗ | No para hoy; en RUNBOOK (producción) |
| **No tocar deps core ni infra cerca del freeze** | — | Durable Objects **no** antes del domingo; queda en RUNBOOK |

## 5. Backlog priorizado para hoy (sábado)
Detalle con ramas y endpoints de preview en `docs/BACKLOG-SATURDAY.md`. Orden por (impacto en la rúbrica × probabilidad de terminarlo) / esfuerzo:
1. **Sandbox por sesión + «Reset my demo»** (Presentación, VT, Seguridad): 2–3 h.
2. **Escalación y verificación por correo real** (Impacto, Innovación, lección «acción real»): 3–4 h.
3. **KPIs completos y honestos**: autonomía correcta, frenados falsos, tasa de escalamiento, tiempo a decisión, costo por factura (criterios de Blinka): 1,5–2 h.
4. **Adaptador simulado de Blinka Payments** con rieles por moneda e idempotencia (Implementación, Impacto): 2–3 h.
5. **Export de auditoría CSV/JSON + mezcla realista en stress** (Explicabilidad, Autonomía): 1,5 h.

Obligatorio que no es una función: README arriba, IC3 2025, alinear conteos, video de 3 min, descripción en HackRadar, reset de la demo antes de enviar.
