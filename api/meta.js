// WhatsApp Cloud API (Meta) webhook: a real WhatsApp number, no "join" code.
// Meta app > WhatsApp > Configuration: Callback URL https://<project>.vercel.app/api/meta, Verify token = META_VERIFY_TOKEN, subscribe to "messages".
// Env: META_TOKEN (system user token), META_PHONE_ID (phone number ID), META_VERIFY_TOKEN, optional META_APP_SECRET and META_ALERT_TEMPLATE.
const crypto = require('crypto');
const { handle, errorText } = require('../lib/bot');
const langOf = n => (/^\+?(52|54|56|57|51|58|593|591|595|598|506|507|502|503|504|505|34)/.test(n) ? 'es' : /^\+?55/.test(n) ? 'pt' : 'en');
const env = process.env;
const G = 'https://graph.facebook.com/v21.0/';
const auth = () => ({ Authorization: 'Bearer ' + env.META_TOKEN });

async function graph(path, body) {
  const r = await fetch(G + path, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.error('meta', r.status, JSON.stringify(j).slice(0, 300));
  return { ok: r.ok, j };
}
// ---------- Presentation: colors, bold, verdict cards and tap buttons instead of "send 1 or 2" ----------
const HOST = () => env.PUBLIC_HOST || 'vouch-mvp-theta.vercel.app';
const LABEL = { jogar: '🎯 Jogar', placar: '🏆 Placar', plano: '👨‍👩‍👧 Plano Família', assinar: '✨ Testar grátis', pular: 'Pular',
  jugar: '🎯 Jugar', marcador: '🏆 Marcador', plan: '👨‍👩‍👧 Plan Familia', suscribir: '✨ Probar gratis', saltar: 'Saltar',
  play: '🎯 Play', score: '🏆 Score', subscribe: '✨ Try it free', skip: 'Skip', isca: '🎣 Desviar para a Vee', cebo: '🎣 Pasarlo a Vee', bait: '🎣 Send to Vee' };
const LEAD = [
  [/^(PARECE GOLPE|PARECE ESTAFA|LOOKS LIKE A SCAM)/, '🔴 *$1*', 'scam'],
  [/^(SUSPEITO|SOSPECHOSO|SUSPICIOUS)/, '🟡 *$1*', 'suspicious'],
  [/^(ATENÇÃO\.|ATENCIÓN\.|HEADS UP\.)/, '🚨 *$1*'],
  [/^(CONFIRMADO\.|CONFIRMED\.)/, '✅ *$1*', 'confirmed'],
  [/^(NÃO PAGUE\.|NO PAGUE\.|DON'T PAY\.)/, '⛔ *$1*', 'blocked'],
  [/^(Feito\. Avisei|Hecho\. Le avisé|Done\. I told)/, '🛡️ $1'],
  [/^(Não vi sinal|No vi señales|I didn't see any)/, '🟢 $1'],
  [/^(\+\d+ (pontos|puntos|points))/, '⭐ $1'],
  [/^(🎯)/, '$1', 'trapped'],
  [/^(Pronto\.|Listo\.|Done\.)/, '✅ $1'],
];
function style(text) {
  let t = text, card = null;
  for (const [re, rep, c] of LEAD) if (re.test(t)) { t = t.replace(re, rep); card = c || null; break; }
  t = t.replace(/^• ([^:\n]{2,40}):/gm, '• *$1:*');
  return { t, card };
}
// One WhatsApp payload per bot reply.
function present(text, lang) {
  const { t, card } = style(text);
  // Family alert: "1 = Sim, fui eu / 2 = Não fui eu" become two buttons.
  const yn = t.match(/\n1 = ([^\n]+)\n2 = ([^\n]+)\s*$/);
  if (yn) return { type: 'interactive', interactive: { type: 'button', body: { text: t.slice(0, yn.index).slice(0, 1000) },
    action: { buttons: [{ type: 'reply', reply: { id: '1', title: ('✅ ' + yn[1]).slice(0, 20) } }, { type: 'reply', reply: { id: '2', title: ('⛔ ' + yn[2]).slice(0, 20) } }] } } };
  // Daily practice: "Responda 1 para GOLPE ou 2 para REAL." becomes two buttons.
  const game = t.match(/\n?[^\n]*\b1\b[^\n]*\b(GOLPE|ESTAFA|SCAM)\b[^\n]*\b2\b[^\n]*\bREAL\b[^\n]*$/);
  if (game) return { type: 'interactive', interactive: { type: 'button', body: { text: t.slice(0, game.index).trim().slice(0, 1000) || '?' },
    action: { buttons: [{ type: 'reply', reply: { id: '1', title: '🚨 ' + game[1][0] + game[1].slice(1).toLowerCase() } }, { type: 'reply', reply: { id: '2', title: '✅ Real' } }] } } };
  // Verdicts and family answers: a colored card with the explanation as caption.
  if (card) {
    const k = card === 'scam' || card === 'suspicious' ? (text.split('\n')[0].split(' — ')[1] || '') : '';
    return { type: 'image', image: { link: `https://${HOST()}/api/card?v=${card}&l=${lang || 'pt'}&k=${encodeURIComponent(k)}`, caption: t.slice(0, 1024) } };
  }
  // A last line that tells people to type a command becomes buttons for those commands.
  const lines = t.split('\n'); const last = lines[lines.length - 1];
  const cmds = [...new Set((last.match(/\b[A-ZÁÉÍÓÚÃÕÇ]{3,}\b/g) || []).map(w => w.toLowerCase()).filter(w => LABEL[w]))].slice(0, 3);
  if (cmds.length && t.length < 1000 && /^(Mande|Envíe|Send|Dica|Tip|Tudo|Todo|All|Combinado|Pronto|Listo|Done)|\b(Mande|Envíe|Send|mande|envíe|send)\b/.test(last))
    return { type: 'interactive', interactive: { type: 'button', body: { text: t }, action: { buttons: cmds.map(c => ({ type: 'reply', reply: { id: c, title: LABEL[c] } })) } } };
  return { type: 'text', text: { body: t.slice(0, 4096), preview_url: false } };
}

// Free text works inside the 24h window. Outside it (a relative who never wrote to Vouch), WhatsApp only accepts an approved template.
async function send(to, text, lang) {
  const n = String(to).replace(/\D/g, '');
  const p = present(text, lang);
  let r = await graph(env.META_PHONE_ID + '/messages', { messaging_product: 'whatsapp', to: n, ...p });
  if (!r.ok && p.type !== 'text') r = await graph(env.META_PHONE_ID + '/messages', { messaging_product: 'whatsapp', to: n, type: 'text', text: { body: style(text).t.slice(0, 4096), preview_url: false } });
  if (r.ok || !env.META_ALERT_TEMPLATE) return r.ok;
  const [name, tl] = env.META_ALERT_TEMPLATE.split(':');
  const param = text.replace(/\s*\n+\s*/g, ' | ').replace(/ {4,}/g, ' ').slice(0, 1000);
  return (await graph(env.META_PHONE_ID + '/messages', { messaging_product: 'whatsapp', to: n, type: 'template',
    template: { name, language: { code: tl || 'pt_BR' }, components: [{ type: 'body', parameters: [{ type: 'text', text: param }] }] } })).ok;
}
async function media(id) {
  const m = await (await fetch(G + id, { headers: auth() })).json();
  if (!m.url || (m.file_size || 0) > 12 * 1024 * 1024) return null;
  const r = await fetch(m.url, { headers: auth() });
  if (!r.ok) return null;
  return { mime: String(m.mime_type || 'audio/ogg').split(';')[0], base64: Buffer.from(await r.arrayBuffer()).toString('base64') };
}
async function rawBody(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw || JSON.stringify(req.body || {});
}
const seen = new Set();
// Meta sends some Brazilian mobiles without the 9th digit (55 61 9999-0000). Store everyone in the 13-digit form.
const br9 = d => (/^55\d{2}[6-9]\d{7}$/.test(d) ? d.slice(0, 4) + '9' + d.slice(4) : d);

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && env.META_VERIFY_TOKEN && q['hub.verify_token'] === env.META_VERIFY_TOKEN) return res.status(200).send(q['hub.challenge']);
    return res.status(env.META_TOKEN ? 403 : 200).json({ ok: true, configured: !!(env.META_TOKEN && env.META_PHONE_ID) });
  }
  if (req.method !== 'POST') return res.status(405).send('GET/POST only');
  const raw = await rawBody(req);
  if (env.META_APP_SECRET) {
    const sig = 'sha256=' + crypto.createHmac('sha256', env.META_APP_SECRET).update(raw).digest('hex');
    const got = String(req.headers['x-hub-signature-256'] || '');
    if (sig.length !== got.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(got))) return res.status(403).send('bad signature');
  }
  let body; try { body = JSON.parse(raw); } catch (e) { return res.status(400).send('bad json'); }
  const msgs = [];
  for (const e of body.entry || []) for (const c of e.changes || []) for (const m of (c.value && c.value.messages) || []) msgs.push(m);

  for (const m of msgs) {
    if (seen.has(m.id)) continue; seen.add(m.id); if (seen.size > 500) seen.clear();
    const from = '+' + br9(m.from);
    graph(env.META_PHONE_ID + '/messages', { messaging_product: 'whatsapp', status: 'read', message_id: m.id }).catch(() => {});
    let text = '', file = null, isVoice = false;
    if (m.type === 'text') text = m.text.body;
    else if (m.type === 'button') text = m.button.payload || m.button.text;
    else if (m.type === 'interactive') { const b = m.interactive.button_reply || m.interactive.list_reply || {}; text = b.id || b.title || ''; }
    else if (m.type === 'audio' || m.type === 'image') { file = await media(m[m.type].id); isVoice = m.type === 'audio'; text = (m.image && m.image.caption) || ''; }
    else continue;
    let out;
    try { out = await handle({ from, text, media: file, isVoice }); }
    catch (e) { console.error(e); out = { replies: [errorText(from)], outbox: [] }; }
    for (const r of out.replies) await send(from, r, langOf(from));
    await Promise.all(out.outbox.map(o => send(o.to, o.text, langOf(o.to))));
  }
  res.status(200).send('ok');
};
