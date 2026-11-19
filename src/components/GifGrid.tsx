import { useEffect, useMemo, useRef, useState } from 'react';
import type { GifItem } from '../types/gif';
import { GifCard } from './GifCard';

interface GifGridProps {
  items: GifItem[];
  favoriteIds: Set<string>;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectGif: (gif: GifItem) => void;
  onToggleFavorite: (gif: GifItem) => void;
}

const SKELETON_ASPECTS = [
  'aspect-[4/3]',
  'aspect-square',
  'aspect-[3/4]',
  'aspect-[5/4]',
  'aspect-[4/5]',
  'aspect-square',
  'aspect-[4/3]',
  'aspect-[3/4]',
  'aspect-[5/4]',
  'aspect-[4/3]',
  'aspect-square',
  'aspect-[4/5]',
];

export function GifGrid({
  items,
  favoriteIds,
  isLoadingInitial,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onSelectGif,
  onToggleFavorite,
}: GifGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 2;
    return window.matchMedia('(min-width: 768px)').matches ? 4 : 2;
  });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setColumnCount(mq.matches ? 4 : 2);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!hasMore || isLoadingMore || isLoadingInitial) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '420px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoadingInitial, onLoadMore]);

  const columns = useMemo(() => {
    const cols: GifItem[][] = Array.from({ length: columnCount }, () => []);
    const heights = new Array<number>(columnCount).fill(0);

    for (const item of items) {
      let shortestIndex = 0;
      for (let i = 1; i < columnCount; i++) {
        if (heights[i] < heights[shortestIndex]) {
          shortestIndex = i;
        }
      }
      cols[shortestIndex].push(item);
      const ratio = item.width > 0 ? item.height / item.width : 0.75;
      heights[shortestIndex] += Math.min(Math.max(ratio, 0.45), 1.8) + 0.08;
    }

    return cols;
  }, [items, columnCount]);

  if (isLoadingInitial) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5" aria-label="Loading GIFs">
        {SKELETON_ASPECTS.map((aspectClass, idx) => (
          <div
            key={idx}
            className={`w-full rounded-2xl bg-zinc-900 border border-white/[0.05] animate-pulse ${aspectClass}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 items-start">
        {columns.map((colItems, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-2.5 sm:gap-3.5">
            {colItems.map((gif) => (
              <GifCard
                key={gif.id}
                gif={gif}
                isFavorite={favoriteIds.has(gif.id)}
                onSelect={onSelectGif}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ))}
      </div>

      {isLoadingMore && (
        <div className="mt-3.5 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5" aria-label="Loading more GIFs">
          {SKELETON_ASPECTS.slice(0, 4).map((aspectClass, idx) => (
            <div
              key={idx}
              className={`w-full rounded-2xl bg-zinc-900 border border-white/[0.05] animate-pulse ${aspectClass}`}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="mt-6 flex justify-center py-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="min-h-[44px] rounded-xl border border-white/10 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading more...' : 'Load more GIFs'}
          </button>
        </div>
      )}
    </div>
  );
}
