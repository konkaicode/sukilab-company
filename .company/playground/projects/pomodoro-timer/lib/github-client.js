/**
 * GitHub API client for reading/writing .company/secretary/todos/*.md.
 *
 * Env vars:
 *   GITHUB_TOKEN    PAT with `repo` scope (or fine-grained "Contents: read+write")
 *   GITHUB_OWNER    e.g. "konkaicode"
 *   GITHUB_REPO     e.g. "sukilab-company"
 *   GITHUB_BRANCH   default "main"
 *   TODOS_PATH      default ".company/secretary/todos"
 */

import { Octokit } from '@octokit/rest';
import { parseDoc, serializeDoc, applyTemplate, DEFAULT_TEMPLATE } from './md-parser.js';

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

function newOctokit(token) {
  return new Octokit({ auth: token });
}

function fileFor(date) {
  return `${date}.md`;
}

/**
 * Read a daily MD file. If it doesn't exist, return a doc created from template
 * (without writing to GitHub — caller writes on mutation).
 */
export async function readDoc(date) {
  const cfg = getConfig();
  const octokit = newOctokit(cfg.token);
  const fullPath = `${cfg.todosPath}/${fileFor(date)}`;

  try {
    const res = await octokit.rest.repos.getContent({
      owner: cfg.owner,
      repo: cfg.repo,
      path: fullPath,
      ref: cfg.branch
    });
    if (Array.isArray(res.data)) {
      throw new Error('Expected file, got directory');
    }
    const md = Buffer.from(res.data.content, 'base64').toString('utf8');
    return {
      doc: parseDoc(md),
      sha: res.data.sha,
      path: fullPath,
      existed: true
    };
  } catch (err) {
    if (err.status === 404) {
      // Try template
      let template = DEFAULT_TEMPLATE;
      try {
        const tplRes = await octokit.rest.repos.getContent({
          owner: cfg.owner,
          repo: cfg.repo,
          path: `${cfg.todosPath}/_template.md`,
          ref: cfg.branch
        });
        if (!Array.isArray(tplRes.data)) {
          template = Buffer.from(tplRes.data.content, 'base64').toString('utf8');
        }
      } catch {
        /* fall back to DEFAULT_TEMPLATE */
      }
      const filled = applyTemplate(template, date);
      return {
        doc: parseDoc(filled),
        sha: null,
        path: fullPath,
        existed: false
      };
    }
    throw err;
  }
}

/**
 * Write a doc back to GitHub (creates or updates).
 * Returns the new sha.
 */
export async function writeDoc(date, doc, sha, commitMessage) {
  const cfg = getConfig();
  const octokit = newOctokit(cfg.token);
  const fullPath = `${cfg.todosPath}/${fileFor(date)}`;
  const md = serializeDoc(doc);
  const content = Buffer.from(md, 'utf8').toString('base64');

  const params = {
    owner: cfg.owner,
    repo: cfg.repo,
    path: fullPath,
    message: commitMessage || `chore(secretary): pomodoro app から ${date} を更新`,
    content,
    branch: cfg.branch
  };
  if (sha) params.sha = sha;

  const res = await octokit.rest.repos.createOrUpdateFileContents(params);
  return res.data.content.sha;
}

/* ============== Templates ==============
 * テンプレ一覧を JSON ファイルとして保存。複数デバイス間で同期する。
 * 保存先: <todosPath>/../pomodoro-templates.json（既定: .company/secretary/pomodoro-templates.json）
 */

const DEFAULT_TEMPLATES = [
  { id: "quick", name: "クイック", focus: 15, brk: 3, accent: "lemon" },
  { id: "classic", name: "クラシック", focus: 25, brk: 5, accent: "mint" },
  { id: "deep", name: "ディープワーク", focus: 50, brk: 10, accent: "lavender" },
  { id: "long", name: "ロングフォーカス", focus: 90, brk: 15, accent: "pink" }
];

function templatesPathFromConfig(cfg) {
  // todosPath の親に置く（secretary 直下）
  const segments = cfg.todosPath.split('/').filter(Boolean);
  segments.pop();
  segments.push('pomodoro-templates.json');
  return segments.join('/');
}

export async function readTemplates() {
  const cfg = getConfig();
  const octokit = newOctokit(cfg.token);
  const fullPath = templatesPathFromConfig(cfg);
  try {
    const res = await octokit.rest.repos.getContent({
      owner: cfg.owner,
      repo: cfg.repo,
      path: fullPath,
      ref: cfg.branch
    });
    if (Array.isArray(res.data)) throw new Error('Expected file, got directory');
    const json = Buffer.from(res.data.content, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return {
      templates: parsed.templates || DEFAULT_TEMPLATES,
      activeId: parsed.activeId || 'classic',
      sha: res.data.sha,
      path: fullPath
    };
  } catch (err) {
    if (err.status === 404) {
      return {
        templates: DEFAULT_TEMPLATES,
        activeId: 'classic',
        sha: null,
        path: fullPath
      };
    }
    throw err;
  }
}

export async function writeTemplates({ templates, activeId }, sha) {
  const cfg = getConfig();
  const octokit = newOctokit(cfg.token);
  const fullPath = templatesPathFromConfig(cfg);
  const payload = JSON.stringify({ templates, activeId }, null, 2) + '\n';
  const content = Buffer.from(payload, 'utf8').toString('base64');
  const params = {
    owner: cfg.owner,
    repo: cfg.repo,
    path: fullPath,
    message: `chore(secretary): pomodoro app テンプレ更新`,
    content,
    branch: cfg.branch
  };
  if (sha) params.sha = sha;
  const res = await octokit.rest.repos.createOrUpdateFileContents(params);
  return res.data.content.sha;
}

export function getDebugInfo() {
  return {
    owner: process.env.GITHUB_OWNER || '(unset)',
    repo: process.env.GITHUB_REPO || '(unset)',
    branch: process.env.GITHUB_BRANCH || 'main',
    todosPath: process.env.TODOS_PATH || '.company/secretary/todos',
    hasToken: !!process.env.GITHUB_TOKEN
  };
}
