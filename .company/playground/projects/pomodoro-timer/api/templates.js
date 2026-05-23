import { readTemplates, writeTemplates } from '../lib/github-client.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { templates, activeId } = await readTemplates();
      return res.status(200).json({ templates, activeId });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const { templates, activeId } = req.body || {};
      if (!Array.isArray(templates)) return res.status(400).json({ error: 'templates array required' });
      // 最新の sha を取り直してから書き込み（楽観的衝突回避）
      const current = await readTemplates();
      const newSha = await writeTemplates(
        { templates, activeId: activeId || current.activeId },
        current.sha
      );
      return res.status(200).json({ ok: true, sha: newSha, templates, activeId });
    }
    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[api/templates]', err);
    return res.status(500).json({ error: err.message });
  }
}
