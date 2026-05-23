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
  addTaskToDoc, toggleTaskInDoc, removeTaskFromDoc, addSessionToDoc,
  parsePomodoroEntries
} from './lib/md-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPANY_DIR =
  process.env.COMPANY_DIR ||
  path.resolve(__dirname, '..', '..', '..');
const TODOS_DIR = path.join(COMPANY_DIR, 'secretary', 'todos');
const TEMPLATE_PATH = path.join(TODOS_DIR, '_template.md');
const TEMPLATES_JSON_PATH = path.join(COMPANY_DIR, 'secretary', 'pomodoro-templates.json');

const DEFAULT_TEMPLATES = [
  { id: "quick", name: "クイック", focus: 15, brk: 3, accent: "lemon" },
  { id: "classic", name: "クラシック", focus: 25, brk: 5, accent: "mint" },
  { id: "deep", name: "ディープワーク", focus: 50, brk: 10, accent: "lavender" },
  { id: "long", name: "ロングフォーカス", focus: 90, brk: 15, accent: "pink" }
];

async function readLocalTemplates() {
  try {
    const json = await fs.readFile(TEMPLATES_JSON_PATH, 'utf8');
    const parsed = JSON.parse(json);
    return {
      templates: parsed.templates || DEFAULT_TEMPLATES,
      activeId: parsed.activeId || 'classic'
    };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return { templates: DEFAULT_TEMPLATES, activeId: 'classic' };
  }
}

async function writeLocalTemplates({ templates, activeId }) {
  await fs.mkdir(path.dirname(TEMPLATES_JSON_PATH), { recursive: true });
  await fs.writeFile(
    TEMPLATES_JSON_PATH,
    JSON.stringify({ templates, activeId }, null, 2) + '\n',
    'utf8'
  );
}

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
  const { checked, text, section, priority, genre } = req.body || {};

  try {
    const { doc, filePath } = await readOrCreateDoc(date);
    const updated = toggleTaskInDoc(doc, id, date, { checked, text, section, priority, genre });
    if (!updated) return res.status(404).json({ error: 'task not found' });
    await writeLocalDoc(filePath, doc);
    res.json({ ok: true, task: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/todos/:date/:id', async (req, res) => {
  const { date, id } = req.params;
  if (!validDate(date)) return res.status(400).json({ error: 'invalid date' });

  try {
    const { doc, filePath } = await readOrCreateDoc(date);
    const removed = removeTaskFromDoc(doc, id);
    if (!removed) return res.status(404).json({ error: 'task not found' });
    await writeLocalDoc(filePath, doc);
    res.json({ ok: true, task: removed });
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

app.get('/api/stats/range', async (req, res) => {
  const { from, to } = req.query;
  if (!validDate(from) || !validDate(to)) {
    return res.status(400).json({ error: 'invalid from/to' });
  }
  try {
    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T00:00:00');
    if (fromDate > toDate) return res.status(400).json({ error: 'from must be <= to' });

    const days = [];
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dd}`;
      const filePath = path.join(TODOS_DIR, `${dateStr}.md`);
      try {
        const md = await fs.readFile(filePath, 'utf8');
        const doc = parseDoc(md);
        const { completed, focusMinutes, stopwatchMinutes } = parsePomodoroEntries(doc);
        days.push({ date: dateStr, completed, focusMinutes, stopwatchMinutes });
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        days.push({ date: dateStr, completed: 0, focusMinutes: 0, stopwatchMinutes: 0 });
      }
    }
    res.json({ from, to, days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/templates', async (_req, res) => {
  try {
    const data = await readLocalTemplates();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const { templates, activeId } = req.body || {};
    if (!Array.isArray(templates)) return res.status(400).json({ error: 'templates array required' });
    const current = await readLocalTemplates();
    await writeLocalTemplates({ templates, activeId: activeId || current.activeId });
    res.json({ ok: true, templates, activeId: activeId || current.activeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Gummy Focus local-API] http://localhost:${PORT}`);
  console.log(`[Gummy Focus local-API] todos dir: ${TODOS_DIR}`);
});
