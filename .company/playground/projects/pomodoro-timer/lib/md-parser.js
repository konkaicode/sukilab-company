/**
 * Shared MD parser/serializer for secretary/todos files.
 * Used by both local server.js (filesystem) and Vercel functions (GitHub API).
 */

export const SECTIONS = ['最優先', '通常', '余裕があれば', '完了', 'メモ・振り返り'];

export function parseDoc(md) {
  const lines = md.split(/\r?\n/);
  const doc = {
    frontmatter: '',
    title: '',
    sections: { 最優先: [], 通常: [], 余裕があれば: [], 完了: [], 'メモ・振り返り': [] }
  };

  let i = 0;

  // Frontmatter
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      doc.frontmatter = lines.slice(0, end + 1).join('\n');
      i = end + 1;
    }
  }

  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && lines[i].startsWith('# ')) {
    doc.title = lines[i];
    i++;
  }

  let currentSection = null;
  let idCounter = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const sectionMatch = line.match(/^##\s+(.+)\s*$/);
    if (sectionMatch) {
      const name = sectionMatch[1].trim();
      currentSection = SECTIONS.includes(name) ? name : null;
      continue;
    }

    if (!currentSection) continue;

    const taskMatch = line.match(/^- \[( |x|X)\]\s*(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x';
      const rest = taskMatch[2];
      if (!rest.trim() && currentSection !== 'メモ・振り返り') continue;
      const parts = rest.split('|').map(s => s.trim());
      const text = parts[0];
      const meta = {};
      for (let p = 1; p < parts.length; p++) {
        const m = parts[p].match(/^(優先度|期限|ジャンル|完了)[:：]\s*(.+)$/);
        if (m) meta[m[1]] = m[2];
      }
      doc.sections[currentSection].push({
        id: `t${++idCounter}`,
        kind: 'task',
        checked,
        text,
        priority: meta['優先度'] || null,
        due: meta['期限'] || null,
        genre: meta['ジャンル'] || null,
        completedDate: meta['完了'] || null,
        raw: line
      });
    } else if (line.trim().startsWith('-')) {
      const noteText = line.replace(/^-\s*/, '');
      if (noteText.trim()) {
        doc.sections[currentSection].push({
          id: `n${++idCounter}`,
          kind: 'note',
          text: noteText,
          raw: line
        });
      }
    }
  }

  return doc;
}

export function serializeDoc(doc) {
  const out = [];
  if (doc.frontmatter) out.push(doc.frontmatter, '');
  if (doc.title) out.push(doc.title, '');

  for (const sec of SECTIONS) {
    out.push(`## ${sec}`);
    const items = doc.sections[sec] || [];
    if (items.length === 0) {
      out.push('');
      continue;
    }
    for (const item of items) {
      if (item.kind === 'task') {
        const box = item.checked ? '[x]' : '[ ]';
        const parts = [item.text];
        if (item.priority) parts.push(`優先度: ${item.priority}`);
        if (item.due) parts.push(`期限: ${item.due}`);
        if (item.genre) parts.push(`ジャンル: ${item.genre}`);
        if (item.completedDate) parts.push(`完了: ${item.completedDate}`);
        out.push(`- ${box} ${parts.join(' | ')}`);
      } else {
        out.push(`- ${item.text}`);
      }
    }
    out.push('');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function dayOfWeekJa(dateStr) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

export function validDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function guessGenre(text) {
  const work = /(請求|納品|案件|クライアント|コーディング|実装|デザイン|MTG|打ち合わせ|営業|見積|提案|LP|WordPress|Shopify)/i;
  return work.test(text) ? '仕事' : '個人';
}

export const DEFAULT_TEMPLATE = `---
date: "YYYY-MM-DD"
type: daily
---

# YYYY-MM-DD (曜日)

## 最優先

## 通常

## 余裕があれば

## 完了

## メモ・振り返り
`;

export function applyTemplate(template, date) {
  return template
    .replace(/YYYY-MM-DD/g, date)
    .replace(/\(曜日\)/, `(${dayOfWeekJa(date)})`);
}

/**
 * Common business logic for mutating a doc.
 * Used by both server.js and Vercel functions.
 */

export function addTaskToDoc(doc, { text, section = '通常', priority = '通常', genre, due }) {
  const newTask = {
    id: `t${Date.now()}`,
    kind: 'task',
    checked: false,
    text: text.trim(),
    priority,
    due: due || null,
    genre: genre || guessGenre(text),
    completedDate: null
  };
  doc.sections[section].push(newTask);
  return newTask;
}

export function toggleTaskInDoc(doc, id, date, { checked, text }) {
  let found = null;
  let foundSection = null;
  for (const sec of SECTIONS) {
    const item = doc.sections[sec].find(t => t.id === id || t.text === id);
    if (item) {
      found = item;
      foundSection = sec;
      break;
    }
  }
  if (!found) return null;

  if (typeof text === 'string') found.text = text;
  if (typeof checked === 'boolean') {
    found.checked = checked;
    if (checked && foundSection !== '完了') {
      doc.sections[foundSection] = doc.sections[foundSection].filter(t => t !== found);
      found.completedDate = date;
      doc.sections['完了'].push(found);
    } else if (!checked && foundSection === '完了') {
      doc.sections['完了'] = doc.sections['完了'].filter(t => t !== found);
      found.completedDate = null;
      doc.sections['通常'].push(found);
    }
  }
  return found;
}

/**
 * メモ・振り返りセクション内の `[ポモドーロ] HH:MM 集中|休憩 NNmin[：ラベル]` を抽出。
 * クロスデバイス同期の単一情報源として使う（端末ローカルの localStorage に依存しない）。
 */
export function parsePomodoroEntries(doc) {
  const notes = doc.sections['メモ・振り返り'] || [];
  const sessions = [];
  let completed = 0;
  let focusMinutes = 0;
  for (const note of notes) {
    if (note.kind !== 'note') continue;
    // 例: "[ポモドーロ] 14:30 集中 25min：Design timer screen"
    const m = note.text.match(/^\[ポモドーロ\]\s+(\d{1,2}:\d{2})\s+(集中|休憩)\s+(\d+)\s*min(?:\s*[：:]\s*(.*))?$/);
    if (!m) continue;
    const [, time, type, durStr, label] = m;
    const dur = parseInt(durStr, 10);
    const tone = type === '集中' ? 'mint' : (dur >= 10 ? 'lavender' : 'lemon');
    if (type === '集中') {
      completed++;
      focusMinutes += dur;
    }
    // 新しい方が先頭になるよう unshift（ファイル上は古い順で並んでいる）
    sessions.unshift({
      time,
      type,
      task: (label && label.trim()) || (type === '休憩' ? 'ショート休憩' : '集中セッション'),
      dur: `${dur}分`,
      tone
    });
  }
  return { sessions, completed, focusMinutes };
}

export function addSessionToDoc(doc, { type = 'focus', label = '', durationMin = 0, time }) {
  const timeStr = time || new Date().toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const typeLabel = type === 'break' ? '休憩' : '集中';
  const noteText = label
    ? `[ポモドーロ] ${timeStr} ${typeLabel} ${durationMin}min：${label}`
    : `[ポモドーロ] ${timeStr} ${typeLabel} ${durationMin}min`;
  doc.sections['メモ・振り返り'].push({ kind: 'note', text: noteText });
  return noteText;
}
