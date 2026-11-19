import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GifItem } from '../types/gif';

const STORAGE_KEY = 'giftap:favorites:v1';

function readStoredFavorites(): GifItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<GifItem[]>(() => readStoredFavorites());

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setFavorites(readStoredFavorites());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const persist = useCallback((next: GifItem[]) => {
    setFavorites(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors on full storage
    }
  }, []);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);

  const toggleFavorite = useCallback(
    (item: GifItem) => {
      const exists = favorites.some((fav) => fav.id === item.id);
      const next = exists ? favorites.filter((fav) => fav.id !== item.id) : [item, ...favorites];
      persist(next);
    },
    [favorites, persist]
  );

  const mergeImportedFavorites = useCallback(
    (incoming: GifItem[]) => {
      const seen = new Set(favorites.map((item) => item.id));
      const merged = [...favorites];
      for (const item of incoming) {
        if (item && item.id && (item.mp4Url || item.webpUrl || item.url) && !seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }
      persist(merged);
    },
    [favorites, persist]
  );

  return {
    favorites,
    favoriteIds,
    isFavorite,
    toggleFavorite,
    mergeImportedFavorites,
  };
}
