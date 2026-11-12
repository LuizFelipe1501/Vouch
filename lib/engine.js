// Rule engine: fast, explainable fallback and a floor under the Gemini verdict.
const FLAGS = [
  { id: 'money', w: 2, label: 'Asks for money',
    why: 'The message asks you to send money or pay something.',
    re: /\b(pix|transfer|wire|send (me )?(the )?money|send (me )?(r\$|\$) ?\d+|pay(ment)?|deposit|boleto|transfere|transferir|manda(r)? (o )?dinheiro|pagar|pagamento|dep[oó]sito|chave pix|empresta|transferencia|transfi[eé]reme|deposita(me)?|p[aá]game|pagar|spei|bre-?b|nequi|upi|zelle|venmo|cash ?app|gift ?cards?|send me|pay me|need (some )?money|need \$ ?\d+|necesito (dinero|plata|lana))\b/i,
    not: /\b(te mandei|te paguei|te transferi|j[aá] (te )?(paguei|mandei|transferi)|i (just )?(sent|paid) you|i'?ve (sent|paid))\b/i },
  { id: 'urgency', w: 2, label: 'Creates urgency',
    why: 'It pushes you to act right now. Real emergencies survive a 5-minute check.',
    re: /\b(urgent|urgente|right now|immediately|asap|today only|hurry|agora|j[aá]|r[aá]pido|imediatamente|hoje ainda|n[aã]o demora|[uú]ltim[ao] (chance|dia)|expires?|expira|bloquead[ao]|blocked|suspended|suspens[ao]|ahora mismo|ya mismo|de inmediato|cuanto antes|right away|within 24 ?h)\b/i },
  { id: 'newnumber', w: 3, label: 'New number or new account',
    why: 'Someone you know is suddenly writing from a number or account you have never seen.',
    re: /\b(new number|changed my number|my phone (broke|died|is broken)|lost my phone|novo n[uú]mero|mudei de n[uú]mero|troquei de (n[uú]mero|celular)|meu celular (quebrou|estragou|caiu)|perdi (o|meu) celular|salva (a[ií]|esse)|n[uú]mero provis[oó]rio|conta de (um|uma) amig[oa]|another account|friend'?s account|cambi[eé] de n[uú]mero|nuevo n[uú]mero|n[uú]mero nuevo|guarda este|se me (rompi[oó]|perdi[oó]) el (cel|celular|tel[eé]fono)|my new number|this is my new)\b/i },
  { id: 'family', w: 2, label: 'Claims to be family in trouble',
    why: 'It uses a family bond and an emergency to stop you from thinking.',
    re: /\b(mom|mum|dad|grandma|grandpa|m[aã]e|pai|v[oó]|filh[oa]|net[oa]|it'?s me|sou eu|accident|acidente|hospital|arrested|preso|kidnap|sequestr|emergency|emerg[eê]ncia|mam[aá]|pap[aá]|abuel[oa]|hij[oa]|niet[oa]|soy yo|choqu[eé]|daughter)\b/i },
  { id: 'secrecy', w: 3, label: 'Asks for secrecy',
    why: 'It asks you not to tell anyone. Scams depend on you being alone.',
    re: /\b(don'?t tell|do not tell|keep (it|this) (a )?secret|between us|n[aã]o conta|n[aã]o fala (pra|para) ningu[eé]m|segredo|s[oó] entre n[oó]s|n[aã]o comenta|no le digas|no le cuentes|no digas nada|entre nosotros)\b/i },
  { id: 'authority', w: 2, label: 'Pretends to be a bank or authority',
    why: 'It speaks in the name of a bank, a company or the government.',
    re: /\b(bank|banco|security (team|department)|central de (seguran[cç]a|atendimento)|fraud department|setor de fraudes|inss|receita federal|gov\.br|pol[ií]cia|police|correios|nubank|ita[uú]|bradesco|caixa|santander|mercado livre|support team|suporte|condusef|polic[ií]a|fiscal[ií]a|cyber cell|cbi|rbi|customs|aduana|kyc)\b/i },
  { id: 'credentials', w: 3, label: 'Asks for codes or passwords',
    why: 'No bank, store or relative needs your password, token or the code you just received.',
    re: /\b(password|senha|verification code|c[oó]digo (de )?(verifica[cç][aã]o|seguran[cç]a|que chegou)|token|otp|cvv|card number|n[uú]mero do cart[aã]o|install (this )?app|instal[ae] (o|esse) (app|aplicativo)|anydesk|teamviewer|screen shar|compartilh(a|e) (a )?tela|contrase[nñ]a|clave|c[oó]digo de (verificaci[oó]n|6 d[ií]gitos)|upi pin|pin|video ?call|videollamada|digital arrest)\b/i },
  { id: 'prize', w: 2, label: 'Too good to be true',
    why: 'Unexpected prizes, refunds or easy income are the most common bait.',
    re: /\b(you (have )?won|winner|prize|congratulations|free money|earn \$?\d+|voc[eê] ganhou|ganhador|pr[eê]mio|parab[eé]ns|sorteio|renda extra|ganhe (r\$ ?)?\d+|dinheiro f[aá]cil|resgat(e|ar)|cashback liberado|valores a receber|taxa de libera[cç][aã]o|ganaste|ganador|premio|felicidades|dinero f[aá]cil|gana \$?\d+|lottery|jackpot)\b/i },
];

const SHORTENERS = /(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|rb\.gy|encurtador|shorturl|goo\.gl|ow\.ly)/i;
const BRANDS = ['nubank','itau','bradesco','caixa','santander','bb','inss','gov','correios','mercadolivre','mercadopago','pix','whatsapp'];
const OFFICIAL = /(^|\.)(nubank\.com\.br|itau\.com\.br|bradesco\.com\.br|caixa\.gov\.br|gob\.mx|gov\.co|gov\.in|npci\.org\.in|santander\.com\.br|bb\.com\.br|gov\.br|correios\.com\.br|mercadolivre\.com\.br|mercadopago\.com\.br|whatsapp\.com)$/i;

function linkFlags(text) {
  const out = [];
  const urls = text.match(/\b((https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?)/gi) || [];
  for (const u of urls) {
    const host = u.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    if (!/\.[a-z]{2,}$/.test(host)) continue;
    if (OFFICIAL.test(host)) continue;
    let bad = null;
    if (SHORTENERS.test(host)) bad = 'It hides the real address behind a link shortener (' + host + ').';
    else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) bad = 'The link points to a raw IP address, not a real website.';
    else if (BRANDS.some(b => host.replace(/[^a-z]/g, '').includes(b))) bad = 'The link uses a known brand name but is not the official website (' + host + ').';
    else if ((host.match(/-/g) || []).length >= 2 || /\.(xyz|top|click|live|shop|online|site|info|icu)$/.test(host)) bad = 'The link address looks improvised (' + host + ').';
    if (bad) out.push(bad);
  }
  return out;
}

function analyze(text, opts) {
  opts = opts || {};
  const t = (text || '').trim();
  const hits = [];
  let score = 0;
  for (const f of FLAGS) if (f.re.test(t) && !(f.not && f.not.test(t))) { hits.push({ id: f.id, label: f.label, why: f.why }); score += f.w; }
  const links = linkFlags(t);
  if (links.length) { hits.push({ id: 'link', label: 'Suspicious link', why: links[0] }); score += 3; }
  if (opts.voice) { hits.push({ id: 'voice', label: 'Voice message', why: 'A familiar voice is no longer proof. Voices can be cloned from a few seconds of audio.' }); score += 1; }
  if (opts.unknownSender) { hits.push({ id: 'unknown', label: 'Sender not in your contacts', why: 'You told us this number is not saved in your phone.' }); score += 1; }
  const has = id => hits.some(h => h.id === id);
  // Combinations matter more than single cues.
  if (has('money') && has('urgency')) score += 2;
  if (has('money') && (has('newnumber') || has('family'))) score += 2;
  const amount = (t.match(/(?:r\$|\$|₹|rs\.?)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+)/i) || [])[0] || null;
  let verdict = 'clear';
  if (score >= 7) verdict = 'scam'; else if (score >= 3) verdict = 'suspicious';
  // When money and identity are both at stake, a person must confirm, whatever the score.
  const needsVouch = has('money') && (has('family') || has('newnumber') || opts.voice || verdict !== 'clear');
  return { verdict, score, flags: hits, amount, needsVouch };
}

module.exports = { analyze };
