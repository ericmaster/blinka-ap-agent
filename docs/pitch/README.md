# Pitch 3:00 · Clearhold by Blinka

30X Hackathon, reto Blinka · Equipo Nimble · Presenta: Eric Aguayo, Co-fundador y Director de IA Aplicada, Nimblersoft. En español.

| Archivo | Qué es |
|---|---|
| `index.html` | Presentación en un solo archivo (CSS, JS e imágenes embebidas). El video se carga por ruta relativa: `demo-narrated.mp4`, en esta misma carpeta. |
| `clearhold-pitch.pptx` | La misma presentación, con texto editable y notas del orador cronometradas en cada diapositiva. |
| `clearhold-pitch.pdf` | Exportado del HTML. En la diapositiva del demo se ve el póster y la URL en vivo. |
| `demo-narrated.mp4` | Video narrado del demo (75 s, 1920×1080). Narración y voz: `demo-narration.md`. |
| `clearhold-pitch-3min.mp4` | Video del pitch de 3:00 (2:54): las diapositivas narradas, con el demo en la diapositiva 3. Guion y voz: `pitch-narration.md`. |
| `build/` | Fuentes para volver a generar todo (ver abajo). |

## Presentar (HTML)
Abrir `index.html` en Chrome o Edge. Se ve bien a 1920×1080 y en laptop: la diapositiva se escala y mantiene 16:9.
- `→` / `Espacio` / `PageDown`: siguiente · `←` / `PageUp`: anterior · `Inicio` / `Fin` · `1`–`7`: ir a esa diapositiva
- `N`: notas del orador con el guion cronometrado · `F`: pantalla completa · clic a la derecha o a la izquierda para avanzar o volver
- `#3` en la URL abre directo la diapositiva 3

## Guion (3:00)
| # | Diapositiva | Tiempo |
|---|---|---|
| 1 | Portada + dolor: Laura (persona ficticia) y las cifras (FBI IC3, AFP, Ardent) | 0:00–0:25 |
| 2 | Gobernanza por diseño: la IA puede detener un pago; lo aprueban las reglas en código y, sobre US$2.000, una persona | 0:25–0:50 |
| 3 | Demo (video narrado; si falla, la demo en vivo) | 0:50–2:05 |
| 4 | Real vs simulado | 2:05–2:20 |
| 5 | Costo e impacto, y diferencia con Ramp, BILL y Tipalti | 2:20–2:35 |
| 6 | Por qué Blinka + piloto en sombra | 2:35–2:50 |
| 7 | Cierre: «¿Cuántos pagos aprobó tu equipo esta semana sin mirar la cuenta bancaria?» | 2:50–3:00 |

## Cifras y fuentes
- US$3.046 millones perdidos por BEC en 2025, en 24.768 denuncias: FBI IC3, *2025 Internet Crime Report*, https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf (ver `../MARKET.md` §3)
- 79 % de las organizaciones sufrió intento o fraude real de pagos en 2024: AFP, *2025 Payments Fraud and Control Survey*, https://www.afponline.org/about/learn-more/press-releases/Details/survey-79-percent-of-organizations-were-victims-of-attempted-or-actual-payments-fraud-activity-in-2024 (`../MARKET.md` §3)
- US$9,84 de costo promedio y 8,2 días de proceso por factura: Ardent Partners, *State of ePayables 2025* (`../MARKET.md` §4)
- Laura es una persona ficticia (controller de una empresa de EE. UU. que paga a proveedores en Latinoamérica); su caso ilustra el dolor, las cifras lo respaldan.
- Aprobación humana sobre US$2.000: `human_approval_above_usd` en `../../config/rules.json` (valor de la demo, configurable).
- 21 % «muy seguro» de detectar un cambio fraudulento de cuenta antes de pagar: Tipalti, *2026 Global Finance Outlook*, https://tipalti.com/press/2026-global-finance-outlook-index-ai-adoption/
- Menos de 1 centavo por factura: modelo ~US$0,0001 por factura (US$0,0031 por 30, `../../bench/RESULTS.md`) más hosting serverless
- 0 pagos indebidos en 629 facturas sintéticas (29 curadas + 600 generadas), también con el modelo «temerario»: `../../test/decisions.test.mjs`
- 28 % de escalamiento en vivo (8 de 29) y meta de piloto ≤ 35 %: `../MARKET.md` §5
- Hechos de Blinka: blinka.co, según `../PITCH.md` §5 · Piloto: `../RUNBOOK-PRODUCTION.md` §3
- Real vs simulado: `../REAL-VS-SIMULATED.md`

## Pendiente: volver a generar el video del pitch
El 17 oct 2026 cambió el texto de la narración (diapositivas 1, 2, 4 y 7 en `build/pitch-narration.json` y `pitch-narration.md`): Laura con un dolor concreto, «detiene lo sospechoso» en vez de «frena lo raro» y «gobernanza por diseño» en vez de «el modelo solo puede frenar». **`clearhold-pitch-3min.mp4` todavía tiene la narración y las diapositivas anteriores**; hay que volver a generarlo (con la voz de Eric o con Fish). Las tomas nuevas suman unos 3–4 s con Fish, así que puede acercarse al tope de 2:58. `demo-narrated.mp4` no cambió: su voz y sus subtítulos fijos todavía dicen «frenada» y «el modelo solo puede frenar, nunca pagar» (`demo-narration.md`, `build/demo-beats.json`).

## Volver a generar
Necesita Python 3, Node con `pptxgenjs` y Google Chrome.
```bash
cd docs/pitch/build
python3 build_html.py          # -> ../index.html (embebe póster y logo)
node deck.cjs                  # -> ../clearhold-pitch.pptx (inserta ../demo-narrated.mp4 si existe; si no, póster + enlace)
google-chrome --headless=new --no-pdf-header-footer --print-to-pdf=../clearhold-pitch.pdf ../index.html
npm i --no-save playwright-core && FISH_AUDIO_API_KEY=... python3 pitch_video.py   # -> ../clearhold-pitch-3min.mp4 (VOICE_ID=<id> para otra voz; voz propia: ver abajo)
```
El texto y las notas viven en `build/template.html`. `deck.cjs` toma las notas de ahí y repite el texto de las diapositivas, así que un cambio de texto se hace en los dos archivos.

## Usar la voz de Eric
`build/pitch_video.py` puede reemplazar la voz de Fish Audio por grabaciones propias. Las diapositivas y el demo se vuelven a cronometrar solos según lo que dure cada toma. No hace falta la clave de Fish si se entregan todas las diapositivas.

**Qué grabar.** El texto de cada diapositiva está en `build/pitch-narration.json` (también en `pitch-narration.md`). El de cada bloque del demo está en `build/demo-beats.json` (también en `demo-narration.md`). Se puede leer con otras palabras, pero hay que respetar el tiempo.

**Formato.** WAV (44,1 o 48 kHz, 16/24 bit, mono o estéreo). También sirven MP3, M4A, FLAC u OGG de 192 kbps o más. Cuarto silencioso, micrófono a un palmo, sin música. El silencio al inicio y al final se recorta solo, y el volumen se normaliza a −16 LUFS. No hay que editar nada.

**Opción A: un archivo por toma** (la más simple). Una carpeta con estos nombres:

| Archivo | Qué es | Duración de referencia (Fish) |
|---|---|---|
| `1.wav` | Portada y dolor | 23,0 s |
| `2.wav` | Gobernanza por diseño | 15,5 s |
| `4.wav` | Real vs simulado | 13,0 s |
| `5.wav` | Costo e impacto | 20,9 s |
| `6.wav` | Por qué Blinka | 13,3 s |
| `7.wav` | Cierre | 7,6 s |
| `demo-1.wav` … `demo-7.wav` | Los 7 bloques del demo (opcional) | 6,5 · 17,5 · 10,4 · 7,8 · 9,1 · 9,6 · 7,1 s |

```bash
cd docs/pitch/build
python3 pitch_video.py --voice-dir ~/voz-eric --out /tmp/prueba.mp4   # prueba; sin --out reemplaza ../clearhold-pitch-3min.mp4
```

**Opción B: una sola toma + marcas de tiempo.** Leer todo de corrido en un archivo, dejando una pausa entre tomas. En Audacity, se marca cada toma con una etiqueta de región (Ctrl+B) que lleve el mismo nombre de la tabla (`1`, `2`, `demo-1`…). Después: *Archivo → Exportar → Exportar etiquetas*, que genera un `.txt`. También sirve un JSON: `{"1": [0.7, 28.7], "2": [30.1, 46.7], "demo-2": [48.1, 69.2]}` (segundos).

```bash
python3 pitch_video.py --track ~/eric-pitch.wav --timing ~/etiquetas.txt
```

**Cómo se recronometra.**
- Cada diapositiva dura 0,5 s + la toma + 0,6 s, con fundidos de 0,5 s entre una y otra.
- En el demo, cada bloque arranca donde arrancaba la voz de Fish. Si la toma es más larga que su ventana (`build/demo-beats.json`), el video se congela en el último cuadro de ese bloque lo que haga falta. Si es más corta, queda un silencio. Un bloque del demo sin toma conserva la voz de Fish, así que conviene grabar los 7 para que haya una sola voz. Los subtítulos del demo son fijos: si Eric cambia una frase, la idea debe seguir coincidiendo.
- El recuadro «0 pagos indebidos» de la diapositiva 5 aparece al 52 % de la toma. Para ajustarlo, se agrega una etiqueta puntual `emphasis-5` con los segundos desde que empieza a hablar en esa toma, o la clave `"emphasis-5": 11.0` en el JSON. Con `--voice-dir`, esa marca se pasa en un `--timing` aparte.
- El script se detiene si el video pasa de 2:58 y dice cuántos segundos sobran. Hoy, con Fish, el video dura 2:53,6, así que el margen es de unos 4 s. Si sobra, hay tres opciones: grabar de nuevo la toma más larga, acelerar las tomas propias con `--own-tempo 1.04` (sin cambiar el tono) o, como último recurso, usar `--max-len 180`.
- Si falta alguna diapositiva, el script falla, a menos que se pase `--fish-fallback`.

**Cómo entregarlo:** la carpeta con los archivos (opción A) o el WAV + las etiquetas (opción B), por Drive o por correo. Con eso se corre el comando, se revisa y se publica igual que ahora.

## Publicado
El Worker sirve esta carpeta como assets estáticos en https://blinka-ap-agent.ericmaster.workers.dev/pitch/ (`index.html`, `demo-narrated.mp4`, `clearhold-pitch-3min.mp4`, PPTX y PDF). Los archivos que se suben están en `../.assetsignore` y la configuración en `[assets]` de `wrangler.toml`.
