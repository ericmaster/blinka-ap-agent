# Connectors: mock Mailbox and WhatsApp

Email and WhatsApp are modeled as **external services** with their own UI and API. Clearhold never reads their storage; it ingests through a small connector API.

| Service | UI | API base |
|---|---|---|
| Mailbox | `/mail/` | `/mail/api` |
| WhatsApp (mock) | `/chat/` | `/chat/api` |

## Service API (same shape for both)
- `GET /api/messages?after=<id>` returns the messages newer than the cursor: `{messages:[{id, from, subject?, text, date, attachments:[{id,name,type,size}]}]}`
- `GET /api/messages/:id` returns one message
- `GET /api/attachments/:id` returns the raw bytes (`?download` sets Content-Disposition)
- `POST /api/messages` takes `{from, subject?, text, attachments:[{name,type,base64}]}` (4 MB max)
- `POST /api/reset` restores the fake seed data

## Connector contract (Clearhold side)
`connector(name, baseUrl, fetch)` exposes `list(after)`, `attachment(id)` and `ui(id)` (a deep link such as `/mail/#<id>`).
Clearhold **polls** with `POST /api/sync` on load, every 10 s, and before "Process new". Each new message gets added to the queue tagged with its `channel`.
"Source message ↗" opens `ui(id)`.

By default both services run in the same Worker (in-process), one instance per demo workspace (company domain, or the full address for public mail domains), and their API requires a signed-in Clearhold session. Set `MAIL_API_URL` / `CHAT_API_URL` to point the connectors at remote services over HTTP.

Webhooks (the service POSTs to Clearhold) are on the backlog. Polling keeps the contract stateless and demo-safe.
