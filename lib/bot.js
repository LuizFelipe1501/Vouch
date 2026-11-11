// Conversation logic. One entry point: handle({ from, text, media }) -> { replies: [..], outbox: [{ to, text }] }
const { analyze } = require('./engine');
const { db, advise } = require('./services');
const crypto = require('crypto');
const { T, CHALLENGES, AFTER, countryOf, guessLang, money } = require('./plan_i18n');

const THRESHOLDS = [0, 100, 300, 700];
const today = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const levelIdx = pts => THRESHOLDS.filter(x => pts >= x).length - 1;

// Phone numbers: keep explicit country codes; otherwise assume the person's own country.
function norm(p, homeCc) {
  const raw = String(p || '').trim(); const d = raw.replace(/\D/g, '');
  if (!d) return '';
  let full;
  if (raw.startsWith('+') || raw.startsWith('00')) full = d.replace(/^00/, '');
  else { const cc = homeCc || '55'; full = d.startsWith(cc) && d.length > 11 ? d : cc + d; }
  // WhatsApp sometimes adds a mobile prefix in Mexico (+52 1) and Argentina (+54 9): keep one canonical form.
  if (/^521\d{10}$/.test(full)) full = '52' + full.slice(3);
  if (/^549\d{10}$/.test(full)) full = '54' + full.slice(3);
  // Brazilian mobiles always have 9 digits after the area code; some sources drop the leading 9.
  if (/^55\d{2}[6-9]\d{7}$/.test(full)) full = full.slice(0, 4) + '9' + full.slice(4);
  return '+' + full;
}
const cents = a => { if (!a) return 0; const n = String(a).replace(/[^\d.,]/g, ''); const v = /[.,]\d{2}$/.test(n) ? n.slice(0, -3) : n; return (parseInt(v.replace(/[.,]/g, ''), 10) || 0) * 100; };
const strip = t => String(t || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
const YES = /^(1|s|si|sim|yes|y|fui eu|foi eu|fui yo|it was me|real)\b/;
const NO = /^(2|n|nao|no|nope|nao fui eu|no fui yo|not me|golpe|estafa|scam)\b/;
const CMD = {
  play: /^(jogar|jogo|treino|treinar|jugar|juego|play|practice|practise)$/,
  score: /^(placar|pontos|ranking|marcador|puntos|score|points|leaderboard)$/,
  help: /^(ajuda|menu|help|comandos|ayuda|comandos)$/,
  stop: /^(parei|parar|sair|stop)$/,
  plan: /^(plano|plan|planes|planos)$/,
  subscribe: /^(assinar|suscribir|suscribirme|subscribe|upgrade)$/,
  resume: /^(voltar|volver|resume)$/,
  skip: /^(pular|saltar|skip)$/,
  family: /^(familia|family)\s+(.+)/,
  word: /^(palavra|palabra|word)\s+(\S.{1,30})/i,
  greet: /^(oi|ola|hola|hello|hi|hey|bom dia|boa tarde|boa noite|buenos dias|buenas|start|comecar|empezar)\W*$/,
};

function newUser(phone) {
  const c = countryOf(phone);
  return { phone, cc: c.cc, country: c.code, lang: c.lang, cur: c.cur, after: c.after, name: '', guardian: '', circle: [], plan: 'free', trialEnds: 0, openReq: null, safeWord: '', points: 0, streak: 0, lastPlay: '', saved: 0, checks: 0, blocked: 0, state: 'new', game: null, pending: null, ask: null, optIn: true, seen: 0, seenIdx: [] };
}
function fix(u) { if (!u.lang) Object.assign(u, (({ cc, code, lang, cur, after }) => ({ cc, country: code, lang, cur, after }))(countryOf(u.phone))); if (!u.seenIdx) u.seenIdx = []; if (!u.circle) u.circle = []; if (!u.plan) u.plan = 'free'; return u; }
function award(u, pts) { const t = T[u.lang]; const b = levelIdx(u.points); u.points += pts; const a = levelIdx(u.points); return a !== b ? t.levelUp(t.levels[a]) : ''; }
function nextChallenge(u) {
  const list = CHALLENGES[u.lang]; let pool = list.map((c, i) => i).filter(i => !u.seenIdx.includes(i));
  if (!pool.length) { u.seenIdx = []; pool = list.map((c, i) => i); }
  const i = pool[Math.floor(Math.random() * pool.length)]; u.seenIdx.push(i); u.game = { i, lang: u.lang, at: Date.now() };
  const t = T[u.lang]; return t.gameIntro + '\n\n"' + list[i].m + '"\n\n' + t.gameAsk;
}
function scoreboard(u, fam) {
  const t = T[u.lang];
  const lines = fam.sort((a, b) => b.points - a.points).map((m, i) => (i + 1) + '. ' + (m.name || m.phone.slice(-4)) + ' — ' + m.points + ' pts' + (m.streak > 1 ? t.days(m.streak) : ''));
  const total = fam.reduce((s, m) => s + (m.saved || 0), 0);
  return t.board + '\n' + lines.join('\n') + '\n\n' + t.together(money(total, u.cur)) + '\n' + t.level(t.levels[levelIdx(u.points)]);
}

// Anonymous scam indicators for the shared intelligence base: numbers, links, Pix keys. Never the user's own data.
function indicators(text) {
  const s = String(text || '');
  const uniq = a => [...new Set(a)].slice(0, 5);
  return {
    phones: uniq((s.match(/\+?\d[\d\s().-]{8,}\d/g) || []).map(x => x.replace(/\D/g, '')).filter(x => x.length >= 10 && x.length <= 13)),
    links: uniq((s.match(/(https?:\/\/\S+|\b[\w-]+(\.[\w-]+)*\.(com|br|net|org|info|site|xyz|ly|me|app|online|top|shop)(\/\S*)?)/gi) || []).map(x => x.toLowerCase())),
    emails: uniq(s.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []),
  };
}
async function report(u, { text, verdict, type, source }) {
  await db.report({ id: crypto.randomUUID(), created_at: new Date().toISOString(), country: u.country, lang: u.lang, source, verdict, scam_type: type || null, indicators: indicators(text), excerpt: String(text || '').replace(/\d{4,}/g, m => m.slice(0, 2) + '…').slice(0, 280) });
}
const isFamily = u => u.plan === 'family' && (!u.trialEnds || u.trialEnds > Date.now() || u.paid);

async function handle({ from, text, media, isVoice }) {
  const phone = norm(from, '55');
  const t0 = (text || '').trim(); const replies = []; const outbox = [];
  const u = fix((await db.get(phone)) || newUser(phone));
  u.seen = Date.now();
  const g = guessLang(t0); if (g && g !== u.lang && !u.game) u.lang = g;
  const t = T[u.lang];
  const done = async () => { await db.put(u); return { replies, outbox }; };
  const cmd = strip(t0);

  // 1. A relative asked this person to vouch: yes/no comes first, it may be stopping a payment right now.
  if (u.pending && !media && (YES.test(cmd) || NO.test(cmd))) {
    const p = u.pending; u.pending = null; const asker = await db.get(p.from);
    const ta = asker ? T[fix(asker).lang] : t;
    if (asker && p.id && asker.openReq !== p.id) { replies.push(t.alreadyAnswered); return done(); }
    if (asker) asker.openReq = null;
    if (YES.test(cmd)) {
      replies.push(t.confirmedMe(p.name));
      if (asker) await db.put(asker);
      outbox.push({ to: p.from, text: ta.confirmedThem(u.name) });
    } else {
      await report(asker || u, { text: p.text, verdict: 'scam', type: 'impersonation', source: 'family_denied' });
      const up = award(u, 30); u.blocked++;
      replies.push(t.blockedMe(p.name, up));
      if (asker) { const c = cents(p.amount); asker.saved = (asker.saved || 0) + c; asker.blocked = (asker.blocked || 0) + 1; const up2 = award(asker, 50); await db.put(asker); outbox.push({ to: p.from, text: ta.blockedThem(u.name, c ? money(c, asker.cur) : '', up2) }); }
    }
    return done();
  }

  // 2. Answer to the daily game.
  if (u.game && !media && (YES.test(cmd) || NO.test(cmd))) {
    const tg = T[u.game.lang || u.lang]; const c = CHALLENGES[u.game.lang || u.lang][u.game.i];
    const saidScam = /^(1|golpe|estafa|scam)/.test(cmd) || (NO.test(cmd) && !/^2/.test(cmd) && !/^(real)/.test(cmd));
    u.game = null;
    const d = today(); const y = new Date(Date.now() - 27 * 3600e3).toISOString().slice(0, 10);
    if (u.lastPlay !== d) { u.streak = u.lastPlay === y ? u.streak + 1 : 1; u.lastPlay = d; }
    if (saidScam === c.scam) replies.push(tg.right(award(u, 20)) + '\n' + c.why + (u.streak > 1 ? '\n' + tg.streak(u.streak) : ''));
    else replies.push((c.scam ? tg.wrongScam : tg.wrongReal) + tg.wrongTail + '\n' + c.why);
    replies.push(tg.gameNext);
    return done();
  }

  // 3. Setup answers and commands.
  if (u.ask === 'name' && t0 && t0.length < 40 && !media) {
    u.name = t0.replace(/^(meu nome é|meu nome e|me chamo|me llamo|soy|sou|i am|i'm|my name is)\s+/i, '').split(/\s+/).slice(0, 2).join(' ');
    u.ask = 'guardian'; replies.push(t.askGuardian(u.name)); return done();
  }
  const fam = cmd.match(CMD.family);
  const phoneLike = t0.replace(/\D/g, '').length >= 8 && t0.replace(/[\d\s()+.-]/g, '').length === 0;
  if (fam || (u.ask === 'guardian' && phoneLike)) {
    const gph = norm(fam ? t0.replace(/^\S+\s+/, '') : t0, u.cc);
    if (gph.replace(/\D/g, '').length < 10 || gph === phone) { replies.push(t.badNumber); return done(); }
    const gu = fix((await db.get(gph)) || newUser(gph)); if (!gu.guardian) gu.guardian = phone; await db.put(gu);
    if (u.guardian && u.guardian !== gph && isFamily(u)) {
      if (u.circle.includes(gph)) { replies.push(t.circleAdded(u.circle.length + 1)); return done(); }
      if (u.circle.length >= 4) { replies.push(t.circleFull); return done(); }
      u.circle.push(gph); outbox.push({ to: gph, text: T[gu.lang].invite(u.name) });
      replies.push(t.circleAdded(u.circle.length + 1)); return done();
    }
    const swapped = !!u.guardian && u.guardian !== gph;
    u.guardian = gph; u.ask = u.safeWord ? null : 'word';
    outbox.push({ to: gph, text: T[gu.lang].invite(u.name) });
    replies.push(t.guardianSet(u.ask === 'word') + (swapped ? '\n' + t.oneContact : '')); return done();
  }
  const w = t0.match(CMD.word);
  if (w) { u.safeWord = w[2].trim(); u.ask = null; replies.push(t.wordSet); return done(); }
  if (CMD.skip.test(cmd) && u.ask === 'guardian') { replies.push(t.needGuardian); return done(); }
  if (CMD.skip.test(cmd) && u.ask) { u.ask = null; replies.push(t.skipDone); return done(); }
  if (CMD.plan.test(cmd)) { replies.push(t.plan(isFamily(u), u.trialEnds, u.circle.length + (u.guardian ? 1 : 0))); return done(); }
  if (CMD.subscribe.test(cmd)) {
    if (isFamily(u)) { replies.push(t.plan(true, u.trialEnds, u.circle.length + (u.guardian ? 1 : 0))); return done(); }
    u.plan = 'family'; u.trialEnds = Date.now() + 7 * 864e5; replies.push(t.subscribed); return done();
  }
  if (CMD.play.test(cmd)) { replies.push(nextChallenge(u)); return done(); }
  if (CMD.score.test(cmd)) { const all = (await db.all()).map(fix); const f = all.filter(m => m.phone === phone || m.phone === u.guardian || m.guardian === phone); if (!f.find(m => m.phone === phone)) f.push(u); replies.push(scoreboard(u, f)); return done(); }
  if (CMD.help.test(cmd)) { replies.push(t.help); return done(); }
  if (CMD.stop.test(cmd)) { u.optIn = false; replies.push(t.stop); return done(); }
  if (CMD.resume.test(cmd)) { u.optIn = true; replies.push(t.resume); return done(); }

  // 4. Everything else goes to the advisor (Gemini) with the rule engine as a floor.
  if (!media && CMD.greet.test(cmd) && u.state === 'new') { u.state = 'known'; u.ask = 'name'; replies.push(t.welcome); return done(); }
  const rule = analyze(t0, { voice: !!isVoice });
  const ai = await advise({ text: t0, media, lang: u.lang, country: u.country, after: AFTER[u.after] || AFTER.en,
    context: (u.name ? 'Name: ' + u.name + '. ' : '') + (u.guardian ? 'Has a trusted family contact set up. ' : 'No trusted contact yet. ') + (u.safeWord ? 'Has a family safe word.' : '') });
  const rank = { clear: 0, suspicious: 1, scam: 2 };
  const intent = ai ? ai.intent : (rule.verdict === 'clear' && t0.length < 25 ? 'chat' : 'check');
  if (ai && intent !== 'check') { replies.push(ai.reply); u.state = 'known'; return done(); }
  if (!ai && intent === 'chat') { replies.push(t.idle); u.state = 'known'; return done(); }

  const verdict = ai && rank[ai.verdict] >= rank[rule.verdict] ? ai.verdict : rule.verdict;
  const flags = ai && ai.flags && ai.flags.length ? ai.flags : rule.flags.filter(f => t.flags[f.id]).map(f => ({ label: t.flags[f.id][0], why: t.flags[f.id][1] }));
  const amount = (ai && ai.amount) || rule.amount || '';
  const hasRule = id => rule.flags.some(f => f.id === id);
  const asksMoney = (ai && ai.asks_money) || hasRule('money');
  const personal = ai ? ai.impersonates_person || hasRule('newnumber') : hasRule('family') || hasRule('newnumber');
  u.checks++; u.state = 'known';
  const up = award(u, 10);
  if (verdict === 'clear') { replies.push((ai && ai.reply) || t.clear); replies.push(t.pts(up)); return done(); }

  if (verdict === 'scam') await report(u, { text: (ai && ai.transcript) || t0, verdict, type: ai && ai.scam_type, source: media ? 'forward_media' : 'forward_text' });
  let body = t.head[verdict] + (ai && ai.scam_type ? ' — ' + ai.scam_type : '') + '\n' + t.hold + '\n\n' + flags.slice(0, 4).map(f => '• ' + f.label + ': ' + f.why).join('\n');
  if (ai && ai.transcript && media) body = t.heard + ': "' + ai.transcript.slice(0, 220) + '"\n\n' + body;
  replies.push(body);
  if (asksMoney && personal) {
    if (u.guardian) {
      const msg = ((ai && ai.transcript) || t0).slice(0, 300);
      const id = crypto.randomUUID(); u.openReq = id;
      const to = [u.guardian, ...(isFamily(u) ? u.circle : [])];
      for (const m of to) {
        const gu = fix((await db.get(m)) || newUser(m));
        gu.pending = { id, from: phone, name: u.name, amount, text: msg, at: Date.now() }; await db.put(gu);
        outbox.push({ to: m, text: T[gu.lang].alert(amount, u.name, msg) });
      }
      replies.push(t.asked(!!u.safeWord, to.length));
      if (!isFamily(u)) replies.push(t.upsell);
    } else replies.push(t.noGuardian);
  } else replies.push((ai && ai.reply) || (t.genericAdvice + (verdict === 'scam' ? '\n\n' + (AFTER[u.after] || AFTER.en) : '')));
  replies.push(t.pts(up));
  return done();
}

// Daily practice. Only to people who wrote in the last 24h (WhatsApp session rule) and have not played today.
async function dailyTargets() { const d = today(); return (await db.all()).map(fix).filter(u => isFamily(u) && u.optIn && u.name && u.lastPlay !== d && !u.game && Date.now() - (u.seen || 0) < 23 * 3600e3); }
async function dailyMessage(u) { const m = nextChallenge(u); await db.put(u); return T[u.lang].morning(u.name) + m; }
const errorText = from => T[countryOf(from).lang].error;

module.exports = { handle, dailyTargets, dailyMessage, norm, errorText };
