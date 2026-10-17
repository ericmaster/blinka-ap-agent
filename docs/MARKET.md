# Estudio de mercado: automatización de cuentas por pagar y pagos B2B de EE. UU. a LatAm

Revisado sáb 17 oct 2026. **Regla:** solo cifras con su fuente y su URL, verificadas en la página o el PDF original ese día. Lo marcado **[?]** no está verificado o es una estimación propia; lo marcado **[cálculo]** es aritmética sobre una cifra citada.

## 1. Tamaño de mercado

### Software de automatización de cuentas por pagar (global)
Los informes no coinciden. Hay que mostrar el rango, no una cifra única.
| Fuente | Cifra | URL |
|---|---|---|
| Grand View Research | US$3,1 mil millones (2023) → US$4,2 mil millones (2026) → US$7,0 mil millones (2030), CAGR 12,5 % 2024–2030; Norteamérica 33,2 % en 2023 | https://www.grandviewresearch.com/industry-analysis/accounts-payable-automation-market-report |
| The Business Research Company | US$5,42 mil millones (2025) → US$6,57 mil millones (2026) → US$14,38 mil millones (2030) | https://www.thebusinessresearchcompany.com/report/accounts-payable-automation-global-market-report |
| GII / Global Industry Analysts | US$3,5 mil millones (2023) → US$6,8 mil millones (2030); EE. UU. US$909,7 millones (2023) | https://www.giiresearch.com/report/go1480680-accounts-payable-automation.html |

Lectura: es un mercado de software de un dígito de miles de millones que crece entre ~10 % y ~20 % anual según quién lo mida. Para el pitch alcanza con «miles de millones y creciendo a dos dígitos».

### Pagos transfronterizos B2B
| Métrica | Cifra | Fuente |
|---|---|---|
| Flujos B2B transfronterizos (global, 2025) | **US$34,8 billones** (*trillion*); US$51,2 billones en 2033 (CAGR 4,9 %) | FXC Intelligence, 5 mar 2026: https://www.fxcintel.com/research/reports/how-big-is-the-b2b-cross-border-payments-market |
| De eso, pymes (SMB) | **US$14,4 billones** en 2025 (bienes US$10,6 + servicios US$3,8) | ídem |
| Ingresos de proveedores por B2B pyme | **US$191 mil millones**, el mayor *revenue pool* minorista; *take rate* B2B pyme **1,3 %** (gran empresa 0,2 %) | ídem |
| Ingresos por pagos transfronterizos en LatAm (todas las categorías, 2025) | **US$30.690 millones**; B2B = **75,63 %**; US$52.478 millones en 2033 (CAGR 7,4 %) | Grand View Horizon (jun 2026): https://www.grandviewresearch.com/horizon/outlook/cross-border-payments-market/latin-america |
| Ingresos B2B transfronterizos en LatAm | ≈ **US$23.200 millones** (30.690 × 75,63 %) | **[cálculo]** sobre Grand View |
| Corredor EE. UU. → LatAm, solo B2B pyme | **No encontré una cifra pública confiable** | **[?]** pedirla a FXC o a Blinka |

### Costo y velocidad hoy (por qué el dolor existe)
| Métrica | Cifra | Fuente |
|---|---|---|
| Meta G20 para pagos minoristas (incluye B2B) a fines de 2027 | costo promedio ≤ **1 %**, ningún corredor > 3 %; **75 %** acreditado en ≤ 1 hora, el resto en ≤ 1 día hábil | FSB: https://www.fsb.org/work-of-the-fsb/financial-innovation-and-structural-change/cross-border-payments/g20-targets-for-enhancing-cross-border-payments-2/ |
| Costo promedio global de un pago B2B (pyme) 2025 | **1,6 %** (sin cambio vs 2024); FX = 87 % del costo | FSB, *Consolidated progress report 2025* (9 oct 2025), tablas KPI: https://www.fsb.org/uploads/P091025-1.pdf |
| Pagos minoristas enviados **desde Norteamérica** | costo promedio **≥ 3 %** (salvo P2B); **< 3 %** de los pagos B2B/B2P acreditados en 1 hora | ídem, §3.4.5 |
| Pagos B2B enviados desde LatAm | **ningún** servicio acreditó en 1 hora; solo **44,5 %** en 1 día (2024) | ídem, §3.4.3 |

## 2. Competidores
| Empresa | Qué hace para este cliente | Escala (cifra y fuente) | Agentes / IA | Hueco para Clearhold |
|---|---|---|---|---|
| **BILL** | AP/AR para pymes de EE. UU., pagos internacionales a 130+ países (https://www.bill.com/product/international-payments) | 479.300 empresas; **US$98.200 millones** de volumen en el Q4 FY26; ingresos FY26 US$1.653 millones (https://investor.bill.com/news/news-details/2026/BILL-Reports-Fourth-Quarter-and-Fiscal-Year-2026-Financial-Results/default.aspx) | Agentes desde el 28 oct 2025 (W-9, conciliación); «8 millones de intentos de fraude frenados en FY25» (https://www.bill.com/press-release/bill-launches-new-ai-agents) | Los agentes anunciados son de W-9 y conciliación, no de decidir qué pagar. No llega por WhatsApp ni está pensado para proveedores en LatAm |
| **Tipalti** | AP + pagos masivos globales para *mid-market* | 6.500+ clientes, **US$100.000+ millones** de volumen anualizado, 120 monedas, 200+ países (https://tipalti.com/press/2026-global-finance-outlook-index-ai-adoption/); desde **US$99/mes** + tarifa por transacción (https://tipalti.com/pricing/) | Agentes de aprobación, escaneo, PO matching, ERP sync (ídem pricing) | Precio y foco *mid-market*; el cliente de Blinka (1–3 personas en finanzas) está por debajo |
| **Ramp** | Bill Pay dentro de la plataforma de gasto | 45.000+ clientes; «Agents for AP» (7 oct 2025): **85 %** de campos contables bien a la primera; **US$1 millón+** en facturas fraudulentas marcadas en 90 días; mira 63 datos para alertar cambios de proveedor (https://www.prnewswire.com/news-releases/ramp-launches-agents-for-ap-to-automate-accounts-payable-302576975.html); pagos a 50+ países y monedas (https://ramp.com/international-payments-pricing) | El agente **recomienda** aprobar; la alerta de fraude es un aviso | Es el competidor conceptual más cercano. Diferencia: en Clearhold ningún modelo puede autorizar un pago, y eso se demuestra con un test (modelo temerario, 600 facturas, 0 indebidos) |
| **Payoneer** | Cuentas y pagos transfronterizos para pymes | Volumen 2025 **US$87.500 millones**; ingresos US$1.053 millones; ingresos B2B pyme **US$237 millones (+28 %)**; *take rate* 120 pb (https://investor.payoneer.com/news-releases/news-release-details/payoneer-reports-fourth-quarter-and-full-year-2025-financial) | Anuncia estrategia «AI-first» y agentes (ídem) | Rieles, no decisión de AP |
| **Blinka** (el sponsor) | Banca para empresas de EE. UU. con operación en LatAm: cuentas USD (Portage Bank, FDIC), ACH/wire/SWIFT, rutas locales COP, BRL (Pix/TED), MXN, ARS, CLP, PEN, BOB, CRC; USDC; **gestión de proveedores**; contabilidad con automatizaciones (https://blinka.co/) | **US$10 millones+** procesados en ~2 meses desde el lanzamiento, **25** clientes al inicio, **150+** empresas en apertura (La República, 9 oct 2026: https://www.larepublica.co/finanzas/colombianos-crearon-una-fintech-en-ee-uu-que-ya-proceso-mas-de-us-10-millones-4500136) | — | Clearhold es la capa que decide **qué** pagar antes de que Blinka lo pague |
| Airwallex, Wise Business, Deel, Ontop, dLocal | Rieles o pagos a contratistas en LatAm | **[?] sin cifras verificadas hoy** | — | Mismo argumento que Payoneer |

**Señal de mercado (Tipalti, encuesta a 2.116 profesionales, ago 2026):** el 31 % dice tener AP «totalmente automatizado», pero solo el **6 %** con IA agéntica; el **30 %** cita control y confianza en la IA como barrera; y solo el **21 %** está «muy seguro» de que detectaría un **cambio fraudulento de cuenta de un proveedor antes de pagar** (https://tipalti.com/press/2026-global-finance-outlook-index-ai-adoption/). Ese 21 % es el hueco que ataca Clearhold.

## 3. Fraude
| Métrica | Cifra | Fuente |
|---|---|---|
| Pérdidas por BEC reportadas al FBI, 2025 | **US$3.046.598.558**, en **24.768** denuncias (2024: US$2.770.151.146 en 21.442) | FBI IC3 2025 Internet Crime Report: https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf |
| Recuperación | En incidentes de infraestructura crítica de 2025, el equipo RAT del IC3 congeló US$146,6 millones de US$261,5 millones (**56 %**): ni siquiera con el FBI se recupera todo | ídem, p. 11 |
| Organizaciones con intento o fraude real de pagos (2024) | **79 %** | AFP 2025 Payments Fraud and Control Survey (521 respuestas): https://www.afponline.org/about/learn-more/press-releases/Details/survey-79-percent-of-organizations-were-victims-of-attempted-or-actual-payments-fraud-activity-in-2024 |
| BEC como vía principal | **63 %**; suplantación de proveedor (*vendor imposter*) **45 %** (34 % el año anterior); fraude de facturas **24 %** (14 %) | AFP 2025, *Key Highlights*: https://www.truist.com/content/dam/truist-bank/us/en/documents/info/cci/2025-afp-payments-fraud-control-survey-report-key-highlights.pdf |
| Tácticas BEC | Suplantación de proveedor **60 %**; de terceros **63 %**; de ejecutivo «clásica» **49 %** (57 % en 2023); transferencias (*wire*) son el medio más atacado (**63 %**) | ídem |
| Equipos de AP con ataques exitosos | **~30 %** tuvieron de 1 a 5 intentos exitosos en 2024; 59,5 % ninguno; el BEC es el tipo más detectado (**66,5 %**) | IOFM/Esker, *AP Fraud and Security in 2025* (350+ profesionales de AP): https://www.esker.com/sites/default/files/2026-01/iofm-ap-fraud-and-security-in-2025.pdf |
| Pagos duplicados o erróneos | Incluso los mejores: **0,8 %** de los desembolsos; los peores: **2 %** (APQC, en número de desembolsos, no en monto) | CFO.com / APQC: https://www.cfo.com/news/metric-of-the-month-detect-and-prevent-duplicate-or-erroneous-payments/656852/ |

## 4. Costo y tiempo por factura (benchmarks)
| Métrica | Promedio | Mejores | Fuente |
|---|---|---|---|
| Costo total por factura | **US$9,84** (Ardent); mediana **US$6,00** en 5.846 organizaciones (APQC) | **US$2,65** Best-in-Class (resto: US$12,42); cuartil superior APQC ≈ US$2,07 | Ardent Partners, *State of ePayables 2025*: https://payablesplace.ardentpartners.com/2026/01/state-of-epayables-part-nine-ap-benchmarks-and-best-in-class-performance/ (PDF: https://www.bottomline.com/cdn/1517/5157/1685/Ardent_Partners_-_State_of_ePayables_2025_-_Bottomline_-_FINAL.pdf) · APQC: https://www.apqc.org/What-Is-the-Average-Cost-to-Process-an-Invoice · cuartiles: https://www.cfo.com/news/metric-of-the-month-accounts-payable-cost/659393/ |
| Tiempo de proceso por factura | **8,2 días** | **2,9 días** (resto: 13,5) | Ardent 2025 (ídem) |
| Facturas *straight-through* (sin tocar) | **35,4 %** | **51,0 %** (resto: 29,0 %) | Ardent 2025, tablas 1 y 2 (PDF) |
| Tasa de excepciones | **18,4 %** | **11,1 %** (resto: 20,9 %) | ídem |
| Tiempo manual de AP | **10 h por semana** por profesional (~65 días al año) | — | Tipalti 2026 (ídem) |

## 5. KPIs de producto propuestos (con metas justificadas)
«Hoy» = medido en la demo en vivo el 17 oct (300 facturas de stress + 29 de la cola). Las metas de piloto y de GA se explican en `RUNBOOK-PRODUCTION.md`.

| KPI | Definición | Hoy | Meta piloto | Meta GA | Por qué esa meta |
|---|---|---|---|---|---|
| **Pagos indebidos** | Pagos que una regla, la verdad o un humano dicen que no debían salir | **0** / 329 | **0** (gate duro) | 0; cualquier caso = incidente P1 y *kill switch* | Reto Blinka: uno descalifica. Benchmark de error humano: 0,8–2 % de desembolsos (APQC) |
| **Autonomía correcta** | Decisiones correctas sin humano / total | No se mide así hoy (72 % en vivo y 87–88 % en stress cuentan cualquier pagar o frenar) | ≥ 50 % | ≥ 70 % | Superar el *straight-through* promedio (35,4 %) y el Best-in-Class (51 %) de Ardent |
| **Tasa de escalamiento** | Facturas que piden humano / total | 8/29 = 28 % en vivo; 12–13 % en stress | ≤ 35 % | ≤ 15 % | Por debajo de las excepciones promedio (18,4 %) y cerca del Best-in-Class (11,1 %) |
| **Frenados falsos** | Facturas válidas frenadas o escaladas / facturas válidas | No se mide | ≤ 10 % | ≤ 3 % | **[?] Sin benchmark público**; meta propia. Frenar a un proveedor legítimo retrasa servicio (AFP, vía financialprofessionals.org: https://www.financialprofessionals.org/training-resources/resources/articles/Details/what-treasury-professionals-need-to-know-about-business-email-compromise-in-2025) |
| **US$ retenidos** | Monto de facturas frenadas, con desglose por trampa | US$12.044 en la cola en vivo | Reportar semanal; 100 % de los casos de *red team* sembrados frenados | Ídem + casos reales confirmados por el cliente | Pérdida BEC promedio por denuncia ≈ US$123.000 en 2025 **[cálculo]** = 3.046,6 M / 24.768 (IC3) |
| **Cambios de cuenta detectados antes de pagar** | Pagos frenados por cuenta ≠ registrada / intentos | 100 % en curadas y stress | 100 % | 100 % | Solo el 21 % de las empresas confía en detectarlo hoy (Tipalti 2026) |
| **Tiempo a decisión** | Recepción → pagar/frenar/escalar (agente); escalado → decisión humana | ~0,13 s por factura (stress en vivo); GLiDE p50 373 ms (bench) | Agente p95 < 60 s; humano < 1 día hábil | Agente p95 < 10 s; humano < 4 h hábiles | Benchmark de proceso 8,2 días (promedio) y 2,9 (Best-in-Class) de Ardent |
| **Costo por factura (software)** | Modelo + infraestructura / factura | Modelo ~US$0,0001 (bench: US$0,0031 / 30); Workers desde US$5/mes con 10 M de requests (https://developers.cloudflare.com/workers/platform/pricing/) | < US$0,25 | < US$0,10 | Frente a US$9,84 promedio y US$2,65 Best-in-Class (Ardent). El costo humano de las escaladas se suma aparte |
| **Explicabilidad** | Decisiones con razón legible + evidencia por campo / total | 100 % (stress) | 100 % | 100 % + export de auditoría | Requisito del reto; auditoría para SOC 2 |

## 6. Qué decir en el pitch (cifras que aguantan una pregunta)
1. «US$3.046 millones perdidos por BEC reportados al FBI en 2025» (IC3 2025).
2. «El 45 % de las empresas sufrió suplantación de proveedores» (AFP 2025) y «solo el 21 % confía en detectar un cambio de cuenta antes de pagar» (Tipalti 2026).
3. «Procesar una factura cuesta US$9,84 y tarda 8,2 días en promedio» (Ardent 2025). Clearhold decide en menos de un segundo por una fracción de centavo de modelo.
4. «Mandar un pago B2B desde Norteamérica cuesta 3 % o más y menos del 3 % llega en una hora» (FSB 2025). Eso lo resuelve Blinka; Clearhold se asegura de que lo que sale sea lo correcto.
