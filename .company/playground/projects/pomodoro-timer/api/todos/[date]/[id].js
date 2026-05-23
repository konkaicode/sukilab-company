import { validDate, toggleTaskInDoc } from '../../../lib/md-parser.js';
import { readDoc, writeDoc } from '../../../lib/github-client.js';

export default async function handler(req, res) {
  const { date, id } = req.query;
  if (!validDate(date)) return res.status(400).json({ error: 'invalid date' });
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { checked, text } = req.body || {};
    const { doc, sha } = await readDoc(date);
    const updated = toggleTaskInDoc(doc, id, date, { checked, text });
    if (!updated) return res.status(404).json({ error: 'task not found' });
    await writeDoc(date, doc, sha, `chore(secretary): update task on ${date} via pomodoro app`);
    return res.status(200).json({ ok: true, task: updated });
  } catch (err) {
    console.error('[api/todos/[date]/[id]]', err);
    return res.status(500).json({ error: err.message });
  }
}
