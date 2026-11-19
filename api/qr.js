// QR code that opens a WhatsApp chat with Vee. /api/qr?l=pt|es|en  (number comes from VOUCH_WA)
const QR = require('qrcode');
module.exports = async (req, res) => {
  const wa = String(process.env.VOUCH_WA || '').replace(/\D/g, '');
  if (!wa) return res.status(503).send('Not configured');
  const l = String((req.query || {}).l || 'pt');
  const msg = { pt: 'Oi, Vee!', es: 'Hola, Vee!', en: 'Hi, Vee!' }[l] || 'Oi, Vee!';
  const png = await QR.toBuffer('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg), { width: 640, margin: 2, color: { dark: '#0B2A3C', light: '#FFFFFF' } });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(png);
};
