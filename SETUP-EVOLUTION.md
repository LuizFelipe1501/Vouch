# WhatsApp via Evolution API (MVP)

1. Railway: New Project > Deploy a Template > "Evolution API" (it comes with Postgres and Redis).
   In the Evolution service variables, set AUTHENTICATION_API_KEY to a long random string. Generate a public domain.
2. Open https://<railway-domain>/manager, log in with that key, create an instance called `vouch`
   and scan the QR code with the WhatsApp of the Vouch chip (a dedicated chip, never a personal number).
3. In the instance settings > Webhook: enable it, URL `https://vouch-mvp-theta.vercel.app/api/evolution?token=<EVO_WEBHOOK_TOKEN>`,
   events: only MESSAGES_UPSERT, "Webhook by events" off, "Webhook base64" off.
4. Vercel > Settings > Environment Variables:
   - EVO_URL = https://<railway-domain>
   - EVO_KEY = the AUTHENTICATION_API_KEY
   - EVO_INSTANCE = vouch
   - EVO_WEBHOOK_TOKEN = any long random string (same one used in the webhook URL)
   - VOUCH_WA = the chip number with country code, digits only (e.g. 5561999990000). Used in the "send to Vee" links.
   Redeploy.
5. Test: open https://vouch-mvp-theta.vercel.app/api/evolution (should show configured: true), then send "oi" to the chip.

Notes: groups, statuses and channels are ignored. Verdicts go out as the colored card. The daily quiz (cron) also goes through Evolution when EVO_* is set.
The Meta webhook (/api/meta) keeps working; it is simply unused while Evolution is the active number.
