import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Flame,
  FolderPlus,
  Heart,
  Keyboard,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DevelopersView } from './components/DevelopersView';
import { EmbedView } from './components/EmbedView';
import { GifGrid } from './components/GifGrid';
import { GifPreviewModal } from './components/GifPreviewModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { LinkExtractView } from './components/LinkExtractView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SettingsModal } from './components/SettingsModal';
import { ShareView } from './components/ShareView';
import { XCaptureModal } from './components/XCaptureModal';
import { useFavorites } from './hooks/useFavorites';
import { useGifActivity } from './hooks/useGifActivity';
import { useGifPacks } from './hooks/useGifPacks';
import type { GifPack } from './hooks/useGifPacks';
import { useRecentSearches } from './hooks/useRecentSearches';
import {
  addBubbleTapListener,
  consumePendingBubbleLink,
  syncFloatingBubbleOnLaunch,
} from './lib/floatingBubble';
import type { GifFeedResponse, GifItem } from './types/gif';

type ActiveTab = 'trending' | 'extract' | 'recent' | 'favorites';
type RecentSubTab = 'recent' | 'most-used';

interface CategoryItem {
  label: string;
  query: string;
}

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { label: 'Funny', query: 'funny' },
  { label: 'Reactions', query: 'reactions' },
  { label: 'Love', query: 'love' },
  { label: 'Sports', query: 'sports' },
  { label: 'Memes', query: 'memes' },
  { label: 'Gaming', query: 'gaming' },
  { label: 'Anime', query: 'anime' },
  { label: 'Animals', query: 'animals' },
  { label: 'Celebration', query: 'celebration' },
  { label: 'Movies', query: 'movies' },
  { label: 'Music', query: 'music' },
  { label: 'LOL', query: 'lol' },
  { label: 'Excited', query: 'excited' },
  { label: 'Happy', query: 'happy' },
  { label: 'Sad', query: 'sad' },
  { label: 'Angry', query: 'angry' },
  { label: 'Dance', query: 'dance' },
  { label: 'Clapping', query: 'clapping' },
  { label: 'Thumbs Up', query: 'thumbs up' },
  { label: 'High Five', query: 'high five' },
  { label: 'Congratulations', query: 'congratulations' },
  { label: 'Happy Birthday', query: 'happy birthday' },
  { label: 'Thank You', query: 'thank you' },
  { label: 'Hello', query: 'hello' },
  { label: 'Bye', query: 'bye' },
  { label: 'Good Morning', query: 'good morning' },
  { label: 'Good Night', query: 'good night' },
  { label: 'Yes', query: 'yes' },
  { label: 'No', query: 'no' },
  { label: 'OK', query: 'ok' },
  { label: 'Sorry', query: 'sorry' },
  { label: 'Please', query: 'please' },
  { label: 'Confused', query: 'confused' },
  { label: 'Surprised', query: 'surprised' },
  { label: 'Scared', query: 'scared' },
  { label: 'Nervous', query: 'nervous' },
  { label: 'Embarrassed', query: 'embarrassed' },
  { label: 'Bored', query: 'bored' },
  { label: 'Hungry', query: 'hungry' },
  { label: 'Kiss', query: 'kiss' },
  { label: 'Hugs', query: 'hugs' },
  { label: 'Smile', query: 'smile' },
  { label: 'Wink', query: 'wink' },
  { label: 'Aww', query: 'aww' },
  { label: 'Good Luck', query: 'good luck' },
  { label: "You're Welcome", query: 'youre welcome' },
];

export default function App() {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('trending');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [items, setItems] = useState<GifItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingKeyError, setMissingKeyError] = useState(false);

  const [selectedGif, setSelectedGif] = useState<GifItem | null>(null);
  const [showXCapture, setShowXCapture] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingExtractUrl, setPendingExtractUrl] = useState<string | undefined>(undefined);
  const [recentSubTab, setRecentSubTab] = useState<RecentSubTab>('recent');
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [showNewPackForm, setShowNewPackForm] = useState(false);
  const [newPackInput, setNewPackInput] = useState('');
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { favorites, favoriteIds, isFavorite, toggleFavorite, mergeImportedFavorites } =
    useFavorites();
  const { recentSearches, addSearch, removeSearch, clearSearches } = useRecentSearches();
  const {
    recentGifs,
    usageMap,
    mostUsedEntries,
    totalSends,
    recordView,
    recordSend,
    clearRecent,
    clearAnalytics,
  } = useGifActivity();
  const { packs, createPack, deletePack, toggleGifInPack, mergeImportedPacks } = useGifPacks();

  // Enrich categories bar with live Klipy categories
  useEffect(() => {
    let cancelled = false;
    fetch('/api/gifs/categories')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { categories?: CategoryItem[] } | null) => {
        if (cancelled || !data?.categories?.length) return;
        setCategories((prev) => {
          const seen = new Set(prev.map((c) => c.query.toLowerCase()));
          const merged = [...prev];
          for (const cat of data.categories!) {
            const key = cat.query.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(cat);
            }
          }
          return merged;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync browser back/forward navigation between / and /share
  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openExtractorFromBubble = useCallback(async (capturedUrl?: string) => {
    let resolvedUrl = capturedUrl?.trim() || '';
    if (!resolvedUrl && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const clipText = await navigator.clipboard.readText();
        const urlMatch = clipText.match(/https?:\/\/\S+/i);
        if (urlMatch) {
          resolvedUrl = urlMatch[0];
        }
      } catch {
        // Clipboard permission may not be granted on web; extractor still opens ready for paste
      }
    }

    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
      setPathname('/');
    }
    setSelectedGif(null);
    setShowSettings(false);
    setShowXCapture(false);
    setActiveTab('extract');
    if (resolvedUrl) {
      setPendingExtractUrl(resolvedUrl);
    }
  }, []);

  // Sync Android floating overlay bubble service and listen for bubble taps / pending links
  useEffect(() => {
    let cancelled = false;
    let removeTapListener: (() => void) | null = null;

    syncFloatingBubbleOnLaunch().catch(() => {});

    const checkPending = async () => {
      const pending = await consumePendingBubbleLink();
      if (!cancelled && pending) {
        await openExtractorFromBubble(pending.url);
      }
    };

    void checkPending();

    addBubbleTapListener((event) => {
      if (!cancelled) {
        void openExtractorFromBubble(event.url);
      }
    }).then((cleanup) => {
      if (cancelled) {
        cleanup?.();
      } else {
        removeTapListener = cleanup;
      }
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkPending();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      removeTapListener?.();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [openExtractorFromBubble]);

  // Global keyboard shortcuts (desktop)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        pathname.startsWith('/share') ||
        pathname.startsWith('/embed') ||
        pathname.startsWith('/developers')
      ) {
        return;
      }
      const targetTag = (event.target as HTMLElement | null)?.tagName;
      const isTyping = targetTag === 'INPUT' || targetTag === 'TEXTAREA';
      if (isTyping || selectedGif || showXCapture) return;

      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === '?' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setShowShortcuts((v) => !v);
      } else if (!showShortcuts && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === '1') {
          setActiveTab('trending');
        } else if (event.key === '2') {
          setActiveTab('extract');
        } else if (event.key === '3') {
          setActiveTab('recent');
        } else if (event.key === '4') {
          setActiveTab('favorites');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname, selectedGif, showXCapture, showShortcuts]);

  // Debounce search query (250ms for snappy search-as-you-type)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchFeedPage = useCallback(
    async (query: string, targetPage: number, append: boolean) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingInitial(true);
        setErrorMessage(null);
        setMissingKeyError(false);
      }

      const endpoint = query
        ? `/api/gifs/search?q=${encodeURIComponent(query)}&page=${targetPage}&per_page=24`
        : `/api/gifs/trending?page=${targetPage}&per_page=24`;

      try {
        const res = await fetch(endpoint, { signal: controller.signal });
        const data = (await res.json()) as GifFeedResponse & { error?: string; code?: string };

        if (!res.ok) {
          if (data.code === 'MISSING_API_KEY') {
            setMissingKeyError(true);
          }
          throw new Error(data.error || 'Unable to load GIFs from Klipy.');
        }

        setItems((prev) => {
          if (!append) return data.items;
          const seen = new Set(prev.map((g) => g.id));
          const merged = [...prev];
          for (const g of data.items) {
            if (!seen.has(g.id)) {
              seen.add(g.id);
              merged.push(g);
            }
          }
          return merged;
        });
        setPage(data.page);
        setHasMore(data.hasMore);
        setErrorMessage(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load GIFs.');
        if (!append) {
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingInitial(false);
          setIsLoadingMore(false);
        }
      }
    },
    []
  );

  // Load initial trending or search results when debouncedQuery changes
  useEffect(() => {
    if (
      pathname.startsWith('/share') ||
      pathname.startsWith('/embed') ||
      pathname.startsWith('/developers')
    ) {
      return;
    }
    fetchFeedPage(debouncedQuery, 1, false);
  }, [debouncedQuery, pathname, fetchFeedPage]);

  // Record committed search queries into recent searches after user pauses typing
  useEffect(() => {
    if (!debouncedQuery) return;
    const isPresetCategory = categories.some(
      (cat) => cat.query.toLowerCase() === debouncedQuery.toLowerCase()
    );
    if (isPresetCategory) return;

    const timer = window.setTimeout(() => {
      addSearch(debouncedQuery);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [debouncedQuery, categories, addSearch]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || isLoadingInitial || !hasMore) return;
    fetchFeedPage(debouncedQuery, page + 1, true);
  }, [debouncedQuery, page, hasMore, isLoadingMore, isLoadingInitial, fetchFeedPage]);

  const handleSelectCategory = (term: string) => {
    setActiveTab('trending');
    setSearchInput(term);
    setDebouncedQuery(term);
  };

  const handleSelectRecentSearch = (term: string) => {
    setActiveTab('trending');
    setSearchInput(term);
    setDebouncedQuery(term);
    addSearch(term);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setDebouncedQuery('');
    searchInputRef.current?.focus();
  };

  const activePack = useMemo(
    () => packs.find((p) => p.id === selectedPackId) ?? null,
    [packs, selectedPackId]
  );

  useEffect(() => {
    if (selectedPackId && !activePack) {
      setSelectedPackId(null);
    }
  }, [selectedPackId, activePack]);

  const activeVisibleList = useMemo(() => {
    if (activeTab === 'trending') return items;
    if (activeTab === 'recent') {
      return recentSubTab === 'recent'
        ? recentGifs
        : mostUsedEntries.map((entry) => entry.item);
    }
    return activePack ? activePack.items : favorites;
  }, [activeTab, recentSubTab, items, recentGifs, mostUsedEntries, activePack, favorites]);

  const handleSelectGif = useCallback(
    (gif: GifItem) => {
      recordView(gif);
      setSelectedGif(gif);
    },
    [recordView]
  );

  const handleNavigatePreview = useCallback(
    (direction: -1 | 1) => {
      if (!selectedGif || activeVisibleList.length === 0) return;
      const idx = activeVisibleList.findIndex((g) => g.id === selectedGif.id);
      if (idx === -1) return;
      const nextIdx = (idx + direction + activeVisibleList.length) % activeVisibleList.length;
      const nextGif = activeVisibleList[nextIdx];
      if (nextGif) {
        recordView(nextGif);
        setSelectedGif(nextGif);
      }
    },
    [selectedGif, activeVisibleList, recordView]
  );

  const handleCreatePackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const created = createPack(newPackInput);
    if (created) {
      setSelectedPackId(created.id);
      setNewPackInput('');
      setShowNewPackForm(false);
    }
  };

  const handleExportLibrary = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      favorites,
      packs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `giftap-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBackupStatus(`Exported ${favorites.length} favorites and ${packs.length} packs.`);
    window.setTimeout(() => setBackupStatus(null), 3500);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { favorites?: GifItem[]; packs?: GifPack[] };
      const importedFavs = Array.isArray(parsed.favorites) ? parsed.favorites : [];
      const importedPacks = Array.isArray(parsed.packs) ? parsed.packs : [];
      if (importedFavs.length === 0 && importedPacks.length === 0) {
        setBackupStatus('No favorites or packs found in that backup file.');
      } else {
        if (importedFavs.length > 0) mergeImportedFavorites(importedFavs);
        if (importedPacks.length > 0) mergeImportedPacks(importedPacks);
        setBackupStatus(
          `Imported ${importedFavs.length} favorites and ${importedPacks.length} packs.`
        );
      }
    } catch {
      setBackupStatus('Could not read backup JSON file.');
    }
    window.setTimeout(() => setBackupStatus(null), 4000);
  };

  const navigateToShare = (gif: GifItem) => {
    const shareTarget = gif.url || gif.mp4Url || gif.webpUrl;
    const nextUrl = `/share?url=${encodeURIComponent(shareTarget)}&title=${encodeURIComponent(gif.title)}`;
    window.history.pushState({}, '', nextUrl);
    setSelectedGif(null);
    setPathname('/share');
  };

  const navigateHome = () => {
    window.history.pushState({}, '', '/');
    setPathname('/');
  };

  if (pathname.startsWith('/embed')) {
    return <EmbedView />;
  }

  if (pathname.startsWith('/developers')) {
    return (
      <>
        <DevelopersView onBackHome={navigateHome} />
        <OfflineIndicator />
      </>
    );
  }

  if (pathname.startsWith('/share')) {
    return (
      <>
        <ShareView
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
          onBackHome={navigateHome}
        />
        <OfflineIndicator />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-50 pb-20 md:pb-10">
      {/* Compact Sticky Top Bar (< 15% mobile viewport height) */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-black/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-5 px-3 sm:px-6 h-14 sm:h-16">
          <button
            type="button"
            onClick={() => {
              setActiveTab('trending');
              setSearchInput('');
              setDebouncedQuery('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4FF00]"
          >
            Gif<span className="text-[#D4FF00]">Tap</span>
          </button>

          {/* Top Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = searchInput.trim();
              const matchedUrl =
                trimmed.match(
                  /https?:\/\/(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com|instagram\.com|instagr\.am|x\.com|twitter\.com|giphy\.com|tenor\.com)\/\S+/i
                )?.[0] || (/^https?:\/\//i.test(trimmed) ? trimmed : '');
              if (matchedUrl) {
                setPendingExtractUrl(matchedUrl);
                setSearchInput('');
                setDebouncedQuery('');
                setActiveTab('extract');
                return;
              }
              setActiveTab('trending');
              setDebouncedQuery(trimmed);
              if (trimmed) {
                addSearch(trimmed);
              }
            }}
            className="relative flex-1 max-w-2xl"
          >
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchInput}
              onChange={(e) => {
                const nextVal = e.target.value;
                const urlMatch = nextVal.match(
                  /https?:\/\/(?:[a-z0-9-]+\.)*(?:tiktok\.com|tiktokcdn[^/]*|ibyteimg\.com|byteimg\.com|ibytedtos\.com|instagram\.com|instagr\.am|x\.com|twitter\.com|giphy\.com|tenor\.com)\/\S+/i
                );
                if (urlMatch) {
                  setPendingExtractUrl(urlMatch[0]);
                  setSearchInput('');
                  setDebouncedQuery('');
                  setActiveTab('extract');
                  return;
                }
                setSearchInput(nextVal);
                if (activeTab !== 'trending') setActiveTab('trending');
              }}
              placeholder="Search GIFs or paste TikTok/IG/X link..."
              aria-label="Search GIFs or paste TikTok, Instagram, or X link"
              className="h-10 sm:h-11 w-full rounded-xl border border-white/10 bg-zinc-900/95 pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 transition-colors focus:border-[#D4FF00]/70 focus:bg-zinc-900 focus:outline-none"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <kbd className="pointer-events-none hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center rounded border border-white/10 bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
                /
              </kbd>
            )}
          </form>

          {/* Desktop Navigation Tabs + Install Action */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <nav className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1 border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab('trending')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'trending'
                    ? 'bg-[#D4FF00] text-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Flame className="h-4 w-4" aria-hidden="true" />
                <span>Trending</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('extract')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'extract'
                    ? 'bg-[#D4FF00] text-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                <span>From Link</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('recent')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'recent'
                    ? 'bg-[#D4FF00] text-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>Recent</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'favorites'
                    ? 'bg-[#D4FF00] text-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${activeTab === 'favorites' ? 'fill-current' : ''}`}
                  aria-hidden="true"
                />
                <span>Saved</span>
                <span className="tabular-nums text-xs opacity-80">({favorites.length})</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="GifTap Settings"
              title="GifTap Settings & Floating Button"
              className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-300 transition-colors hover:border-[#D4FF00]/40 hover:bg-zinc-800 hover:text-[#D4FF00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 sm:px-6 pt-3 sm:pt-5">
        {activeTab === 'trending' ? (
          <>
            {/* All Categories Filter Bar */}
            <div className="relative mb-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => categoryScrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                aria-label="Scroll categories left"
                className="hidden md:flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-900/90 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <div
                ref={categoryScrollRef}
                role="group"
                aria-label="GIF categories"
                className="flex flex-1 items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
              >
                <button
                  type="button"
                  onClick={() => handleSelectCategory('')}
                  className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    !debouncedQuery
                      ? 'bg-[#D4FF00] text-black font-semibold'
                      : 'bg-zinc-900 border border-white/[0.08] text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  All Trending
                </button>
                {categories.map((category) => {
                  const isActive = debouncedQuery.toLowerCase() === category.query.toLowerCase();
                  return (
                    <button
                      key={category.query}
                      type="button"
                      onClick={() => handleSelectCategory(isActive ? '' : category.query)}
                      className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-[#D4FF00] text-black font-semibold'
                          : 'bg-zinc-900 border border-white/[0.08] text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => categoryScrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                aria-label="Scroll categories right"
                className="hidden md:flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-900/90 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Recent Searches Chips */}
            {recentSearches.length > 0 && (
              <div className="mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 whitespace-nowrap shrink-0 pr-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Recent</span>
                </span>
                {recentSearches.map((term) => {
                  const isActive = debouncedQuery.toLowerCase() === term.toLowerCase();
                  return (
                    <div
                      key={term}
                      className={`inline-flex items-center rounded-xl border transition-colors shrink-0 ${
                        isActive
                          ? 'border-[#D4FF00]/60 bg-[#D4FF00]/15 text-[#D4FF00]'
                          : 'border-white/[0.08] bg-zinc-950 text-zinc-300 hover:border-white/15'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectRecentSearch(term)}
                        className="min-h-[36px] pl-3 pr-1.5 py-1.5 text-xs font-medium whitespace-nowrap"
                      >
                        {term}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSearch(term)}
                        aria-label={`Remove ${term} from recent searches`}
                        className="flex min-h-[36px] min-w-[30px] items-center justify-center pr-1.5 text-zinc-500 hover:text-zinc-200"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={clearSearches}
                  className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 whitespace-nowrap shrink-0"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">
                {debouncedQuery ? `Results for "${debouncedQuery}"` : 'Trending now'}
              </h1>
              {items.length > 0 && (
                <span className="text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                  {items.length} loaded
                </span>
              )}
            </div>

            {errorMessage && items.length === 0 && !isLoadingInitial ? (
              <div className="my-8 rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-10 text-center max-w-lg mx-auto">
                <h2 className="font-display text-lg font-bold text-white">
                  {missingKeyError ? 'Klipy API key required' : 'Could not load GIFs'}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {missingKeyError
                    ? 'Set KLIPY_API_KEY in your environment secrets to enable live trending and search results.'
                    : errorMessage}
                </p>
                <button
                  type="button"
                  onClick={() => fetchFeedPage(debouncedQuery, 1, false)}
                  className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#D4FF00] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c5ee00]"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>Try again</span>
                </button>
              </div>
            ) : !isLoadingInitial && items.length === 0 ? (
              <div className="my-12 rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center max-w-md mx-auto">
                <h2 className="font-display text-lg font-bold text-white">No GIFs found</h2>
                <p className="mt-1.5 text-sm text-zinc-400">
                  Try another search keyword or jump back to trending clips.
                </p>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="mt-5 min-h-[44px] rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
                >
                  Show Trending
                </button>
              </div>
            ) : (
              <GifGrid
                items={items}
                favoriteIds={favoriteIds}
                isLoadingInitial={isLoadingInitial}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                onSelectGif={handleSelectGif}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </>
        ) : activeTab === 'extract' ? (
          <LinkExtractView
            initialUrl={pendingExtractUrl}
            onConsumeInitialUrl={() => setPendingExtractUrl(undefined)}
            onSearchKeyword={(keyword) => {
              setActiveTab('trending');
              setSearchInput(keyword);
              setDebouncedQuery(keyword);
              addSearch(keyword);
            }}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onRecordSend={recordSend}
          />
        ) : activeTab === 'recent' ? (
          <section aria-label="Recent and most used GIFs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl border border-white/[0.08] bg-zinc-900 p-1">
                  <button
                    type="button"
                    onClick={() => setRecentSubTab('recent')}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                      recentSubTab === 'recent'
                        ? 'bg-[#D4FF00] text-black'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Recently Viewed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentSubTab('most-used')}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                      recentSubTab === 'most-used'
                        ? 'bg-[#D4FF00] text-black'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Most Used</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="tabular-nums">
                  {recentGifs.length} recent · {totalSends} total sends
                </span>
                {(recentSubTab === 'recent' ? recentGifs.length > 0 : mostUsedEntries.length > 0) && (
                  <button
                    type="button"
                    onClick={recentSubTab === 'recent' ? clearRecent : clearAnalytics}
                    className="min-h-[36px] px-2 text-zinc-400 hover:text-white transition-colors whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {recentSubTab === 'recent' ? (
              recentGifs.length === 0 ? (
                <div className="my-12 rounded-3xl border border-white/10 bg-zinc-950 p-8 sm:p-12 text-center max-w-md mx-auto">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-[#D4FF00]">
                    <Clock className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 font-display text-lg font-bold text-white">
                    No recent GIFs yet
                  </h2>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Tap any GIF to preview or send it and it will appear right here for quick reuse.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('trending')}
                    className="mt-6 min-h-[44px] rounded-xl bg-[#D4FF00] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c5ee00]"
                  >
                    Browse Trending
                  </button>
                </div>
              ) : (
                <GifGrid
                  items={recentGifs}
                  favoriteIds={favoriteIds}
                  isLoadingInitial={false}
                  isLoadingMore={false}
                  hasMore={false}
                  onLoadMore={() => {}}
                  onSelectGif={handleSelectGif}
                  onToggleFavorite={toggleFavorite}
                />
              )
            ) : mostUsedEntries.length === 0 ? (
              <div className="my-12 rounded-3xl border border-white/10 bg-zinc-950 p-8 sm:p-12 text-center max-w-md mx-auto">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-[#D4FF00]">
                  <TrendingUp className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mt-4 font-display text-lg font-bold text-white">
                  No sends tracked yet
                </h2>
                <p className="mt-1.5 text-sm text-zinc-400">
                  Copy, share, or send a GIF via WhatsApp or Telegram to build your personal top GIFs list.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('trending')}
                  className="mt-6 min-h-[44px] rounded-xl bg-[#D4FF00] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c5ee00]"
                >
                  Browse Trending
                </button>
              </div>
            ) : (
              <GifGrid
                items={mostUsedEntries.map((entry) => entry.item)}
                favoriteIds={favoriteIds}
                isLoadingInitial={false}
                isLoadingMore={false}
                hasMore={false}
                onLoadMore={() => {}}
                onSelectGif={handleSelectGif}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </section>
        ) : (
          <section aria-label="Saved GIFs and custom packs">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <h1 className="font-display text-lg sm:text-xl font-bold text-white">
                  {activePack ? activePack.name : 'Saved Favorites'}
                </h1>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {activePack ? activePack.items.length : favorites.length}{' '}
                  {(activePack ? activePack.items.length : favorites.length) === 1 ? 'GIF' : 'GIFs'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={importFileRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleExportLibrary}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Export Backup</span>
                </button>
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Import Backup</span>
                </button>
              </div>
            </div>

            {backupStatus && (
              <p role="status" className="mb-3 text-xs text-[#D4FF00]">
                {backupStatus}
              </p>
            )}

            {/* Favorites + Custom Packs Filter Row */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedPackId(null)}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  !selectedPackId
                    ? 'bg-[#D4FF00] text-black font-semibold'
                    : 'bg-zinc-900 border border-white/[0.08] text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                <span>All Favorites</span>
                <span className="tabular-nums opacity-75">({favorites.length})</span>
              </button>

              {packs.map((pack) => {
                const isSelected = selectedPackId === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#D4FF00] text-black font-semibold'
                        : 'bg-zinc-900 border border-white/[0.08] text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{pack.name}</span>
                    <span className="tabular-nums opacity-75">({pack.items.length})</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowNewPackForm((v) => !v)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-dashed border-white/15 bg-zinc-950 px-3.5 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:border-white/30 hover:text-white whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>New Pack</span>
              </button>

              {activePack && (
                <button
                  type="button"
                  onClick={() => deletePack(activePack.id)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-rose-400 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete Pack</span>
                </button>
              )}
            </div>

            {showNewPackForm && (
              <form
                onSubmit={handleCreatePackSubmit}
                className="mb-4 flex max-w-md items-center gap-2"
              >
                <input
                  type="text"
                  value={newPackInput}
                  onChange={(e) => setNewPackInput(e.target.value)}
                  placeholder="Pack name (e.g. Work Memes, Group Chat)"
                  maxLength={32}
                  autoFocus
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#D4FF00]/70 focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-[#D4FF00] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c5ee00] whitespace-nowrap"
                >
                  Create
                </button>
              </form>
            )}

            {activeVisibleList.length === 0 ? (
              <div className="my-12 rounded-3xl border border-white/10 bg-zinc-950 p-8 sm:p-12 text-center max-w-md mx-auto">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-[#FF3B5C]">
                  {activePack ? (
                    <FolderPlus className="h-6 w-6 text-[#D4FF00]" aria-hidden="true" />
                  ) : (
                    <Heart className="h-6 w-6" aria-hidden="true" />
                  )}
                </div>
                <h2 className="mt-4 font-display text-lg font-bold text-white">
                  {activePack ? `${activePack.name} is empty` : 'No favorites saved yet'}
                </h2>
                <p className="mt-1.5 text-sm text-zinc-400">
                  {activePack
                    ? 'Open any GIF preview and tap the folder icon to add GIFs into this pack.'
                    : 'Tap the heart on any GIF to keep it right here for instant sending.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('trending')}
                  className="mt-6 min-h-[44px] rounded-xl bg-[#D4FF00] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c5ee00]"
                >
                  Explore Trending
                </button>
              </div>
            ) : (
              <GifGrid
                items={activeVisibleList}
                favoriteIds={favoriteIds}
                isLoadingInitial={false}
                isLoadingMore={false}
                hasMore={false}
                onLoadMore={() => {}}
                onSelectGif={handleSelectGif}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-3 sm:px-6 pt-8 pb-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] mt-10 text-xs text-zinc-500">
        <span>GifTap · Powered by Klipy</span>
        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className="inline-flex items-center gap-1.5 hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Shortcuts (?)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/developers');
              setPathname('/developers');
              window.scrollTo({ top: 0 });
            }}
            className="hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
          >
            Embed &amp; Developer API
          </button>
          <button
            type="button"
            onClick={() => setShowXCapture(true)}
            className="hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
          >
            X Browser Extension
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
          >
            Floating Button Settings
          </button>
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/share');
              setPathname('/share');
              window.scrollTo({ top: 0 });
            }}
            className="hover:text-zinc-200 transition-colors underline-offset-4 hover:underline"
          >
            Share URL
          </button>
        </div>
      </footer>

      {/* Mobile Bottom Thumb-Zone Tab Bar (56px height -> combined with 56px header < 15% cap) */}
      <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-white/[0.08] bg-black/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-4 h-14">
          <button
            type="button"
            onClick={() => setActiveTab('trending')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'trending' ? 'text-[#D4FF00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Flame className="h-5 w-5" aria-hidden="true" />
            <span>Trending</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('extract')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'extract' ? 'text-[#D4FF00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Link2 className="h-5 w-5" aria-hidden="true" />
            <span>Grab Link</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recent')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'recent' ? 'text-[#D4FF00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="h-5 w-5" aria-hidden="true" />
            <span>Recent</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'favorites' ? 'text-[#D4FF00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Heart
              className={`h-5 w-5 ${activeTab === 'favorites' ? 'fill-current text-[#FF3B5C]' : ''}`}
              aria-hidden="true"
            />
            <span className="tabular-nums">Saved ({favorites.length})</span>
          </button>
        </div>
      </nav>

      <GifPreviewModal
        gif={selectedGif}
        isFavorite={selectedGif ? isFavorite(selectedGif.id) : false}
        usageCount={selectedGif ? usageMap[selectedGif.id]?.count ?? 0 : 0}
        packs={packs}
        onClose={() => setSelectedGif(null)}
        onToggleFavorite={toggleFavorite}
        onToggleGifInPack={toggleGifInPack}
        onCreatePack={createPack}
        onOpenShareRoute={navigateToShare}
        onSendAction={recordSend}
        onNavigate={activeVisibleList.length > 1 ? handleNavigatePreview : undefined}
      />

      <XCaptureModal
        open={showXCapture}
        onClose={() => setShowXCapture(false)}
        onOpenSharePage={() => {
          window.history.pushState({}, '', '/share');
          setPathname('/share');
        }}
      />

      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSimulateBubbleExtract={() => void openExtractorFromBubble()}
      />

      <OfflineIndicator />
    </div>
  );
}
