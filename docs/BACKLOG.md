# Backlog (not built for the hackathon)

- **Real agentic inbox:** connect a real mailbox (e.g. Cloudflare Email Routing / Gmail API) instead of the seeded mock inbox.
- **Real WhatsApp:** WhatsApp Business Cloud API webhook instead of the mock chat.
- **Emailed OTP:** send the one-time code by email (today DEMO MODE shows it on screen; set `DEMO_MODE=false` only once sending exists).
- Per-company tenants and roles (approver vs viewer); approval limits per user.
- Editing the vendor registry (contracted services, rates, accounts) from the UI; today it lives in `config/rules.json`.
- Notifications on hold/approval; AP2-style mandate; CSV reconciliation export.
