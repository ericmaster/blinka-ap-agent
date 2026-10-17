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
| 1 | Portada + dolor (FBI IC3 2025, Laura) | 0:00–0:25 |
| 2 | Regla de oro: el modelo solo puede frenar, nunca pagar | 0:25–0:50 |
| 3 | Demo (video narrado; si falla, la demo en vivo) | 0:50–2:05 |
| 4 | Real vs simulado | 2:05–2:20 |
| 5 | Costo e impacto, y diferencia con Ramp, BILL y Tipalti | 2:20–2:35 |
| 6 | Por qué Blinka + piloto en sombra | 2:35–2:50 |
| 7 | Cierre: «¿Cuántos pagos aprobó tu equipo esta semana sin mirar la cuenta bancaria?» | 2:50–3:00 |

## Cifras y fuentes
- US$3.046 millones perdidos por BEC en 2025, en 24.768 denuncias: FBI IC3, *2025 Internet Crime Report*, https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf (ver `../MARKET.md` §3)
- US$9,84 de costo promedio por factura: Ardent Partners, *State of ePayables 2025* (`../MARKET.md` §4)
- 21 % «muy seguro» de detectar un cambio fraudulento de cuenta antes de pagar: Tipalti, *2026 Global Finance Outlook*, https://tipalti.com/press/2026-global-finance-outlook-index-ai-adoption/
- Menos de 1 centavo por factura: modelo ~US$0,0001 por factura (US$0,0031 por 30, `../../bench/RESULTS.md`) más hosting serverless
- 0 pagos indebidos en 629 facturas sintéticas (29 curadas + 600 generadas), también con el modelo «temerario»: `../../test/decisions.test.mjs`
- 28 % de escalamiento en vivo (8 de 29) y meta de piloto ≤ 35 %: `../MARKET.md` §5
- Hechos de Blinka: blinka.co, según `../PITCH.md` §5 · Piloto: `../RUNBOOK-PRODUCTION.md` §3
- Real vs simulado: `../REAL-VS-SIMULATED.md`

## Volver a generar
Necesita Python 3, Node con `pptxgenjs` y Google Chrome.
```bash
cd docs/pitch/build
python3 build_html.py          # -> ../index.html (embebe póster y logo)
node deck.cjs                  # -> ../clearhold-pitch.pptx (inserta ../demo-narrated.mp4 si existe; si no, póster + enlace)
google-chrome --headless=new --no-pdf-header-footer --print-to-pdf=../clearhold-pitch.pdf ../index.html
npm i --no-save playwright-core && FISH_AUDIO_API_KEY=... python3 pitch_video.py   # -> ../clearhold-pitch-3min.mp4 (VOICE_ID=<id> para otra voz)
```
El texto y las notas viven en `build/template.html`. `deck.cjs` toma las notas de ahí y repite el texto de las diapositivas, así que un cambio de texto se hace en los dos archivos.

## Publicado
El Worker sirve esta carpeta como assets estáticos en https://blinka-ap-agent.ericmaster.workers.dev/pitch/ (`index.html`, `demo-narrated.mp4`, `clearhold-pitch-3min.mp4`, PPTX y PDF). Los archivos que se suben están en `../.assetsignore` y la configuración en `[assets]` de `wrangler.toml`.
