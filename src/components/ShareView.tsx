import { ArrowLeft, Film, Heart, Link2, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useExtractHistory } from '../hooks/useExtractHistory';
import { getBlobVideoDurationSeconds, getMp4FilePromise } from '../lib/shareVideo';
import type { GifItem, SourcePlatform } from '../types/gif';
import { getPlatformLabel, PlatformIcon } from './PlatformIcon';
import { ShareActionButtons } from './ShareActionButtons';

const WHATSAPP_MAX_GIF_SECONDS = 6;
const WHATSAPP_AUTO_LOOP_MAX_BYTES = 1.5 * 1024 * 1024;

interface MediaInspectionState {
  checking: boolean;
  sourceDurationSeconds: number | null;
  preparedDurationSeconds: number | null;
  fileSizeBytes: number | null;
  needsTranscoding: boolean;
  isUnderSixSeconds: boolean | null;
  tooHighForAutoLoop: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface ShareViewProps {
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (gif: GifItem) => void;
  onBackHome: () => void;
}

function extractUrlFromParams(search: string): {
  targetUrl: string;
  title: string;
  text: string;
} {
  const params = new URLSearchParams(search);
  const rawUrl = (params.get('url') || '').trim();
  const rawText = (params.get('text') || '').trim();
  const rawTitle = (params.get('title') || '').trim();

  if (rawUrl) {
    return { targetUrl: rawUrl, title: rawTitle, text: rawText };
  }

  const urlMatch = rawText.match(/https?:\/\/[^\s]+/i);
  return {
    targetUrl: urlMatch?.[0] || '',
    title: rawTitle,
    text: rawText,
  };
}

function buildDirectMediaItem(targetUrl: string, title: string): GifItem | null {
  const cleanPath = targetUrl.split('?')[0].toLowerCase();
  const isVideo = /\.(mp4|webm|mov)$/.test(cleanPath);
  const isImage = /\.(webp|gif|png|jpe?g|avif)$/.test(cleanPath);
  if (!isVideo && !isImage) return null;

  return {
    id: `shared-${targetUrl.slice(-24)}`,
    slug: 'shared-gif',
    title: title || 'Shared GIF',
    url: targetUrl,
    webpUrl: isImage ? targetUrl : '',
    mp4Url: isVideo ? targetUrl : '',
    stillUrl: isImage ? targetUrl : '',
    width: 480,
    height: 360,
    tags: [],
  };
}

export function ShareView({ isFavorite, onToggleFavorite, onBackHome }: ShareViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const [manualUrl, setManualUrl] = useState('');

  const parsed = useMemo(() => extractUrlFromParams(searchQuery), [searchQuery]);
  const directItem = useMemo(
    () => (parsed.targetUrl ? buildDirectMediaItem(parsed.targetUrl, parsed.title) : null),
    [parsed.targetUrl, parsed.title]
  );

  const [gif, setGif] = useState<GifItem | null>(directItem);
  const [platform, setPlatform] = useState<SourcePlatform>('web');
  const [loading, setLoading] = useState<boolean>(Boolean(parsed.targetUrl && !directItem));
  const [error, setError] = useState<string>('');
  const [useProxyVideo, setUseProxyVideo] = useState(false);
  const [useProxyImage, setUseProxyImage] = useState(false);
  const [persistentGifToast, setPersistentGifToast] = useState(false);
  const [inspection, setInspection] = useState<MediaInspectionState>({
    checking: false,
    sourceDurationSeconds: null,
    preparedDurationSeconds: null,
    fileSizeBytes: null,
    needsTranscoding: false,
    isUnderSixSeconds: null,
    tooHighForAutoLoop: false,
  });

  const { addHistoryEntry } = useExtractHistory();

  useEffect(() => {
    setUseProxyVideo(false);
    setUseProxyImage(false);

    if (directItem) {
      setGif(directItem);
      setPlatform('web');
      setLoading(false);
      setError('');
      return;
    }

    if (!parsed.targetUrl) {
      setGif(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetch(`/api/extract?url=${encodeURIComponent(parsed.targetUrl)}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          item?: GifItem;
          platform?: SourcePlatform;
          error?: string;
        };
        if (!res.ok || !data.item) {
          throw new Error(
            data.error ||
              'Could not find GIF. Make sure link is public and is a video/GIF comment.'
          );
        }
        return { item: data.item, platform: data.platform || 'web' };
      })
      .then(({ item, platform: detectedPlatform }) => {
        if (cancelled) return;
        setPlatform(detectedPlatform);
        setGif({
          ...item,
          title: parsed.title || item.title || 'Shared GIF',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setGif(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Could not find GIF. Make sure link is public and is a video/GIF comment.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [parsed.targetUrl, parsed.title, directItem]);

  useEffect(() => {
    setPersistentGifToast(false);

    if (!gif) {
      setInspection({
        checking: false,
        sourceDurationSeconds: null,
        preparedDurationSeconds: null,
        fileSizeBytes: null,
        needsTranscoding: false,
        isUnderSixSeconds: null,
        tooHighForAutoLoop: false,
      });
      return;
    }

    const imageOnlySource =
      !gif.mp4Url || /\.(awebp|webp|gif|apng|png|jpe?g)(\?|$)/i.test(gif.mp4Url);
    let cancelled = false;

    setInspection((prev) => ({
      ...prev,
      checking: true,
      preparedDurationSeconds: null,
      fileSizeBytes: null,
      needsTranscoding: imageOnlySource,
    }));

    getMp4FilePromise(gif)
      .then(async (preparedFile) => {
        if (cancelled) return;
        const preparedDuration = await getBlobVideoDurationSeconds(preparedFile);
        if (cancelled) return;

        setInspection((prev) => {
          const effectiveDuration = preparedDuration ?? prev.sourceDurationSeconds;
          const sourceOverLimit =
            prev.sourceDurationSeconds !== null &&
            prev.sourceDurationSeconds >= WHATSAPP_MAX_GIF_SECONDS;
          const needsTranscoding = imageOnlySource || sourceOverLimit;
          const isUnderSixSeconds =
            effectiveDuration !== null ? effectiveDuration < WHATSAPP_MAX_GIF_SECONDS : null;
          const tooHighForAutoLoop =
            (effectiveDuration !== null && effectiveDuration >= WHATSAPP_MAX_GIF_SECONDS) ||
            preparedFile.size > WHATSAPP_AUTO_LOOP_MAX_BYTES ||
            preparedFile.type !== 'video/mp4';

          return {
            ...prev,
            checking: false,
            preparedDurationSeconds: preparedDuration,
            fileSizeBytes: preparedFile.size,
            needsTranscoding,
            isUnderSixSeconds,
            tooHighForAutoLoop,
          };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setInspection((prev) => ({
          ...prev,
          checking: false,
          tooHighForAutoLoop:
            prev.sourceDurationSeconds !== null &&
            prev.sourceDurationSeconds >= WHATSAPP_MAX_GIF_SECONDS,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [gif]);

  const handleLoadManualUrl = (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = manualUrl.trim();
    if (!cleaned) return;
    const nextSearch = `?url=${encodeURIComponent(cleaned)}`;
    window.history.replaceState({}, '', `/share${nextSearch}`);
    setSearchQuery(nextSearch);
  };

  const saved = gif ? isFavorite(gif.id) : false;
  const videoSrc =
    gif?.mp4Url && useProxyVideo
      ? `/api/gifs/download?url=${encodeURIComponent(gif.mp4Url)}&filename=giftap`
      : gif?.mp4Url || '';

  const imageSrc =
    gif?.webpUrl && useProxyImage
      ? `/api/gifs/download?url=${encodeURIComponent(gif.webpUrl)}&filename=giftap`
      : gif?.webpUrl || '';

  const displayDuration = inspection.preparedDurationSeconds ?? inspection.sourceDurationSeconds;

  return (
    <div className="min-h-screen bg-black text-zinc-50 px-4 py-5 sm:py-10">
      <div className="mx-auto max-w-xl">
        <header className="flex items-center justify-between gap-4 pb-5">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to GifTap</span>
          </button>

          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            Gif<span className="text-[#D4FF00]">Tap</span>
          </span>
        </header>

        <main className="rounded-3xl border border-white/10 bg-zinc-950 p-4 sm:p-6 shadow-2xl">
          {loading ? (
            <div className="space-y-4 py-6 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#D4FF00]" aria-hidden="true" />
              <p className="font-display text-base font-semibold text-white">Finding your GIF...</p>
              <div className="aspect-[4/3] w-full rounded-2xl bg-zinc-900 animate-pulse" />
            </div>
          ) : !parsed.targetUrl && !parsed.text ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-white/10 text-[#D4FF00]">
                <Link2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-4 font-display text-xl font-bold text-white">
                Save GIF from TikTok, IG, or X
              </h1>
              <p className="mt-2 max-w-sm text-sm text-zinc-400">
                Paste any TikTok, Instagram Reel, X (Twitter) post link, or MP4 URL to load and share it as an MP4 video.
              </p>

              <form onSubmit={handleLoadManualUrl} className="mt-5 flex w-full max-w-md flex-col sm:flex-row gap-2.5">
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/... or instagram.com/reel/..."
                  aria-label="Social post or GIF URL"
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#D4FF00]/70 focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-[#D4FF00] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c5ee00] whitespace-nowrap"
                >
                  Find GIF
                </button>
              </form>
            </div>
          ) : error && !gif ? (
            <div className="py-6 text-center space-y-4">
              <p role="alert" className="text-sm text-rose-300">
                {error}
              </p>
              <form onSubmit={handleLoadManualUrl} className="flex w-full max-w-md mx-auto flex-col sm:flex-row gap-2.5">
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="Try another public link..."
                  aria-label="Social post or GIF URL"
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#D4FF00]/70 focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-[#D4FF00] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c5ee00] whitespace-nowrap"
                >
                  Try Link
                </button>
              </form>
            </div>
          ) : gif ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-white/10 text-[#D4FF00]">
                    <PlatformIcon platform={platform} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate">
                      {gif.title || 'Shared GIF'}
                    </h1>
                    <p className="text-xs text-zinc-400">
                      {getPlatformLabel(platform)} · Looping MP4
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(gif)}
                  aria-label={saved ? 'Remove from favorites' : 'Save to favorites'}
                  aria-pressed={saved}
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors ${
                    saved
                      ? 'text-[#FF3B5C] bg-[#FF3B5C]/10'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Heart className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
                </button>
              </div>

              {parsed.text && parsed.text !== parsed.targetUrl && (
                <p className="mt-1.5 text-sm text-zinc-400 break-words">{parsed.text}</p>
              )}

              <div className="mt-4 overflow-hidden rounded-2xl bg-black border border-white/[0.06] flex items-center justify-center min-h-[240px] max-h-[60vh]">
                {videoSrc ? (
                  <video
                    key={videoSrc}
                    src={videoSrc}
                    poster={gif.stillUrl || gif.webpUrl || undefined}
                    autoPlay
                    loop
                    muted
                    playsInline
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget.duration;
                      if (!Number.isFinite(d) || d <= 0) return;
                      setInspection((prev) => {
                        const effectiveDuration = prev.preparedDurationSeconds ?? d;
                        const sourceOverLimit = d >= WHATSAPP_MAX_GIF_SECONDS;
                        const imageOnlySource =
                          !gif.mp4Url ||
                          /\.(awebp|webp|gif|apng|png|jpe?g)(\?|$)/i.test(gif.mp4Url);
                        return {
                          ...prev,
                          sourceDurationSeconds: d,
                          needsTranscoding: imageOnlySource || sourceOverLimit,
                          isUnderSixSeconds: effectiveDuration < WHATSAPP_MAX_GIF_SECONDS,
                          tooHighForAutoLoop:
                            effectiveDuration >= WHATSAPP_MAX_GIF_SECONDS ||
                            (prev.fileSizeBytes !== null &&
                              prev.fileSizeBytes > WHATSAPP_AUTO_LOOP_MAX_BYTES),
                        };
                      });
                    }}
                    onError={() => {
                      if (!useProxyVideo) {
                        setUseProxyVideo(true);
                      }
                    }}
                    className="max-h-[60vh] w-full object-contain"
                  />
                ) : imageSrc ? (
                  <img
                    key={imageSrc}
                    src={imageSrc}
                    alt={gif.title}
                    referrerPolicy="no-referrer"
                    onError={() => {
                      if (!useProxyImage) {
                        setUseProxyImage(true);
                      }
                    }}
                    className="max-h-[60vh] w-full object-contain"
                  />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
                    <Film className="h-8 w-8" aria-hidden="true" />
                    <span className="text-xs break-all">{parsed.targetUrl}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">
                <span>
                  {inspection.checking
                    ? 'Checking WhatsApp GIF compatibility...'
                    : inspection.tooHighForAutoLoop
                      ? 'Large clip or 6s+ · Tap GIF button in WhatsApp'
                      : inspection.needsTranscoding
                        ? 'Transcoded to <6s MP4 for WhatsApp GIF'
                        : inspection.isUnderSixSeconds
                          ? 'Under 6s · WhatsApp GIF-ready'
                          : 'WhatsApp MP4 ready'}
                </span>
                <span className="text-zinc-400 tabular-nums">
                  {[
                    displayDuration !== null ? `${displayDuration.toFixed(1)}s` : null,
                    formatFileSize(inspection.fileSizeBytes) || null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>

              <div className="mt-4">
                <ShareActionButtons
                  gif={gif}
                  onAction={(action) => {
                    if (
                      action === 'download' ||
                      action === 'whatsapp' ||
                      action === 'telegram' ||
                      action === 'share'
                    ) {
                      addHistoryEntry(parsed.targetUrl || gif.url, platform, gif);
                    }
                    if (
                      (action === 'whatsapp' || action === 'share') &&
                      (inspection.tooHighForAutoLoop ||
                        (inspection.checking &&
                          inspection.sourceDurationSeconds !== null &&
                          inspection.sourceDurationSeconds >= WHATSAPP_MAX_GIF_SECONDS))
                    ) {
                      setPersistentGifToast(true);
                    }
                  }}
                />
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {persistentGifToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[#D4FF00]/50 bg-[#121214] px-4 py-3 text-sm font-semibold text-[#D4FF00] shadow-2xl"
        >
          <span>Tap GIF button in WhatsApp before sending</span>
          <button
            type="button"
            onClick={() => setPersistentGifToast(false)}
            aria-label="Dismiss instruction"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
