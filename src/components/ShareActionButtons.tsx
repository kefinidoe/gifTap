import { Download, Loader2, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  downloadVideoFile,
  getMp4FilePromise,
  getPreferredMp4Url,
  prefetchMp4File,
} from '../lib/shareVideo';
import type { GifItem } from '../types/gif';

interface ShareActionButtonsProps {
  gif: GifItem;
  onAction?: (action: 'download' | 'share') => void;
}

type ActiveAction = 'download' | 'share' | null;

export function ShareActionButtons({ gif, onAction }: ShareActionButtonsProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const bestMediaUrl = getPreferredMp4Url(gif);

  // Prefetch normalized giftap.mp4 File so navigator.share keeps user gesture activation
  useEffect(() => {
    prefetchMp4File(gif);
  }, [gif]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string, duration = 4500) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, duration);
  };

  const handleDownloadGif = async () => {
    if (!bestMediaUrl || activeAction !== null) return;
    setActiveAction('download');
    try {
      const file = await getMp4FilePromise(gif);
      downloadVideoFile(file, 'giftap.mp4');
      onAction?.('download');
      showToast('Downloaded giftap.mp4');
    } catch {
      showToast('Unable to download giftap.mp4. Please try again.');
    } finally {
      setActiveAction(null);
    }
  };

  const handleShareFile = async () => {
    if (!bestMediaUrl || activeAction !== null) return;
    setActiveAction('share');
    try {
      const file = await getMp4FilePromise(gif);
      const canShareFile =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: 'GifTap',
          });
          onAction?.('share');
          showToast('In WhatsApp, tap GIF at top before sending so it loops.');
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          // Fall through to file download if native share failed unexpectedly
        }
      }

      downloadVideoFile(file, 'giftap.mp4');
      onAction?.('share');
      showToast('File sharing is not supported in this browser — downloaded giftap.mp4 instead.');
    } catch {
      showToast('Unable to prepare giftap.mp4 for sharing. Please try again.');
    } finally {
      setActiveAction(null);
    }
  };

  const isBusy = activeAction !== null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!bestMediaUrl || isBusy}
          onClick={handleDownloadGif}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#D4FF00] px-4 py-3 text-sm font-bold text-black transition-all hover:bg-[#c5ee00] active:scale-[0.98] disabled:opacity-60 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
        >
          {activeAction === 'download' ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>Download GIF</span>
        </button>

        <button
          type="button"
          disabled={!bestMediaUrl || isBusy}
          onClick={handleShareFile}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
        >
          {activeAction === 'share' ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#D4FF00]" aria-hidden="true" />
          ) : (
            <Share2 className="h-4 w-4 shrink-0 text-[#D4FF00]" aria-hidden="true" />
          )}
          <span>Share</span>
        </button>
      </div>

      <p className="text-center text-[11px] text-zinc-500">
        Downloads &amp; shares as silent looping <span className="text-zinc-300">giftap.mp4</span>. In WhatsApp, tap <span className="text-zinc-300">GIF</span> before sending.
      </p>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-[#D4FF00]/35 bg-[#D4FF00]/10 px-3.5 py-2.5 text-center text-xs sm:text-sm font-medium text-[#D4FF00]"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
