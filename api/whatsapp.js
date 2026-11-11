// Twilio WhatsApp webhook. Set this URL in Twilio: https://<project>.vercel.app/api/whatsapp (POST)
const { handle, errorText } = require('../lib/bot');
const { sendWhatsApp, fetchMedia, validTwilioSignature } = require('../lib/services');
const xml = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  const p = req.body || {};
  const url = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host) + req.url;
  if (!validTwilioSignature(url, p, req.headers['x-twilio-signature'])) return res.status(403).send('bad signature');
  const from = String(p.From || '').replace('whatsapp:', '');
  let media = null, isVoice = false;
  if (Number(p.NumMedia) > 0 && p.MediaUrl0) {
    const mime = p.MediaContentType0 || '';
    if (/^(audio|image)\//.test(mime)) { media = await fetchMedia(p.MediaUrl0, mime); isVoice = mime.startsWith('audio/'); }
  }
  let out;
  try { out = await handle({ from, text: p.Body || '', media, isVoice }); }
  catch (e) { console.error(e); out = { replies: [errorText(from)], outbox: [] }; }
  await Promise.all(out.outbox.map(m => sendWhatsApp(m.to, m.text)));
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response>' + out.replies.map(r => '<Message>' + xml(r) + '</Message>').join('') + '</Response>');
};
