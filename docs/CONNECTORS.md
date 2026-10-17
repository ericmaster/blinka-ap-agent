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

## Payouts: Blinka Payments (mock)
`/blinka/` is a **mock sandbox we built**. It is not the Blinka API and it is not affiliated with Blinka. blinka.co publishes no public API, so the endpoints, fields and statuses below are ours. The rails are the ones listed on https://blinka.co/. No money moves.

- `POST /blinka/api/payment-intents` takes the header `Idempotency-Key` (required) and the body `{amount, currency, beneficiary:{name, account, country}, reference}`.
  - First call: **201** with `{id, rail, status}`.
  - Same key and body: **200**, the same intent, with `idempotent_replay: true`.
  - Same key, different body: **409**.
- `GET /blinka/api/payment-intents[/:id]` returns the status. It moves from `created` to `submitted` after 5 s and to `settled` after 20 s, simulated.
- Rails by beneficiary country and currency:
  - COP: Colombia bank transfer
  - BRL: Brazil Pix
  - MXN: Mexico local transfer
  - ARS: CBU / CVU / Alias
  - CLP, PEN, BOB and CRC: local bank transfer
  - USD: ACH (US), the local USD routes in Peru, Panama, China and Hong Kong, otherwise SWIFT
  - Anything else: **422**

Clearhold's **Send to Blinka** button calls `POST /api/payouts`. It sends only invoices whose decision is **pay**, to the vendor's *registered* account, with the key `clearhold:<entry id>:<invoice number>`. Pressing it again refreshes statuses and never creates a second payment.
