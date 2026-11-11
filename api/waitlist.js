// Waitlist from the landing page. Saves to Supabase table vouch_waitlist.
const env = process.env;
const ERR = {
  pt: { phone: 'Confira o número: escolha o país e digite DDD + número.', off: 'O cadastro ainda não está ligado. Tente de novo mais tarde.', fail: 'Não consegui salvar agora. Tente de novo em alguns minutos.' },
  es: { phone: 'Revisa el número: elige el país y escribe el número con código de área.', off: 'El registro todavía no está activo. Inténtalo más tarde.', fail: 'No pude guardar ahora. Inténtalo de nuevo en unos minutos.' },
  en: { phone: 'Check the number: pick your country and type the full mobile number.', off: 'Sign-up is not switched on yet. Please try again later.', fail: 'Could not save right now. Please try again in a few minutes.' },
};
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {};
  const e = ERR[b.lang] || ERR.pt;
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden fields
  const raw = String(b.phone || '').trim();
  let digits = raw.replace(/\D/g, '');
  const cc = String(b.cc || '55').replace(/\D/g, '');
  if (!(raw.startsWith('+') || raw.startsWith('00'))) { if (!digits.startsWith(cc) || digits.length < 11) digits = cc + digits; }
  digits = digits.replace(/^00/, '');
  if (digits.length < 10 || digits.length > 15) return res.status(400).json({ error: e.phone });
  const row = { phone: '+' + digits, name: String(b.name || '').slice(0, 60), protects: String(b.protects || '').slice(0, 40), source: (String(b.source || 'landing') + ':' + (b.lang || 'pt')).slice(0, 40) };
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: e.off });
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/vouch_waitlist?on_conflict=phone', {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) { console.error('waitlist', r.status, (await r.text()).slice(0, 200)); return res.status(500).json({ error: e.fail }); }
  res.status(200).json({ ok: true });
};
