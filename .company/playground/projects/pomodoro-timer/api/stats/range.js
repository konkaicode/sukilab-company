import { Octokit } from '@octokit/rest';
import { validDate, parseDoc, parsePomodoroEntries } from '../../lib/md-parser.js';

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const todosPath = process.env.TODOS_PATH || '.company/secretary/todos';
  if (!token || !owner || !repo) {
    throw new Error('Missing required env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  }
  return { token, owner, repo, branch, todosPath };
}

function eachDate(from, to) {
  const result = [];
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    result.push(`${y}-${m}-${dd}`);
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const { from, to } = req.query;
  if (!validDate(from) || !validDate(to)) {
    return res.status(400).json({ error: 'invalid from/to' });
  }

  try {
    const cfg = getConfig();
    const octokit = new Octokit({ auth: cfg.token });

    // 1. ディレクトリ一覧でファイル名集合を作る
    let fileNames = new Set();
    try {
      const listRes = await octokit.rest.repos.getContent({
        owner: cfg.owner,
        repo: cfg.repo,
        path: cfg.todosPath,
        ref: cfg.branch
      });
      if (Array.isArray(listRes.data)) {
        for (const f of listRes.data) {
          if (f.type === 'file' && /^\d{4}-\d{2}-\d{2}\.md$/.test(f.name)) {
            fileNames.add(f.name);
          }
        }
      }
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    const dates = eachDate(from, to);
    // 2. 存在する日のみ batch 取得（並列だが、レート対策で chunk）
    const present = dates.filter((d) => fileNames.has(`${d}.md`));
    const fileCache = {};
    const CHUNK = 8;
    for (let i = 0; i < present.length; i += CHUNK) {
      const chunk = present.slice(i, i + CHUNK);
      await Promise.all(chunk.map(async (date) => {
        try {
          const r = await octokit.rest.repos.getContent({
            owner: cfg.owner,
            repo: cfg.repo,
            path: `${cfg.todosPath}/${date}.md`,
            ref: cfg.branch
          });
          if (!Array.isArray(r.data)) {
            const md = Buffer.from(r.data.content, 'base64').toString('utf8');
            const doc = parseDoc(md);
            const { completed, focusMinutes, stopwatchMinutes } = parsePomodoroEntries(doc);
            fileCache[date] = { completed, focusMinutes, stopwatchMinutes };
          }
        } catch (err) {
          if (err.status !== 404) console.warn(`[stats/range] ${date}:`, err.message);
        }
      }));
    }

    const days = dates.map((date) => {
      const stats = fileCache[date] || { completed: 0, focusMinutes: 0, stopwatchMinutes: 0 };
      return { date, ...stats };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ from, to, days });
  } catch (err) {
    console.error('[api/stats/range]', err);
    return res.status(500).json({ error: err.message });
  }
}
