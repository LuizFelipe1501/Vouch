// Evolution API webhook (MVP). In Evolution: Webhook URL https://<project>.vercel.app/api/evolution?token=<EVO_WEBHOOK_TOKEN>,
// event MESSAGES_UPSERT only, "Webhook by events" off, "Base64" off.
// Env: EVO_URL, EVO_KEY, EVO_INSTANCE, EVO_WEBHOOK_TOKEN. Groups, statuses and our own messages are ignored.
const crypto = require('crypto');
const { handle, errorText } = require('../lib/bot');
const evo = require('../lib/evo');
const env = process.env;
const langOf = n => (/^\+?(52|54|56|57|51|58|593|591|595|598|506|507|502|503|504|505|34)/.test(n) ? 'es' : /^\+?55/.test(n) ? 'pt' : 'en');
const br9 = d => (/^55\d{2}[6-9]\d{7}$/.test(d) ? d.slice(0, 4) + '9' + d.slice(4) : d);
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const seen = new Set();

function phoneOf(key) {
  // Newer WhatsApp versions address chats by LID; Evolution then puts the real number in senderPn / remoteJidAlt.
  const jid = [key.remoteJid, key.senderPn, key.remoteJidAlt, key.participantAlt].find(j => j && /@s\.whatsapp\.net$/.test(j));
  return jid ? '+' + br9(jid.split('@')[0].split(':')[0]) : null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).json({ ok: true, configured: evo.on() });
  if (req.method !== 'POST') return res.status(405).send('GET/POST only');
  const tok = String((req.query || {}).token || '');
  if (!env.EVO_WEBHOOK_TOKEN || !same(tok, env.EVO_WEBHOOK_TOKEN)) return res.status(403).send('bad token');
  const body = req.body || {};
  const ev = String(body.event || '').toLowerCase().replace(/_/g, '.');
  if (ev !== 'messages.upsert') return res.status(200).send('ignored');
  const list = Array.isArray(body.data) ? body.data : body.data && body.data.messages ? body.data.messages : [body.data];

  for (const m of list) {
    if (!m || !m.key || m.key.fromMe) continue;
    const jid = String(m.key.remoteJid || '');
    if (/@g\.us$|@broadcast$|@newsletter$/.test(jid)) continue; // never groups, statuses or channels
    if (seen.has(m.key.id)) continue; seen.add(m.key.id); if (seen.size > 500) seen.clear();
    const from = phoneOf(m.key); if (!from) continue;
    const msg = m.message || {};
    let text = msg.conversation || (msg.extendedTextMessage && msg.extendedTextMessage.text) || '', file = null, isVoice = false;
    if (msg.buttonsResponseMessage) text = msg.buttonsResponseMessage.selectedButtonId || text;
    if (msg.audioMessage || msg.imageMessage) {
      file = await evo.media(m); isVoice = !!msg.audioMessage;
      text = (msg.imageMessage && msg.imageMessage.caption) || '';
    } else if (!text) continue;
    let out;
    try { out = await handle({ from, text, media: file, isVoice }); }
    catch (e) { console.error(e); out = { replies: [errorText(from)], outbox: [] }; }
    for (const r of out.replies) await evo.send(from, r, langOf(from), { reply: true });
    await Promise.all(out.outbox.map(o => evo.send(o.to, o.text, langOf(o.to))));
  }
  res.status(200).send('ok');
};
