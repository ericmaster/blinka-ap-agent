# Narración del video de pitch (`clearhold-pitch-3min.mp4`)

Duración: **173.6 s** (2:53.6), con un tope de 3:00. **Ojo (17 oct 2026):** el texto de las diapositivas 1, 2, 4 y 7 cambió después de generar el video; los tiempos de la tabla son del video anterior y `clearhold-pitch-3min.mp4` hay que volver a generarlo (ver `README.md`). 1920×1080, 30 fps, H.264 + AAC, mezcla a −16 LUFS. Sin música.

- **Voz:** Fish Audio `s2.1-pro-free`, `VOICE_ID = a508e76ec74e4b57ad77d907992a536e` («Voz tik tok», masculina, español latinoamericano). Es la misma voz del demo. La voz narra como el equipo de producto; no se presenta como Eric.
- **Quién presenta:** solo en el texto de la portada: Eric Aguayo, Co-fundador y Director de IA Aplicada de Nimblersoft · Equipo Nimble.
- **Diapositivas:** capturas de `index.html` a 1920×1080, con fundidos de 0,5 s. En la diapositiva 3 va `demo-narrated.mp4` completo (74,7 s), con su propia narración (ver `demo-narration.md`).
- **Diapositiva 5:** el recuadro «0 pagos indebidos» crece un poco y se ilumina en verde (0,47 s) justo cuando la voz dice «cero pagos indebidos» (2:20).
- **Voz propia de Eric:** ver «Usar la voz de Eric» en `README.md` (`--voice-dir` o `--track` + `--timing`).
- **Cambiar la voz o el texto:** se edita `build/pitch-narration.json` y se corre `VOICE_ID=<id> python3 build/pitch_video.py`. El script solo vuelve a generar los audios que cambiaron y se detiene si el video pasa de 2:58.

| Tiempo | Diapositiva | Narración |
|---|---|---|
| 0:00.0–0:24.1 | 1 · Portada y dolor | Esto es Clearhold: el piloto automático de cuentas por pagar. Paga lo acordado y detiene lo sospechoso. Laura, nuestra controller ficticia, cierra el mes revisando a mano cientos de facturas de proveedores latinoamericanos que llegan por correo y WhatsApp. Un correo que pide cambiar la cuenta de un proveedor es justo por donde se pierde el dinero. En 2025, ese fraude de correo empresarial sumó más de tres mil millones de dólares en denuncias al FBI. |
| 0:23.6–0:40.2 | 2 · Gobernanza por diseño | ¿Cómo dejar que un agente pague sin miedo? Con gobernanza por diseño: la IA puede detener un pago, pero lo aprueban las reglas en código y, sobre dos mil dólares, una persona. Si el modelo duda, te pregunta. Cada decisión trae su prueba en una línea. |
| 0:39.7–0:41.4 | 3 · Demo (título) | (sin voz, 1,2 s) |
| 0:40.9–1:55.6 | 3 · Demo (video narrado, pantalla completa) | (su propia narración; ver `demo-narration.md`) |
| 1:55.1–2:09.2 | 4 · Real vs simulado | Lo que decide es real. La extracción, las reglas, los modelos y la auditoría corren hoy en Cloudflare. Lo simulado es el correo, WhatsApp y los pagos de Blinka: no se mueve dinero. |
| 2:08.7–2:30.7 | 5 · Costo e impacto | Cuesta menos de un centavo por factura, frente a casi diez dólares en promedio hoy. En seiscientas veintinueve facturas de prueba, incluso con un modelo programado para aprobar todo: cero pagos indebidos. Hoy, el veintiocho por ciento se escala a una persona. Otros recomiendan; nosotros probamos que ningún modelo puede aprobar un pago. |
| 2:30.2–2:44.6 | 6 · Por qué Blinka + piloto | Blinka ya mueve pagos a pesos, reales y soles. Clearhold decide qué pagar antes de que Blinka lo pague. Proponemos un piloto en sombra con tres clientes: decide sobre facturas reales, sin pagar nada. |
| 2:44.1–2:53.6 | 7 · Cierre | Clearhold: paga lo acordado, detiene lo sospechoso. ¿Cuántos pagos aprobó tu equipo esta semana sin mirar la cuenta bancaria? |
