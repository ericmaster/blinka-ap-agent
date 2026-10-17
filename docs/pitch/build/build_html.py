import base64,pathlib
W=pathlib.Path(__file__).resolve().parent; D=W.parent.parent
t=(W/'template.html').read_text()
poster='data:image/png;base64,'+base64.b64encode((D/'screenshots/guided-demo-done.png').read_bytes()).decode()
mark='<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1c253a"/><path d="M20 33l8.5 8.5L44 24" stroke="#b9c8ff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
markd='<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#b9c8ff"/><path d="M20 33l8.5 8.5L44 24" stroke="#1c253a" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
out=t.replace('{{POSTER}}',poster).replace('{{MARK_DARK}}',markd).replace('{{MARK}}',mark)
(D/'pitch/index.html').write_text(out); print(len(out))
