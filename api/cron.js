// Daily "Golpe ou não?" push. Vercel Cron calls this with Authorization: Bearer CRON_SECRET.
const { dailyTargets, dailyMessage } = require('../lib/bot');
const { sendWhatsApp } = require('../lib/services');
module.exports = async (req, res) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return res.status(401).end();
  // Data minimization: a pending family confirmation keeps the forwarded text for 24h at most.
  const { db } = require('../lib/services'); let purged = 0;
  for (const u of await db.all()) if (u.pending && Date.now() - (u.pending.at || 0) > 864e5) { u.pending = null; await db.put(u); purged++; }
  const users = await dailyTargets(); let sent = 0;
  for (const u of users) if (await sendWhatsApp(u.phone, await dailyMessage(u))) sent++;
  res.status(200).json({ candidates: users.length, sent, purged });
};
