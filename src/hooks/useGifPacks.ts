import { useCallback, useState } from 'react';
import type { GifItem } from '../types/gif';

const PACKS_KEY = 'giftap:packs:v1';

export interface GifPack {
  id: string;
  name: string;
  items: GifItem[];
  createdAt: number;
}

function readPacks(): GifPack[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useGifPacks() {
  const [packs, setPacks] = useState<GifPack[]>(() => readPacks());

  const persist = useCallback((next: GifPack[]) => {
    setPacks(next);
    try {
      window.localStorage.setItem(PACKS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const createPack = useCallback(
    (rawName: string, initialGif?: GifItem): GifPack | null => {
      const name = rawName.trim().slice(0, 32);
      if (!name) return null;
      const newPack: GifPack = {
        id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        items: initialGif ? [initialGif] : [],
        createdAt: Date.now(),
      };
      persist([newPack, ...packs]);
      return newPack;
    },
    [packs, persist]
  );

  const deletePack = useCallback(
    (packId: string) => {
      persist(packs.filter((p) => p.id !== packId));
    },
    [packs, persist]
  );

  const toggleGifInPack = useCallback(
    (packId: string, gif: GifItem) => {
      persist(
        packs.map((pack) => {
          if (pack.id !== packId) return pack;
          const exists = pack.items.some((item) => item.id === gif.id);
          return {
            ...pack,
            items: exists
              ? pack.items.filter((item) => item.id !== gif.id)
              : [gif, ...pack.items],
          };
        })
      );
    },
    [packs, persist]
  );

  const mergeImportedPacks = useCallback(
    (incoming: GifPack[]) => {
      const byId = new Map(packs.map((p) => [p.id, p]));
      for (const p of incoming) {
        if (p && p.id && p.name && Array.isArray(p.items)) {
          byId.set(p.id, p);
        }
      }
      persist(Array.from(byId.values()));
    },
    [packs, persist]
  );

  return {
    packs,
    createPack,
    deletePack,
    toggleGifInPack,
    mergeImportedPacks,
  };
}
