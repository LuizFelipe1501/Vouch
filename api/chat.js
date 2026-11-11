// Test console backend: runs the same bot without WhatsApp. Turn off with SIMULATOR=off once Twilio is live.
const { handle } = require('../lib/bot');
const { db } = require('../lib/services');
module.exports = async (req, res) => {
  if (process.env.SIMULATOR === 'off') return res.status(404).json({ error: 'simulator disabled' });
  if (req.method === 'GET') return res.status(200).json({ ok: true, store: db.mode(), gemini: !!process.env.GEMINI_API_KEY, twilio: !!process.env.TWILIO_ACCOUNT_SID });
  const b = req.body || {};
  if (!b.from || typeof b.text !== 'string' || b.text.length > 2000) return res.status(400).json({ error: 'from and text required' });
  try { res.status(200).json(await handle({ from: b.from, text: b.text, isVoice: !!b.voice })); }
  catch (e) { console.error(e); res.status(500).json({ error: String(e.message).slice(0, 200) }); }
};
