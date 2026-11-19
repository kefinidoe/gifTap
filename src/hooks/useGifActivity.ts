import { useCallback, useMemo, useState } from 'react';
import type { GifItem } from '../types/gif';

const RECENT_KEY = 'giftap:recent-gifs:v1';
const USAGE_KEY = 'giftap:usage:v1';
const MAX_RECENT = 30;

export interface UsageEntry {
  item: GifItem;
  count: number;
  lastUsedAt: number;
}

function readRecentGifs(): GifItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readUsageMap(): Record<string, UsageEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function useGifActivity() {
  const [recentGifs, setRecentGifs] = useState<GifItem[]>(() => readRecentGifs());
  const [usageMap, setUsageMap] = useState<Record<string, UsageEntry>>(() => readUsageMap());

  const persistRecent = useCallback((next: GifItem[]) => {
    setRecentGifs(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const persistUsage = useCallback((next: Record<string, UsageEntry>) => {
    setUsageMap(next);
    try {
      window.localStorage.setItem(USAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const recordView = useCallback(
    (gif: GifItem) => {
      setRecentGifs((prev) => {
        const next = [gif, ...prev.filter((item) => item.id !== gif.id)].slice(0, MAX_RECENT);
        try {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          // Ignore quota errors
        }
        return next;
      });
    },
    []
  );

  const recordSend = useCallback(
    (gif: GifItem) => {
      recordView(gif);
      setUsageMap((prev) => {
        const existing = prev[gif.id];
        const next: Record<string, UsageEntry> = {
          ...prev,
          [gif.id]: {
            item: gif,
            count: (existing?.count ?? 0) + 1,
            lastUsedAt: Date.now(),
          },
        };
        try {
          window.localStorage.setItem(USAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore quota errors
        }
        return next;
      });
    },
    [recordView]
  );

  const clearRecent = useCallback(() => {
    persistRecent([]);
  }, [persistRecent]);

  const clearAnalytics = useCallback(() => {
    persistUsage({});
  }, [persistUsage]);

  const mostUsedEntries = useMemo(() => {
    return Object.values(usageMap)
      .filter((entry) => entry.count > 0 && entry.item)
      .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt);
  }, [usageMap]);

  const totalSends = useMemo(() => {
    return Object.values(usageMap).reduce((sum, entry) => sum + (entry.count || 0), 0);
  }, [usageMap]);

  return {
    recentGifs,
    usageMap,
    mostUsedEntries,
    totalSends,
    recordView,
    recordSend,
    clearRecent,
    clearAnalytics,
  };
}
