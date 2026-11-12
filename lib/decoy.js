// Decoy mode: the person sends the scammer a link to "my grandson". The scammer lands on Vouch,
// where Vee plays the grandson, stalls, and asks for the Pix key. Every key is a mule account,
// recorded for blocking before it reaches the next family. Vee never sends money and never confirms a payment.
const crypto = require('crypto');
const { db } = require('./services');

const VOUCH_WA = () => (process.env.VOUCH_WA || '15551802355').replace(/\D/g, '');
const CODE_RE = /\(\s*(?:c[oó]d(?:igo)?|code)\s*([A-Z0-9]{4})\s*\)/i;

const S = {
  pt: {
    offer: 'Quer virar o jogo? A Vee pode conversar com o golpista no seu lugar, fingir que vai pagar e descobrir a conta laranja dele. Mande ISCA.',
    bait: (link) => `Pronto. Copie a mensagem abaixo e mande para o golpista, na conversa com ele:\n\n"Quem faz meus Pix é meu neto. Fala com ele aqui que ele resolve agora: ${link}"\n\nNão mande mais nada para ele. Deixa com a Vee.`,
    ref: n => `Oi, a ${n} pediu pra eu falar com você`,
    hello: n => `Oi! Aqui é o neto da ${n}. Ela falou que você tá precisando de um dinheiro urgente. Me passa a chave Pix que eu faço agora pelo app.`,
    ask: ['Me manda a chave Pix aqui que eu copio e colo no app.', 'É CPF, celular ou e-mail? Me passa a chave certinha que eu já faço.', 'Pra eu não errar: qual a chave Pix e o nome que aparece na conta?'],
    got: 'Achei a chave. O app tá pedindo o nome completo do titular pra confirmar, qual é?',
    stall: ['O app travou na confirmação. Vou reiniciar o celular e já volto.', 'Deu "limite noturno atingido" aqui. Tem outra chave? De outro banco passa.', 'Pediu um código do banco por SMS, tô esperando chegar.', 'Caiu a internet aqui em casa, dá um minutinho.'],
    caught: (k, up) => `🎯 A Vee enrolou o golpista e pegou a conta dele: ${k}.\nJá registramos essa conta laranja para bloqueio, antes que ela chegue em outra família. +50 pontos.` + up,
    none: 'Não achei esse código. Se alguém te pediu dinheiro, me encaminhe a mensagem.',
  },
  es: {
    offer: '¿Quiere darle la vuelta? Vee puede hablar con el estafador en su lugar, fingir que va a pagar y descubrir su cuenta mula. Envíe CEBO.',
    bait: (link) => `Listo. Copie el mensaje de abajo y envíelo al estafador, en la conversación con él:\n\n"Las transferencias las hace mi nieto. Habla con él aquí y lo resuelve ahora: ${link}"\n\nNo le envíe nada más. Déjelo en manos de Vee.`,
    ref: n => `Hola, ${n} me pidió que hablara contigo`,
    hello: n => `¡Hola! Soy el nieto de ${n}. Me dijo que necesitas dinero urgente. Pásame la cuenta o CLABE y lo hago ahora desde la app.`,
    ask: ['Mándame la cuenta o CLABE aquí y la copio en la app.', '¿Es CLABE, tarjeta o celular? Pásamelo bien y lo hago.', 'Para no equivocarme: ¿cuál es la cuenta y el nombre del titular?'],
    got: 'Ya está la cuenta. La app pide el nombre completo del titular para confirmar, ¿cuál es?',
    stall: ['Se trabó la app en la confirmación. Reinicio el celular y vuelvo.', 'Salió "límite diario alcanzado". ¿Tienes otra cuenta? De otro banco sí pasa.', 'Me pidió un código del banco por SMS, estoy esperando.', 'Se cayó el internet en casa, dame un minuto.'],
    caught: (k, up) => `🎯 Vee entretuvo al estafador y consiguió su cuenta: ${k}.\nYa registramos esa cuenta mula para bloquearla antes de que llegue a otra familia. +50 puntos.` + up,
    none: 'No encontré ese código. Si alguien te pidió dinero, reenvíame el mensaje.',
  },
  en: {
    offer: 'Want to turn the tables? Vee can chat with the scammer for you, pretend to pay and get their mule account. Send BAIT.',
    bait: (link) => `Done. Copy the message below and send it to the scammer, in your chat with them:\n\n"My grandson handles my payments. Talk to him here and he'll sort it now: ${link}"\n\nDon't send them anything else. Leave it to Vee.`,
    ref: n => `Hi, ${n} asked me to talk to you`,
    hello: n => `Hi! I'm ${n}'s grandson. She said you urgently need some money. Send me the Zelle, Venmo or bank account and I'll do it now in the app.`,
    ask: ['Send me the Zelle or account details here and I\'ll paste it in the app.', 'Is it a Zelle email, phone or account number? Send it exactly and I\'ll pay.', 'So I don\'t get it wrong: what is the account and the name on it?'],
    got: 'Got it. The app wants the account holder\'s full name to confirm, what is it?',
    stall: ['The app froze on the confirmation. Restarting my phone, back soon.', 'It says "daily limit reached". Got another account? Another bank works.', 'It asked for an OTP from the bank, waiting for it.', 'Our internet dropped, give me a minute.'],
    caught: (k, up) => `🎯 Vee kept the scammer busy and got their account: ${k}.\nWe have recorded this mule account for blocking before it reaches another family. +50 points.` + up,
    none: "I couldn't find that code. If someone asked you for money, forward me the message.",
  },
};

// Payment identifiers a scammer hands over: Pix keys (CPF, CNPJ, phone, e-mail, random key), UPI IDs, CLABE, bank accounts.
function keys(text) {
  const s = String(text || ''); const out = [];
  const add = (type, v) => { v = String(v).trim(); if (v && !out.some(o => o.v === v)) out.push({ type, v }); };
  (s.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) || []).forEach(v => add('pix_random', v));
  (s.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).forEach(v => add('email', v.toLowerCase()));
  (s.match(/\b[\w.-]{2,}@(?:ok\w+|ybl|paytm|upi|ibl|axl|apl|icici|sbi|hdfcbank)\b/gi) || []).forEach(v => add('upi', v.toLowerCase()));
  (s.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || []).forEach(v => add('cnpj', v.replace(/\D/g, '')));
  (s.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g) || []).forEach(v => { const d = v.replace(/\D/g, ''); if (d.length === 11) add(/^\d{2}9/.test(d) && !/[.-]/.test(v) ? 'phone' : 'cpf', d); });
  (s.match(/\b\d{18}\b/g) || []).forEach(v => add('clabe', v));
  (s.match(/(?<!\d)\+?\(?\d{2,3}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g) || []).forEach(v => { const d = v.replace(/\D/g, ''); if (d.length >= 10 && d.length <= 13 && !out.some(o => o.v.includes(d))) add('phone', d); });
  const acct = s.match(/ag(?:[eê]ncia|\.)?\s*:?\s*(\d{3,5})\D{1,20}c(?:on)?ta\s*:?\s*([\d-]{4,14})/i);
  if (acct) add('bank_account', acct[1] + '/' + acct[2]);
  return out;
}
const mask = v => (v.length <= 6 ? v : v.slice(0, 3) + '•••' + v.slice(-3));

async function start(u, lang) {
  const t = S[lang] || S.pt;
  const code = crypto.randomBytes(3).toString('base64').replace(/[^A-Z0-9]/gi, 'X').slice(0, 4).toUpperCase();
  await db.put({ phone: 'decoy:' + code, victim: u.phone, name: u.name || '', lang, at: Date.now() });
  const text = t.ref(u.name || '') + ' (cod ' + code + ')';
  const link = `https://wa.me/${VOUCH_WA()}?text=${encodeURIComponent(text).replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
  return { replies: [t.bait(link)], code, link };
}

// Called for every incoming message before the normal flow. Returns { replies, outbox } when the sender is in decoy mode.
async function handle(u, text) {
  const m = String(text || '').match(CODE_RE);
  if (m && !u.decoy) {
    const rec = await db.get('decoy:' + m[1].toUpperCase());
    if (!rec || !rec.victim) return null;
    u.decoy = { code: m[1].toUpperCase(), victim: rec.victim, name: rec.name, lang: rec.lang || 'pt', n: 0, caught: [] };
    u.state = 'decoy';
    return { replies: [(S[u.decoy.lang] || S.pt).hello(rec.name || 'dona')], outbox: [] };
  }
  if (!u.decoy) return null;
  const d = u.decoy; const t = S[d.lang] || S.pt; d.n++;
  const found = keys(text).filter(k => !d.caught.some(c => c.v === k.v));
  const outbox = [];
  if (found.length) {
    d.caught.push(...found);
    await db.report({ id: crypto.randomUUID(), created_at: new Date().toISOString(), country: u.country, lang: d.lang, source: 'decoy_capture', verdict: 'scam', scam_type: 'mule_account',
      indicators: { accounts: found, scammer_phone: u.phone.replace(/\D/g, ''), code: d.code }, excerpt: String(text).slice(0, 280) });
    const victim = await db.get(d.victim);
    if (victim) {
      victim.points = (victim.points || 0) + 50; victim.trapped = (victim.trapped || 0) + 1;
      const tv = S[victim.lang] || t;
      await db.put(victim);
      outbox.push({ to: d.victim, text: tv.caught(found.map(k => mask(k.v)).join(', '), '') });
    }
    return { replies: [d.caught.length === found.length ? t.got : t.stall[d.n % t.stall.length]], outbox };
  }
  if (!d.caught.length) return { replies: [t.ask[(d.n - 1) % t.ask.length]], outbox };
  if (!d.holder && d.n <= d.caught.length + 2 && /^[A-Za-zÀ-ÿ' ]{5,60}$/.test(String(text).trim())) d.holder = String(text).trim();
  return { replies: [t.stall[d.n % t.stall.length]], outbox };
}

module.exports = { start, handle, keys, offer: lang => (S[lang] || S.pt).offer, none: lang => (S[lang] || S.pt).none };
