import { Film, Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { GifItem } from '../types/gif';

interface GifCardProps {
  gif: GifItem;
  isFavorite: boolean;
  onSelect: (gif: GifItem) => void;
  onToggleFavorite: (gif: GifItem) => void;
}

export function GifCard({ gif, isFavorite, onSelect, onToggleFavorite }: GifCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const useWebp = Boolean(gif.webpUrl);
  const useVideoFallback = !useWebp && Boolean(gif.mp4Url);

  useEffect(() => {
    if (!useVideoFallback || !videoRef.current) return;
    const videoEl = videoRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            videoEl.play().catch(() => {});
          } else {
            videoEl.pause();
          }
        }
      },
      { rootMargin: '150px' }
    );

    observer.observe(videoEl);
    return () => observer.disconnect();
  }, [useVideoFallback]);

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-zinc-900/90 border border-white/[0.06] transition-transform duration-150 ease-out active:scale-[0.985]">
      <button
        type="button"
        onClick={() => onSelect(gif)}
        aria-label={`Preview ${gif.title}`}
        className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#D4FF00]"
      >
        {!loaded && !failed && (
          <div className="absolute inset-0 animate-pulse bg-zinc-900" aria-hidden="true" />
        )}

        {failed ? (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-zinc-900 px-3 text-center">
            <Film className="h-6 w-6 text-zinc-600" aria-hidden="true" />
            <span className="line-clamp-2 text-xs font-medium text-zinc-500">{gif.title}</span>
          </div>
        ) : useWebp ? (
          <img
            src={gif.webpUrl}
            alt={gif.title}
            width={gif.width}
            height={gif.height}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`block w-full h-auto object-cover transition-opacity duration-200 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <video
            ref={videoRef}
            src={gif.mp4Url}
            poster={gif.stillUrl || undefined}
            width={gif.width}
            height={gif.height}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onLoadedData={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`block w-full h-auto object-cover transition-opacity duration-200 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden sm:flex items-end bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="truncate text-xs font-medium text-zinc-100">{gif.title}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(gif);
        }}
        aria-label={isFavorite ? `Remove ${gif.title} from favorites` : `Save ${gif.title} to favorites`}
        aria-pressed={isFavorite}
        className="absolute top-1 right-1 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-[#D4FF00]"
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl backdrop-blur-md transition-all duration-150 ${
            isFavorite
              ? 'bg-[#FF3B5C]/90 text-white shadow-sm'
              : 'bg-black/55 text-zinc-200 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 hover:bg-black/80 hover:text-white'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
