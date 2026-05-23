import { useState, useEffect, useCallback } from 'react';

/**
 * 過去 N 日（既定 365）の日次集計を取得。
 * 1度のフェッチで全グラフ（バー・ヒートマップ・累計・週月）に使う。
 */
function isoOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function useStatsRange({ days = 365 } = {}) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | offline

  const refresh = useCallback(async () => {
    setStatus('loading');
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));
    const fromStr = isoOf(from);
    const toStr = isoOf(today);
    try {
      const res = await fetch(`/api/stats/range?from=${fromStr}&to=${toStr}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setStatus('ready');
    } catch (err) {
      console.warn('[useStatsRange] offline:', err.message);
      setStatus('offline');
    }
  }, [days]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, status, refresh };
}
