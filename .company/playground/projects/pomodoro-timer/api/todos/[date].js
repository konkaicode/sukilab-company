import { validDate, SECTIONS, addTaskToDoc } from '../../lib/md-parser.js';
import { readDoc, writeDoc } from '../../lib/github-client.js';

export default async function handler(req, res) {
  const { date } = req.query;
  if (!validDate(date)) return res.status(400).json({ error: 'invalid date' });

  try {
    if (req.method === 'GET') {
      const { doc, existed } = await readDoc(date);
      return res.status(200).json({
        date,
        justCreated: !existed,
        sections: doc.sections
      });
    }

    if (req.method === 'POST') {
      const { text, priority = '通常', genre, section = '通常', due } = req.body || {};
      if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
      if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'invalid section' });

      const { doc, sha } = await readDoc(date);
      const task = addTaskToDoc(doc, { text, section, priority, genre, due });
      await writeDoc(date, doc, sha, `chore(secretary): add task "${text.slice(0, 32)}" via pomodoro app`);
      return res.status(200).json({ ok: true, task });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[api/todos/[date]]', err);
    return res.status(500).json({ error: err.message });
  }
}
