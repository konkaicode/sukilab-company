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

export function getDebugInfo() {
  return {
    owner: process.env.GITHUB_OWNER || '(unset)',
    repo: process.env.GITHUB_REPO || '(unset)',
    branch: process.env.GITHUB_BRANCH || 'main',
    todosPath: process.env.TODOS_PATH || '.company/secretary/todos',
    hasToken: !!process.env.GITHUB_TOKEN
  };
}
