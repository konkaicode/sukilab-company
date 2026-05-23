import { useState, useEffect } from 'react';

/**
 * localStorage に同期する useState。
 * SSR safe（typeof window で守る）、JSON シリアライズ失敗時は default にフォールバック。
 */
export default function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed = JSON.parse(raw);
      return parsed ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or serialization error — ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
