# Backlog (not built for the hackathon)

- **Real agentic inbox:** connect a real mailbox (e.g. Cloudflare Email Routing / Gmail API) instead of the seeded mock inbox.
- **Real WhatsApp:** WhatsApp Business Cloud API webhook instead of the mock chat.
- **Emailed OTP:** send the one-time code by email (today DEMO MODE shows it on screen; set `DEMO_MODE=false` only once sending exists).
- Per-company tenants and roles (approver vs viewer); approval limits per user.
- Multi-region consistency: state is one KV record with versioned saves + retry; a Durable Object would give strict serialization across isolates.
- Server-side OCR for browser-read images (today they always escalate to a person).
- Fingerprints for the seeded September history (today only number/period checks apply to it).
- Webhook connectors (today Clearhold polls the mock Mailbox/WhatsApp APIs).
- Notifications on hold/approval; AP2-style mandate; CSV reconciliation export.
