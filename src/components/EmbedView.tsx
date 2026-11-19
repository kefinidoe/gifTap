import { Check, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GifFeedResponse, GifItem } from '../types/gif';

const EMBED_CATEGORIES = [
  'Trending',
  'Funny',
  'Reactions',
  'Love',
  'Memes',
  'Clapping',
  'Yes',
  'No',
  'Sports',
];

export function EmbedView() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialQuery = params.get('q') || '';
  const isModalMode = params.get('modal') === '1';

  const [searchInput, setSearchInput] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [items, setItems] = useState<GifItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sentTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchInput.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    return () => {
      if (sentTimerRef.current !== null) window.clearTimeout(sentTimerRef.current);
    };
  }, []);

  const fetchFeed = useCallback(async (query: string, targetPage: number, append: boolean) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);

    const endpoint = query
      ? `/api/gifs/search?q=${encodeURIComponent(query)}&page=${targetPage}&per_page=20`
      : `/api/gifs/trending?page=${targetPage}&per_page=20`;

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to load');
      const data = (await res.json()) as GifFeedResponse;
      setItems((prev) => {
        if (!append) return data.items;
        const seen = new Set(prev.map((g) => g.id));
        const merged = [...prev];
        for (const item of data.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        }
        return merged;
      });
      setPage(data.page);
      setHasMore(data.hasMore);
    } catch {
      if (!append) setItems([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(debouncedQuery, 1, false);
  }, [debouncedQuery, fetchFeed]);

  useEffect(() => {
    if (!hasMore || isLoadingMore || isLoading) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchFeed(debouncedQuery, page + 1, true);
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, debouncedQuery, page, fetchFeed]);

  const handleOneTapSend = async (gif: GifItem) => {
    setSentId(gif.id);
    if (sentTimerRef.current !== null) window.clearTimeout(sentTimerRef.current);
    sentTimerRef.current = window.setTimeout(() => setSentId(null), 900);

    // Notify host embedder via postMessage
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'giftap:select', gif }, '*');
    }

    // Copy best link to clipboard for instant paste workflows
    const bestUrl = gif.mp4Url || gif.webpUrl || gif.url;
    if (bestUrl && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(bestUrl).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-50 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-black/95 backdrop-blur-md px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-extrabold tracking-tight text-white shrink-0">
            Gif<span className="text-[#D4FF00]">Tap</span>
          </span>

          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tap a GIF to send..."
              aria-label="Search GIFs"
              className="h-9 w-full rounded-xl border border-white/10 bg-zinc-900 pl-8 pr-8 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:border-[#D4FF00]/70 focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedQuery('');
                }}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {isModalMode && (
            <button
              type="button"
              onClick={() => window.parent?.postMessage({ type: 'giftap:close' }, '*')}
              aria-label="Close picker"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-300 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {EMBED_CATEGORIES.map((cat) => {
            const queryVal = cat === 'Trending' ? '' : cat.toLowerCase();
            const isActive = debouncedQuery.toLowerCase() === queryVal;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSearchInput(queryVal);
                  setDebouncedQuery(queryVal);
                }}
                className={`min-h-[30px] rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#D4FF00] text-black'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 p-2.5">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-xl bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((gif) => {
              const isSent = sentId === gif.id;
              return (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => handleOneTapSend(gif)}
                  aria-label={`Send ${gif.title}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-900 border border-white/[0.06] active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-[#D4FF00]"
                >
                  {gif.webpUrl ? (
                    <img
                      src={gif.webpUrl}
                      alt={gif.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={gif.mp4Url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  )}

                  {isSent && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4FF00] px-3 py-1.5 text-xs font-bold text-black">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Sent!
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {hasMore && !isLoading && (
          <div ref={sentinelRef} className="py-4 text-center text-xs text-zinc-500">
            {isLoadingMore ? 'Loading more...' : ''}
          </div>
        )}
      </main>
    </div>
  );
}
