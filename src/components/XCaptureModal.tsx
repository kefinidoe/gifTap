import { Chrome, Download, Share2, Smartphone, X } from 'lucide-react';
import { useEffect } from 'react';

interface XCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onOpenSharePage: () => void;
}

export function XCaptureModal({ open, onClose, onOpenSharePage }: XCaptureModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Capture GIFs from X"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-zinc-950 p-5 sm:p-6 shadow-2xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" aria-hidden="true" />

        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg sm:text-xl font-bold text-white">
            Capture GIFs from X
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {/* Desktop Browser Extension */}
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
              <Chrome className="h-4 w-4 text-[#D4FF00]" aria-hidden="true" />
              <span>Desktop Browser Extension (Chrome / Edge / Brave)</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              Adds a hover <strong className="text-zinc-200">Send with GifTap</strong> button and right-click menu on <strong className="text-zinc-200">x.com</strong> GIFs. Pre-configured for this deployment.
            </p>
            <ol className="mt-3 space-y-1 text-xs text-zinc-300 list-decimal list-inside">
              <li>Download and unzip the extension folder.</li>
              <li>Open <code className="text-[#D4FF00]">chrome://extensions</code> and enable Developer mode.</li>
              <li>Click <strong className="text-white">Load unpacked</strong> and select the unzipped folder.</li>
            </ol>
            <a
              href="/api/extension.zip"
              download="giftap-x-extension.zip"
              className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#D4FF00] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#c5ee00] whitespace-nowrap"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download Extension (.zip)</span>
            </a>
          </div>

          {/* Mobile PWA Share Target */}
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
              <Smartphone className="h-4 w-4 text-[#D4FF00]" aria-hidden="true" />
              <span>Mobile PWA Share Target</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              Install GifTap to your home screen, then tap Share on any post in the X app and choose <strong className="text-zinc-200">GifTap</strong>. We automatically extract the GIF/MP4 for instant sending.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSharePage();
              }}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-zinc-950 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
            >
              <Share2 className="h-4 w-4 text-[#D4FF00]" aria-hidden="true" />
              <span>Open /share Link Resolver</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
