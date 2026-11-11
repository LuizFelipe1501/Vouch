// External services: Supabase (state), Gemini (advisor), Twilio (WhatsApp). All optional: the bot degrades instead of failing.
const crypto = require('crypto');
const env = process.env;

// ---------- State (Supabase REST, with in-memory fallback for local tests) ----------
const mem = new Map();
const sb = () => env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY;
async function sbFetch(path, init = {}) {
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.status === 204 ? null : r.json().catch(() => null);
}
const db = {
  mode: () => (sb() ? 'supabase' : 'memory'),
  async get(phone) {
    if (!sb()) return mem.get(phone) || null;
    const rows = await sbFetch('vouch_users?select=data&phone=eq.' + encodeURIComponent(phone));
    return rows && rows[0] ? rows[0].data : null;
  },
  async put(u) {
    if (!sb()) { mem.set(u.phone, u); return; }
    await sbFetch('vouch_users?on_conflict=phone', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ phone: u.phone, data: u, updated_at: new Date().toISOString() }) });
  },
  async all() {
    if (!sb()) return [...mem.values()];
    return ((await sbFetch('vouch_users?select=data&limit=1000')) || []).map(r => r.data);
  },
  // Anonymous scam report: no user phone or name, only the scam's own indicators.
  async report(r) {
    if (!sb()) { reports.push(r); return; }
    try { await sbFetch('vouch_reports', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(r) }); } catch (e) { console.error('report', e.message); }
  },
  reports: () => reports,
};
const reports = [];

// ---------- Gemini ----------
let modelCache = null;
async function pickModel() {
  if (env.GEMINI_MODEL) return env.GEMINI_MODEL;
  if (modelCache) return modelCache;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + env.GEMINI_API_KEY);
  const j = await r.json();
  const ok = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''))
    .filter(n => /^gemini-[\d.]+-flash$/.test(n)).sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]));
  modelCache = ok[0] || 'gemini-2.0-flash';
  return modelCache;
}

const SYSTEM = (lang, country, after) => `You are Vouch, a WhatsApp assistant that protects families from digital scams. Country of the user: ${country}. Write every user-facing field ("flags", "scam_type", "reply") in ${{pt:'Brazilian Portuguese',es:'Latin American Spanish',en:'simple English'}[lang] || 'simple English'}. If the user clearly writes in another language, answer in that language instead.
The person forwards messages, voice notes or screenshots they received, or asks questions. Always answer in JSON.

How to judge (based on fraud research):
- Judge by SIGNALS, not overall impression: request for money or a transfer; urgency or a deadline; a known person writing from a new number or account; appeal to a family bond or an emergency; request for secrecy; someone speaking for a bank, company, police or government; request for a password, code, PIN, token, screen sharing or installing an app; prizes, refunds or easy income; shortened links or links imitating a brand; threats of blocking, arrest or loss.
- "Avoid a loss" scams under time pressure work best. Urgency plus money is the strongest signal.
- A familiar voice does not prove identity: voices are cloned from a few seconds of audio. Never claim to detect whether audio is cloned; treat any money request by voice note as unverified.
- Normal messages exist. Do not call something a scam without signals. Too many false alarms make people stop using the service.

How to answer:
- Short sentences, calm tone, like a patient grandchild. Never blame or shame the person. Scam victims suffer real distress; if they already paid, comfort first and then guide.
- Give ONE clear action, not a list of advice. The default action when money and identity are involved: do not pay now and confirm through another channel with the real person.
- If money already left, use this guidance for the user's country: ${after}
- Do not invent phone numbers, websites or laws beyond the guidance above. Never ask for personal data, passwords or codes.
- "reply" has at most 450 characters, no markdown.

JSON fields:
intent: "check" (a received message to evaluate), "question" (a doubt or request for help), "paid" (the person says they already paid or shared data), "chat" (greeting or small talk).
verdict: "scam", "suspicious" or "clear" (use "clear" when intent is not "check").
flags: up to 4 signals found, each with "label" (2 to 4 words) and "why" (one simple sentence).
scam_type: short name of the scam type, or "".
impersonates_person: true if the message pretends to be someone the person knows (child, grandchild, friend, boss).
asks_money: true if it asks for money, a transfer, a bill payment or any payment.
amount: amount requested as written in the text, or "".
transcript: if audio or an image came in, the text you heard or read; otherwise "".
reply: the message that will be sent to the person.`;

const SCHEMA = { type: 'OBJECT', properties: {
  intent: { type: 'STRING', enum: ['check', 'question', 'paid', 'chat'] }, verdict: { type: 'STRING', enum: ['scam', 'suspicious', 'clear'] },
  flags: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['label', 'why'] } },
  scam_type: { type: 'STRING' }, impersonates_person: { type: 'BOOLEAN' }, asks_money: { type: 'BOOLEAN' }, amount: { type: 'STRING' }, transcript: { type: 'STRING' }, reply: { type: 'STRING' },
}, required: ['intent', 'verdict', 'flags', 'impersonates_person', 'asks_money', 'reply'] };

async function advise({ text, media, context, lang, country, after }) {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const parts = [];
    if (context) parts.push({ text: 'User context: ' + context });
    parts.push({ text: 'Message sent to Vouch:\n' + (text || '(no text, see attachment)') });
    if (media) parts.push({ inlineData: { mimeType: media.mime, data: media.base64 } });
    const model = await pickModel();
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + env.GEMINI_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM(lang, country, after) }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA } }),
    });
    const j = await r.json();
    const out = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.map(p => p.text || '').join('');
    return out ? JSON.parse(out) : null;
  } catch (e) { console.error('gemini', e.message); return null; }
}

// ---------- Twilio ----------
const twilioOn = () => env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM;
const basic = () => 'Basic ' + Buffer.from(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN).toString('base64');
async function sendWhatsApp(to, body) {
  if (!twilioOn()) return false;
  const from = env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:') ? env.TWILIO_WHATSAPP_FROM : 'whatsapp:' + env.TWILIO_WHATSAPP_FROM;
  const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json', {
    method: 'POST', headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: 'whatsapp:' + to, Body: body }),
  });
  if (!r.ok) console.error('twilio', r.status, (await r.text()).slice(0, 200));
  return r.ok;
}
async function fetchMedia(url, mime) {
  if (!twilioOn() || !/^https:\/\/api\.twilio\.com\//.test(url)) return null;
  const r = await fetch(url, { headers: { Authorization: basic() } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 12 * 1024 * 1024) return null;
  return { mime: (mime || r.headers.get('content-type') || 'audio/ogg').split(';')[0], base64: buf.toString('base64') };
}
function validTwilioSignature(url, params, signature) {
  if (!env.TWILIO_AUTH_TOKEN) return true; // not configured yet: accept (simulator and first tests)
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', env.TWILIO_AUTH_TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || '')); } catch (e) { return false; }
}

module.exports = { db, advise, sendWhatsApp, fetchMedia, validTwilioSignature, twilioOn };
