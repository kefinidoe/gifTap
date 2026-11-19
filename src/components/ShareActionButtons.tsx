import { Check, Copy, Download, Loader2, MessageCircle, Send, Share2 } from 'lucide-react';
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
  onAction?: (action: 'copy' | 'whatsapp' | 'telegram' | 'download' | 'share') => void;
}

type ShareTarget = 'whatsapp' | 'telegram' | 'share' | 'download' | null;

interface PendingShareState {
  channel: 'whatsapp' | 'share';
  file: File;
}

function isMobileShareDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1 &&
      /Macintosh/i.test(navigator.userAgent))
  );
}

export function ShareActionButtons({ gif, onAction }: ShareActionButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [activeTarget, setActiveTarget] = useState<ShareTarget>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTitle, setToastTitle] = useState<string | null>(null);
  const [pendingShare, setPendingShare] = useState<PendingShareState | null>(null);

  const copyTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const bestShareUrl = getPreferredMp4Url(gif);

  // Prefetch MP4 Blob when preview opens so navigator.share keeps transient user activation
  useEffect(() => {
    setPendingShare(null);
    prefetchMp4File(gif);
  }, [gif]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string, duration = 4500, title: string | null = null) => {
    setToastTitle(title);
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      setToastTitle(null);
      toastTimerRef.current = null;
    }, duration);
  };

  const triggerCopiedFeedback = () => {
    setCopied(true);
    onAction?.('copy');
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 1000);
  };

  const handleCopy = async () => {
    if (!bestShareUrl) return;
    try {
      await navigator.clipboard.writeText(bestShareUrl);
      triggerCopiedFeedback();
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = bestShareUrl;
      textarea.className = 'fixed opacity-0 pointer-events-none';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        triggerCopiedFeedback();
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const canShareVideoFile = (file: File): boolean =>
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  const openNativeShareOrDownload = async (
    file: File,
    channel: 'whatsapp' | 'telegram' | 'share'
  ) => {
    if (canShareVideoFile(file)) {
      try {
        await navigator.share({
          files: [file],
          title: 'GifTap',
        });
        onAction?.(channel);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        // Non-abort share error falls back to file download + gallery toast
      }
    }

    downloadVideoFile(file);
    onAction?.(channel);
    showToast(
      file.type === 'video/mp4'
        ? 'Video downloaded - now share it from your gallery'
        : 'GIF downloaded - now share it from your gallery'
    );
  };

  const handleShareAsVideo = async (channel: 'whatsapp' | 'telegram' | 'share') => {
    if (!bestShareUrl || activeTarget !== null) return;
    setActiveTarget(channel);

    try {
      const file = await getMp4FilePromise(gif);
      const canNativeFileShare = isMobileShareDevice() && canShareVideoFile(file);

      if (channel === 'whatsapp' && !canNativeFileShare) {
        downloadVideoFile(file, 'giftap_gif.mp4');
        onAction?.('whatsapp');
        showToast(
          'Drag and drop giftap_gif.mp4 directly into your WhatsApp Web or Desktop chat window so it retains looping GIF behavior.',
          6500,
          'How to share'
        );
        return;
      }

      if ((channel === 'whatsapp' || channel === 'share') && canNativeFileShare) {
        setPendingShare({ channel, file });
        return;
      }
      await openNativeShareOrDownload(file, channel);
    } catch {
      showToast('Unable to prepare MP4 video. Try again.');
    } finally {
      setActiveTarget(null);
    }
  };

  const handleConfirmPendingShare = async () => {
    if (!pendingShare) return;
    const { channel, file } = pendingShare;
    setPendingShare(null);
    await openNativeShareOrDownload(file, channel);
  };

  const handleSaveForWhatsAppGallery = () => {
    if (!pendingShare) return;
    const { channel, file } = pendingShare;
    setPendingShare(null);
    downloadVideoFile(file);
    onAction?.(channel);
    showToast('Video downloaded - now share it from your gallery');
  };

  const handleDownload = async () => {
    if (!bestShareUrl || activeTarget !== null) return;
    setActiveTarget('download');
    try {
      const file = await getMp4FilePromise(gif);
      downloadVideoFile(file);
      onAction?.('download');
      showToast(
        file.type === 'video/mp4'
          ? 'Video downloaded - now share it from your gallery'
          : 'GIF downloaded - now share it from your gallery'
      );
    } catch {
      showToast('Unable to download MP4 video. Try again.');
    } finally {
      setActiveTarget(null);
    }
  };

  const isPreparing = activeTarget !== null;

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <button
          type="button"
          data-giftap-copy-btn="true"
          onClick={handleCopy}
          className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-[#D4FF00] px-4 py-3 text-sm font-semibold text-black transition-all duration-150 hover:bg-[#c5ee00] active:scale-[0.98] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
        >
          {copied ? (
            <>
              <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={!bestShareUrl || isPreparing}
          onClick={() => handleShareAsVideo('whatsapp')}
          className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/35 px-4 py-3 text-sm font-semibold text-[#5BF08E] transition-all duration-150 hover:bg-[#25D366]/25 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
        >
          {activeTarget === 'whatsapp' ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span>WhatsApp</span>
        </button>

        <button
          type="button"
          disabled={!bestShareUrl || isPreparing}
          onClick={() => handleShareAsVideo('telegram')}
          className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-[#2AABEE]/15 border border-[#2AABEE]/35 px-4 py-3 text-sm font-semibold text-[#60C6FF] transition-all duration-150 hover:bg-[#2AABEE]/25 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2AABEE]"
        >
          {activeTarget === 'telegram' ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span>Telegram</span>
        </button>

        <button
          type="button"
          disabled={!bestShareUrl || isPreparing}
          onClick={handleDownload}
          className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-zinc-900 border border-white/12 px-4 py-3 text-sm font-semibold text-zinc-100 transition-all duration-150 hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {activeTarget === 'download' ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span>Download MP4</span>
        </button>
      </div>

      <button
        type="button"
        disabled={!bestShareUrl || isPreparing}
        onClick={() => handleShareAsVideo('share')}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-zinc-900/80 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
      >
        {activeTarget === 'share' ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#D4FF00]" aria-hidden="true" />
        ) : (
          <Share2 className="h-4 w-4 shrink-0 text-[#D4FF00]" aria-hidden="true" />
        )}
        <span>Share Video</span>
      </button>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-[#D4FF00]/35 bg-[#D4FF00]/10 px-3.5 py-2.5 text-center text-xs sm:text-sm font-medium text-[#D4FF00]"
        >
          {toastTitle && (
            <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
              {toastTitle}
            </p>
          )}
          <p>{toastMessage}</p>
        </div>
      )}

      {pendingShare && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="whatsapp-gif-tip-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setPendingShare(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#121214] p-4 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 border border-[#25D366]/35 text-[#5BF08E]">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <p id="whatsapp-gif-tip-title" className="text-sm font-semibold text-white">
                  Tip for WhatsApp GIF mode
                </p>
                <p className="text-xs sm:text-sm leading-relaxed text-zinc-200">
                  In WhatsApp, tap <span className="font-bold text-[#D4FF00]">GIF</span> at top before sending to make it loop as GIF
                </p>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  If WhatsApp opens as a video without a GIF toggle, tap <span className="text-zinc-200 font-medium">Save to Gallery</span> and attach it inside WhatsApp (Gallery → GIF).
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveForWhatsAppGallery}
                  className="flex-1 min-h-[44px] rounded-xl border border-[#25D366]/40 bg-[#25D366]/15 px-3 py-2 text-xs sm:text-sm font-semibold text-[#5BF08E] transition-colors hover:bg-[#25D366]/25"
                >
                  Save to Gallery
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={handleConfirmPendingShare}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#D4FF00] px-3 py-2 text-xs sm:text-sm font-semibold text-black transition-colors hover:bg-[#c5ee00] active:scale-[0.98]"
                >
                  Open Share Sheet
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPendingShare(null)}
                className="w-full min-h-[38px] rounded-xl border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
