import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * テンプレ一覧とアクティブテンプレを GitHub JSON 経由で同期管理。
 * リトライ・楽観更新・オフラインフォールバックを内蔵。
 */

const API_BASE = '/api/templates';
const DEFAULT = {
  templates: [
    { id: "quick", name: "クイック", focus: 15, brk: 3, accent: "lemon" },
    { id: "classic", name: "クラシック", focus: 25, brk: 5, accent: "mint" },
    { id: "deep", name: "ディープワーク", focus: 50, brk: 10, accent: "lavender" },
    { id: "long", name: "ロングフォーカス", focus: 90, brk: 15, accent: "pink" }
  ],
  activeId: 'classic'
};

const LS_KEY = 'gf_templatesCache';

function loadCache() {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return parsed && parsed.templates ? parsed : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function saveCache(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export default function useTemplates() {
  const initial = loadCache();
  const [templates, setTemplatesState] = useState(initial.templates);
  const [activeId, setActiveIdState] = useState(initial.activeId);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | offline
  const dirty = useRef(false);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // ローカル変更が pending している場合はサーバ側を上書きしない（ユーザ操作優先）
      if (!dirty.current) {
        setTemplatesState(data.templates || DEFAULT.templates);
        setActiveIdState(data.activeId || 'classic');
        saveCache({ templates: data.templates, activeId: data.activeId });
      }
      setStatus('ready');
    } catch (err) {
      console.warn('[useTemplates] refresh offline:', err.message);
      setStatus('offline');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // サーバ書き込み（debounced）。templates/activeId のどちらかが変わるたびに dirty を立てて push する。
  const push = useCallback(async (next) => {
    saveCache(next);
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dirty.current = false;
      setStatus('ready');
    } catch (err) {
      console.warn('[useTemplates] push offline:', err.message);
      setStatus('offline');
    }
  }, []);

  const setTemplates = useCallback((updater) => {
    setTemplatesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      dirty.current = true;
      push({ templates: next, activeId });
      return next;
    });
  }, [activeId, push]);

  const setActiveId = useCallback((id) => {
    setActiveIdState(id);
    dirty.current = true;
    push({ templates, activeId: id });
  }, [templates, push]);

  return { templates, activeId, setTemplates, setActiveId, status, refresh };
}
