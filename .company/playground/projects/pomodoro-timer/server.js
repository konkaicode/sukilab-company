/**
 * Gummy Focus — Local Development API
 *
 * 高速なローカル開発用に、Vercel functions と同じ I/O を直接ファイルシステム経由で提供。
 * `npm run dev` で起動し、Vite が /api/* をプロキシする。
 *
 * 本番（Vercel）では api/*.js の serverless functions が GitHub API 経由で同じ機能を提供する。
 */

import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECTIONS, validDate, DEFAULT_TEMPLATE, applyTemplate,
  parseDoc, serializeDoc,
  addTaskToDoc, toggleTaskInDoc, addSessionToDoc
} from './lib/md-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPANY_DIR =
  process.env.COMPANY_DIR ||
  path.resolve(__dirname, '..', '..', '..');
const TODOS_DIR = path.join(COMPANY_DIR, 'secretary', 'todos');
const TEMPLATE_PATH = path.join(TODOS_DIR, '_template.md');

const PORT = process.env.API_PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

async function readOrCreateDoc(date) {
  const filePath = path.join(TODOS_DIR, `${date}.md`);
  try {
    const md = await fs.readFile(filePath, 'utf8');
    return { doc: parseDoc(md), filePath };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    let template = DEFAULT_TEMPLATE;
    try {
      template = await fs.readFile(TEMPLATE_PATH, 'utf8');
    } catch { /* fallback */ }
    const filled = applyTemplate(template, date);
    return { doc: parseDoc(filled), filePath, justCreated: true };
  }
}

async function writeLocalDoc(filePath, doc) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serializeDoc(doc), 'utf8');
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    runtime: 'local-express',
    companyDir: COMPANY_DIR,
    todosDir: TODOS_DIR
  });
});

app.get('/api/todos/:date', async (req, res) => {
  const { date } = req.params;
  if (!validDate(date)) return res.status(400).json({ error: 'invalid date' });
  try {
    const { doc, justCreated } = await readOrCreateDoc(date);
    res.json({ date, justCreated: !!justCreated, sections: doc.sections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos/:date', async (req, res) => {
  const { date } = req.params;
  if (!validDate(date)) return res.status(400).json({ error: 'invalid date' });

  const { text, priority = '通常', genre, section = '通常', due } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'invalid section' });

  try {
    const { doc, filePath } = await readOrCreateDoc(date);
    const task = addTaskToDoc(doc, { text, section, priority, genre, due });
    await writeLocalDoc(filePath, doc);
    res.json({ ok: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/todos/:date/:id', async (req, res) => {
  const { date, id } = req.params;
  if (!validDate(date)) return res.status(400).json({ error: 'invalid date' });
  const { checked, text } = req.body || {};

  try {
    const { doc, filePath } = await readOrCreateDoc(date);
    const updated = toggleTaskInDoc(doc, id, date, { checked, text });
    if (!updated) return res.status(404).json({ error: 'task not found' });
    await writeLocalDoc(filePath, doc);
    res.json({ ok: true, task: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/:date', async (req, res) => {
  const { date } = req.params;
  if (!validDate(date)) return res.status(400).json({ error: 'invalid date' });
  const { type = 'focus', label = '', durationMin = 0, time } = req.body || {};

  try {
    const { doc, filePath } = await readOrCreateDoc(date);
    const note = addSessionToDoc(doc, { type, label, durationMin, time });
    await writeLocalDoc(filePath, doc);
    res.json({ ok: true, note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Gummy Focus local-API] http://localhost:${PORT}`);
  console.log(`[Gummy Focus local-API] todos dir: ${TODOS_DIR}`);
});
