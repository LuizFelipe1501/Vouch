// Renders product screens as PNG: /api/shot?s=1|2|3. Used for the pitch deck and social previews.
import { ImageResponse } from '@vercel/og';

const C = { ink: '#f4f4f5', head: '#34d399', bg: '#141416', me: '#232327', bot: '#1b1b1e', line: '#26262b', red: '#f05252', yel: '#ffc93c', mute: '#9b9ba3' };
const OWL = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><g fill="none" stroke="#f4f4f5" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"><path d="M118 118 L104 44 L170 92 C190 86 210 86 230 92 L296 44 L282 118 C312 150 324 190 324 232 C324 306 270 352 200 352 C130 352 76 306 76 232 C76 190 88 150 118 118 Z"/><path d="M108 150 C140 128 182 138 200 176 C218 138 260 128 292 150"/><circle cx="150" cy="200" r="36"/><circle cx="250" cy="200" r="36"/><path d="M186 252 L199 265 L222 240" stroke="#ffc93c"/></g><circle cx="150" cy="200" r="11" fill="#f4f4f5"/><circle cx="250" cy="200" r="11" fill="#f4f4f5"/></svg>').toString('base64');
const h = (style, ...children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: children.flat() } });
const col = (style, ...c) => h({ flexDirection: 'column', ...style }, ...c);
const txt = (s, style = {}) => h({ fontSize: 19, lineHeight: 1.38, color: C.ink, ...style }, s);
const tag = (s, fg) => h({ alignSelf: 'flex-start', border: `1px solid ${fg}`, color: fg, fontSize: 14, fontWeight: 700, padding: '2px 10px', borderRadius: 20, marginBottom: 6 }, s);
const bubble = (me, ...c) => col({ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '84%', background: me ? C.me : C.bot, border: `1px solid ${C.line}`, padding: '12px 14px', borderRadius: 16, gap: 2 }, ...c);
const lines = arr => arr.map(l => (l ? txt(l) : h({ height: 12 })));

function phone(subtitle, ...msgs) {
  return h({ width: 540, height: 860, background: '#0b0b0c', padding: 0 },
    col({ width: 540, height: 860, border: `2px solid ${C.line}`, borderRadius: 44, background: C.bg, overflow: 'hidden' },
      h({ color: C.ink, padding: '24px 22px 18px', alignItems: 'center', gap: 14, borderBottom: `1px solid ${C.line}` },
        h({ width: 50, height: 50, borderRadius: 50, background: C.bot, border: `1px solid ${C.line}`, alignItems: 'center', justifyContent: 'center' }, { type: 'img', props: { src: OWL, width: 34, height: 34 } }),
        col({}, h({ fontSize: 22, fontWeight: 700 }, 'Vouch'), h({ fontSize: 15, color: C.head }, subtitle))),
      col({ padding: '18px 16px', gap: 12 }, ...msgs)));
}

const screens = {
  1: () => phone('assistente antigolpes',
    bubble(true, h({ fontSize: 14, color: C.mute, fontStyle: 'italic' }, 'Encaminhada'),
      h({ alignItems: 'center', gap: 10 }, h({ width: 34, height: 34, borderRadius: 34, background: C.head }), h({ width: 160, height: 22, background: '#3a3a40', borderRadius: 4 }), txt('0:14'))),
    bubble(false, tag('PARECE GOLPE', C.red), ...lines(['Entendi o áudio assim: "Mãe, sou eu,', 'bati o carro, preciso de R$ 2.000 agora..."', '', '• Pressa e pedido de dinheiro', '• Pede segredo', '• Voz conhecida não é prova', '', 'Não pague ainda. Já perguntei ao Lucas', 'se foi ele.'])),
    bubble(false, tag('LUCAS RESPONDEU', C.head), ...lines(['Não foi ele. Bloqueie o número.', 'Você protegeu R$ 2.000. +50 pontos'])) ),
  2: () => phone('alerta da família',
    bubble(false, tag('ATENÇÃO', C.yel), ...lines(['Alguém pediu R$ 2.000 para a Helena e', 'pode estar usando o seu nome:', '', '"Mãe, sou eu, bati o carro, preciso de', 'R$ 2.000 agora pro guincho..."', '', 'Foi você?']),
      h({ gap: 8, marginTop: 10, alignItems: 'flex-start' }, ...['1  Sim, fui eu', '2  Não fui eu'].map(s => h({ flex: 1, justifyContent: 'center', border: `1px solid ${C.line}`, color: C.ink, borderRadius: 12, padding: 8, fontWeight: 700, fontSize: 17 }, s)))),
    bubble(true, txt('2')),
    bubble(false, ...lines(['Feito. Avisei a Helena para não pagar.', 'Você barrou um golpe: +30 pontos.', '', 'Alguém está usando seu nome.', 'Avise o resto da família.'])) ),
  3: () => phone('treino do dia',
    bubble(false, ...lines(['Bom dia, Helena! Golpe ou não?', '', '"Aqui é do suporte do WhatsApp. Sua', 'conta será desativada. Informe o código', 'de 6 dígitos que enviamos por SMS."', '', 'Responda 1 = GOLPE ou 2 = REAL'])),
    bubble(true, txt('1')),
    bubble(false, tag('ACERTOU! +20 PONTOS', C.head), ...lines(['Esse código é a chave da sua conta.', 'Sequência: 6 dias seguidos'])),
    bubble(false, txt('Placar da família', { fontWeight: 700 }), ...lines(['1. Helena — 340 pts', '2. Lucas — 210 pts', '3. Marta — 120 pts', '', 'Juntos já protegeram R$ 3.800.'])) ),
};

export default async function handler(req, res) {
  const s = String((req.query && req.query.s) || '1');
  const make = screens[s] || screens[1];
  const img = new ImageResponse(make(), { width: 540, height: 860 });
  const buf = Buffer.from(await img.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(buf);
}
export { screens };
