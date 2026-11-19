import { useCallback, useState } from 'react';

const STORAGE_KEY = 'giftap:recent-searches:v1';
const MAX_ITEMS = 8;

function readRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, MAX_ITEMS)
      : [];
  } catch {
    return [];
  }
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());

  const persist = useCallback((next: string[]) => {
    setRecentSearches(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const addSearch = useCallback(
    (term: string) => {
      const cleaned = term.trim();
      if (!cleaned) return;
      const lower = cleaned.toLowerCase();
      const next = [cleaned, ...recentSearches.filter((item) => item.toLowerCase() !== lower)].slice(0, MAX_ITEMS);
      persist(next);
    },
    [recentSearches, persist]
  );

  const removeSearch = useCallback(
    (term: string) => {
      const lower = term.toLowerCase();
      persist(recentSearches.filter((item) => item.toLowerCase() !== lower));
    },
    [recentSearches, persist]
  );

  const clearSearches = useCallback(() => {
    persist([]);
  }, [persist]);

  return {
    recentSearches,
    addSearch,
    removeSearch,
    clearSearches,
  };
}
