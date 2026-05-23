import { getDebugInfo } from '../lib/github-client.js';

export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    runtime: 'vercel-serverless',
    github: getDebugInfo()
  });
}
