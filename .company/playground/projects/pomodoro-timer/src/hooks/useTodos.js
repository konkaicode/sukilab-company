import { useState, useEffect, useCallback } from 'react';

/**
 * スキラボ秘書室 todos との連携フック。
 *
 * 役割:
 *  - 今日の YYYY-MM-DD.md を取得・解析した結果を保持
 *  - addTask / toggleTask / logSession を提供し、API 経由で MD を書き換え
 *  - API 不通でもアプリは動き続ける（オフライン許容）
 */

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const API_BASE = '/api';

export default function useTodos(date) {
  const targetDate = date || todayISO();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | offline
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/todos/${targetDate}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setStatus('offline');
      setError(err.message);
    }
  }, [targetDate]);

  useEffect(() => { refresh(); }, [refresh]);

  const addTask = useCallback(async (text, opts = {}) => {
    const { section = '通常', priority = '通常', genre, due } = opts;
    try {
      const res = await fetch(`${API_BASE}/todos/${targetDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, section, priority, genre, due })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
      return await res.json();
    } catch (err) {
      console.warn('[useTodos] addTask offline:', err.message);
      return null;
    }
  }, [targetDate, refresh]);

  const toggleTask = useCallback(async (id, checked) => {
    try {
      const res = await fetch(`${API_BASE}/todos/${targetDate}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
      return await res.json();
    } catch (err) {
      console.warn('[useTodos] toggleTask offline:', err.message);
      return null;
    }
  }, [targetDate, refresh]);

  const logSession = useCallback(async ({ type, label, durationMin }) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${targetDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, label, durationMin })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[useTodos] logSession offline:', err.message);
      return null;
    }
  }, [targetDate]);

  return { data, status, error, refresh, addTask, toggleTask, logSession, date: targetDate };
}
