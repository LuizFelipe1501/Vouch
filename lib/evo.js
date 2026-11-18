// Evolution API (self-hosted, e.g. on Railway). MVP transport: any WhatsApp number scanned by QR code.
// Env: EVO_URL (https://<app>.up.railway.app), EVO_KEY (AUTHENTICATION_API_KEY), EVO_INSTANCE (instance name).
const env = process.env;
const on = () => !!(env.EVO_URL && env.EVO_KEY && env.EVO_INSTANCE);
const base = () => env.EVO_URL.replace(/\/+$/, '');
async function call(path, body) {
  const r = await fetch(`${base()}/${path}/${encodeURIComponent(env.EVO_INSTANCE)}`, {
    method: 'POST', headers: { apikey: env.EVO_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.error('evo', path, r.status, JSON.stringify(j).slice(0, 300));
  return { ok: r.ok, j };
}
const HOST = () => env.PUBLIC_HOST || 'vouch-mvp-theta.vercel.app';
// Verdicts go out as the colored card image with the explanation as caption; everything else as text.
// Buttons are not reliable on unofficial WhatsApp clients, so "1 / 2" answers stay as typed numbers (the bot already accepts them).
async function send(to, text, lang) {
  const number = String(to).replace(/\D/g, '');
  const { style } = require('../api/meta');
  const { t, card } = style(text);
  if (card) {
    const k = card === 'scam' || card === 'suspicious' ? (text.split('\n')[0].split(' — ')[1] || '') : '';
    const media = `https://${HOST()}/api/card?v=${card}&l=${lang || 'pt'}&k=${encodeURIComponent(k)}`;
    const r = await call('message/sendMedia', { number, mediatype: 'image', mimetype: 'image/png', fileName: 'vouch.png', media, caption: t.slice(0, 1024) });
    if (r.ok) return true;
  }
  return (await call('message/sendText', { number, text: t.slice(0, 4096) })).ok;
}
async function media(msg) {
  const r = await call('chat/getBase64FromMediaMessage', { message: { key: msg.key }, convertToMp4: false });
  const b64 = r.j && r.j.base64;
  if (!r.ok || !b64 || b64.length > 16e6) return null;
  return { mime: String(r.j.mimetype || 'audio/ogg').split(';')[0], base64: b64 };
}
module.exports = { on, send, media };
