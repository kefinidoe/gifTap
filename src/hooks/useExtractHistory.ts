import { useCallback, useState } from 'react';
import type { ExtractHistoryEntry, GifItem, SourcePlatform } from '../types/gif';

const HISTORY_KEY = 'giftap:extract-history:v1';
const MAX_HISTORY = 40;

function readHistory(): ExtractHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useExtractHistory() {
  const [history, setHistory] = useState<ExtractHistoryEntry[]>(() => readHistory());

  const persist = useCallback((next: ExtractHistoryEntry[]) => {
    setHistory(next);
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const addHistoryEntry = useCallback(
    (sourceUrl: string, platform: SourcePlatform, item: GifItem) => {
      const normalizedUrl = sourceUrl.trim();
      setHistory((prev) => {
        const entry: ExtractHistoryEntry = {
          id: `${platform}-${Date.now()}`,
          sourceUrl: normalizedUrl,
          platform,
          downloadedAt: Date.now(),
          item,
        };
        const filtered = prev.filter(
          (existing) =>
            existing.sourceUrl !== normalizedUrl && existing.item.mp4Url !== item.mp4Url
        );
        const next = [entry, ...filtered].slice(0, MAX_HISTORY);
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    persist([]);
  }, [persist]);

  return {
    history,
    addHistoryEntry,
    clearHistory,
  };
}
