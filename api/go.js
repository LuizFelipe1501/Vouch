// Short link to talk to Vee on WhatsApp (keeps the number out of the HTML). /api/go?l=pt|es|en
module.exports = (req, res) => {
  const wa = String(process.env.VOUCH_WA || '').replace(/\D/g, '');
  if (!wa) return res.status(503).send('Not configured');
  const l = String((req.query || {}).l || 'pt');
  const msg = { pt: 'Oi, Vee!', es: 'Hola, Vee!', en: 'Hi, Vee!' }[l] || 'Oi, Vee!';
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg) });
  res.end();
};
