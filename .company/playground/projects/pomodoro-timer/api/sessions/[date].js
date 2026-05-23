import { validDate, addSessionToDoc } from '../../lib/md-parser.js';
import { readDoc, writeDoc } from '../../lib/github-client.js';

export default async function handler(req, res) {
  const { date } = req.query;
  if (!validDate(date)) return res.status(400).json({ error: 'invalid date' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { type = 'focus', label = '', durationMin = 0, time } = req.body || {};
    const { doc, sha } = await readDoc(date);
    const note = addSessionToDoc(doc, { type, label, durationMin, time });
    await writeDoc(date, doc, sha, `chore(secretary): log pomodoro session on ${date}`);
    return res.status(200).json({ ok: true, note });
  } catch (err) {
    console.error('[api/sessions/[date]]', err);
    return res.status(500).json({ error: err.message });
  }
}
