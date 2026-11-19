import {
  AlertCircle,
  ClipboardPaste,
  Download,
  Film,
  Link2,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useExtractHistory } from '../hooks/useExtractHistory';
import { apiUrl } from '../lib/apiBase';
import type { ExtractHistoryEntry, GifItem, SourcePlatform } from '../types/gif';
import { getPlatformLabel, PlatformIcon } from './PlatformIcon';
import { ShareActionButtons } from './ShareActionButtons';

interface LinkExtractViewProps {
  initialUrl?: string;
  onConsumeInitialUrl?: () => void;
}

interface ExtractSuccessResponse {
  item: GifItem;
  platform: SourcePlatform;
  sourceUrl: string;
}

const DEFAULT_EXTRACT_ERROR =
  'Could not find GIF. Make sure the link is public and contains a video or GIF comment.';

function formatHistoryDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleDateString();
  }
}

export function LinkExtractView({
  initialUrl,
  onConsumeInitialUrl,
}: LinkExtractViewProps) {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractSuccessResponse | null>(null);
  const [useProxyVideo, setUseProxyVideo] = useState(false);
  const [useProxyImage, setUseProxyImage] = useState(false);

  const previewSectionRef = useRef<HTMLDivElement | null>(null);
  const { history, addHistoryEntry, clearHistory } = useExtractHistory();

  const runExtract = useCallback(async (rawLink: string) => {
    const trimmed = rawLink.trim();
    if (!trimmed) {
      setErrorMessage('Paste a TikTok, Instagram, or X link first.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setExtracted(null);
    setUseProxyVideo(false);
    setUseProxyImage(false);

    try {
      const response = await fetch(apiUrl(`/api/extract?url=${encodeURIComponent(trimmed)}`));
      const data = (await response.json()) as Partial<ExtractSuccessResponse> & {
        error?: string;
      };

      if (!response.ok || !data.item) {
        throw new Error(data.error || DEFAULT_EXTRACT_ERROR);
      }

      const nextExtracted: ExtractSuccessResponse = {
        item: data.item,
        platform: data.platform || 'web',
        sourceUrl: data.sourceUrl || trimmed,
      };
      setExtracted(nextExtracted);
      addHistoryEntry(nextExtracted.sourceUrl, nextExtracted.platform, nextExtracted.item);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : DEFAULT_EXTRACT_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [addHistoryEntry]);

  useEffect(() => {
    if (!initialUrl) return;
    setUrlInput(initialUrl);
    void runExtract(initialUrl);
    onConsumeInitialUrl?.();
  }, [initialUrl, runExtract, onConsumeInitialUrl]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runExtract(urlInput);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const trimmed = text.trim();
        setUrlInput(trimmed);
        void runExtract(trimmed);
      }
    } catch {
      // Clipboard permission declined or unavailable
    }
  };

  const handleActionComplete = () => {
    if (!extracted) return;
    addHistoryEntry(extracted.sourceUrl, extracted.platform, extracted.item);
  };

  const handleReopenHistory = (entry: ExtractHistoryEntry) => {
    setErrorMessage(null);
    setUseProxyVideo(false);
    setUseProxyImage(false);
    setUrlInput(entry.sourceUrl);
    setExtracted({
      item: entry.item,
      platform: entry.platform,
      sourceUrl: entry.sourceUrl,
    });
    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const currentVideoSrc =
    extracted?.item.mp4Url && useProxyVideo
      ? apiUrl(`/api/gifs/download?url=${encodeURIComponent(extracted.item.mp4Url)}&filename=giftap`)
      : extracted?.item.mp4Url || '';

  const currentImageSrc =
    extracted?.item.webpUrl && useProxyImage
      ? apiUrl(`/api/gifs/download?url=${encodeURIComponent(extracted.item.webpUrl)}&filename=giftap`)
      : extracted?.item.webpUrl || '';

  return (
    <div className="space-y-8" ref={previewSectionRef}>
      {/* Extractor Input Panel */}
      <section
        aria-label="Paste TikTok, Instagram, or X link"
        className="rounded-3xl border border-white/10 bg-zinc-950 p-4 sm:p-6"
      >
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <PlatformIcon platform="tiktok" className="h-3.5 w-3.5 text-zinc-300" />
            <span>TikTok</span>
            <span aria-hidden="true">·</span>
            <PlatformIcon platform="instagram" className="h-3.5 w-3.5 text-zinc-300" />
            <span>Instagram</span>
            <span aria-hidden="true">·</span>
            <PlatformIcon platform="x" className="h-3.5 w-3.5 text-zinc-300" />
            <span>X (Twitter)</span>
          </div>

          <h1 className="mt-2 font-display text-xl sm:text-2xl font-bold text-white">
            Extract &amp; Share GIFs Instantly
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Paste a link or use your phone&apos;s Share menu to open GifTap and grab <span className="text-zinc-200">giftap.mp4</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Link2
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="url"
              inputMode="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste TikTok, Instagram, or X link..."
              aria-label="Paste TikTok, Instagram, or X link"
              className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-900 pl-10 pr-24 text-sm text-white placeholder:text-zinc-500 focus:border-[#D4FF00]/70 focus:outline-none"
            />
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-white/10 bg-zinc-800 px-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
            >
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Paste</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#D4FF00] px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-[#c5ee00] active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isLoading ? 'Extracting...' : 'Extract GIF'}</span>
          </button>
        </form>

        {/* Loading State */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 rounded-2xl border border-white/[0.08] bg-black p-6 sm:p-8 flex flex-col items-center justify-center gap-3 text-center"
          >
            <Loader2 className="h-7 w-7 animate-spin text-[#D4FF00]" aria-hidden="true" />
            <p className="font-display text-base font-semibold text-white">Extracting GIF...</p>
            <div className="mt-2 h-40 w-full max-w-sm rounded-xl bg-zinc-900 animate-pulse" />
          </div>
        )}

        {/* Error State */}
        {errorMessage && !isLoading && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Extracted Looping Video Preview */}
        {extracted && !isLoading && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black p-4 sm:p-5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-white/10 text-[#D4FF00]">
                <PlatformIcon platform={extracted.platform} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-sm sm:text-base font-bold text-white truncate">
                  {extracted.item.title || `${getPlatformLabel(extracted.platform)} GIF`}
                </h2>
                <p className="text-xs text-zinc-400">
                  {getPlatformLabel(extracted.platform)} ·{' '}
                  {currentVideoSrc ? 'Looping MP4 (silent)' : 'Animated GIF'}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950 flex items-center justify-center max-h-[52vh]">
              {currentVideoSrc ? (
                <video
                  key={currentVideoSrc}
                  src={currentVideoSrc}
                  poster={extracted.item.stillUrl || extracted.item.webpUrl || undefined}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={() => {
                    if (!useProxyVideo) {
                      setUseProxyVideo(true);
                    }
                  }}
                  className="max-h-[52vh] w-full object-contain"
                />
              ) : currentImageSrc ? (
                <img
                  key={currentImageSrc}
                  src={currentImageSrc}
                  alt={extracted.item.title}
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (!useProxyImage) {
                      setUseProxyImage(true);
                    }
                  }}
                  className="max-h-[52vh] w-full object-contain"
                />
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-zinc-500">
                  <Film className="h-8 w-8" aria-hidden="true" />
                  <span className="text-xs">Preview unavailable</span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <ShareActionButtons gif={extracted.item} onAction={handleActionComplete} />
            </div>
          </div>
        )}
      </section>

      {/* History Grid (localStorage) */}
      <section aria-label="History">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-lg font-bold text-white">History</h2>
            <span className="text-xs text-zinc-500 tabular-nums">{history.length} saved</span>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-zinc-950 p-6 sm:p-8 text-center">
            <p className="text-sm text-zinc-400">
              Extracted TikTok, Instagram, and X GIFs are saved here locally for instant re-sharing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {history.map((entry) => {
              const thumb = entry.item.stillUrl || entry.item.webpUrl;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleReopenHistory(entry)}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950 text-left transition-all hover:border-[#D4FF00]/50 focus-visible:outline-2 focus-visible:outline-[#D4FF00]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={entry.item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    ) : entry.item.mp4Url ? (
                      <video
                        src={entry.item.mp4Url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-600">
                        <Film className="h-6 w-6" aria-hidden="true" />
                      </div>
                    )}

                    <span
                      title={getPlatformLabel(entry.platform)}
                      className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/75 text-white backdrop-blur-md border border-white/10"
                    >
                      <PlatformIcon platform={entry.platform} className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-zinc-100 truncate">
                      {entry.item.title || `${getPlatformLabel(entry.platform)} GIF`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
                      {getPlatformLabel(entry.platform)} · {formatHistoryDate(entry.downloadedAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
