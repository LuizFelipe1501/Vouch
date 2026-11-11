// Verdict card sent as an image in WhatsApp: /api/card?v=scam|suspicious|clear|blocked|confirmed&k=<scam type>&l=pt|es|en
import { ImageResponse } from '@vercel/og';

const OWL = c => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><g fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"><path d="M118 118 L104 44 L170 92 C190 86 210 86 230 92 L296 44 L282 118 C312 150 324 190 324 232 C324 306 270 352 200 352 C130 352 76 306 76 232 C76 190 88 150 118 118 Z"/><path d="M108 150 C140 128 182 138 200 176 C218 138 260 128 292 150"/><circle cx="150" cy="200" r="36"/><circle cx="250" cy="200" r="36"/></g><circle cx="150" cy="200" r="11" fill="${c}"/><circle cx="250" cy="200" r="11" fill="${c}"/></svg>`).toString('base64');

const LOOK = {
  scam: { bg: '#E5484D', deep: '#B4232A', ink: '#FFFFFF' },
  suspicious: { bg: '#FFB224', deep: '#C27C00', ink: '#2A1A00' },
  clear: { bg: '#30A46C', deep: '#1D7A4D', ink: '#FFFFFF' },
  blocked: { bg: '#1F2A44', deep: '#0E1527', ink: '#FFFFFF' },
  confirmed: { bg: '#3E63DD', deep: '#2847B0', ink: '#FFFFFF' },
};
const WORDS = {
  pt: { scam: ['Parece golpe', 'Não pague e não responda ainda.'], suspicious: ['Suspeito', 'Confirme antes de fazer qualquer coisa.'], clear: ['Sem sinal de golpe', 'Se pedirem dinheiro depois, me mande de novo.'], blocked: ['Golpe barrado', 'A família confirmou: não foi ela.'], confirmed: ['Pedido confirmado', 'Confira o nome na tela antes de pagar.'] },
  es: { scam: ['Parece estafa', 'No pague ni responda todavía.'], suspicious: ['Sospechoso', 'Confirme antes de hacer cualquier cosa.'], clear: ['Sin señales de estafa', 'Si luego piden dinero, envíemelo de nuevo.'], blocked: ['Estafa frenada', 'La familia confirmó: no fue ella.'], confirmed: ['Pedido confirmado', 'Revise el nombre en pantalla antes de pagar.'] },
  en: { scam: ['Looks like a scam', "Don't pay or reply yet."], suspicious: ['Suspicious', 'Confirm before doing anything.'], clear: ['No scam signs', 'If they ask for money later, send it again.'], blocked: ['Scam stopped', 'Your family confirmed it was not them.'], confirmed: ['Request confirmed', 'Check the name on screen before paying.'] },
};
const h = (style, ...children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: children.flat() } });

export default async function handler(req, res) {
  const q = req.query || {};
  const v = LOOK[q.v] ? q.v : 'scam';
  const l = WORDS[q.l] ? q.l : 'pt';
  const k = String(q.k || '').replace(/[^\p{L}\p{N} .,'/-]/gu, '').slice(0, 42);
  const c = LOOK[v]; const [title, sub] = WORDS[l][v];
  const img = new ImageResponse(
    h({ width: '100%', height: '100%', background: c.bg, padding: 48, alignItems: 'center', gap: 44, fontFamily: 'sans-serif' },
      h({ width: 230, height: 230, borderRadius: 230, background: c.deep, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
        { type: 'img', props: { src: OWL(c.ink), width: 170, height: 170 } }),
      h({ flexDirection: 'column', gap: 14, color: c.ink, flex: 1 },
        h({ fontSize: 26, fontWeight: 700, opacity: 0.85, letterSpacing: 1 }, 'Vouch'),
        h({ fontSize: 66, fontWeight: 800, lineHeight: 1.02 }, title),
        k ? h({ alignSelf: 'flex-start', background: c.deep, color: c.ink, fontSize: 26, fontWeight: 700, padding: '6px 18px', borderRadius: 40 }, k) : h({ height: 0 }),
        h({ fontSize: 30, lineHeight: 1.25, opacity: 0.95 }, sub))),
    { width: 1000, height: 460 });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(Buffer.from(await img.arrayBuffer()));
}
