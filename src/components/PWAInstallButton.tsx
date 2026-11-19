import { Download, Share, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#D4FF00] px-3.5 py-2 text-xs font-semibold text-black transition-transform active:scale-[0.97] hover:bg-[#c5ee00] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-display text-lg font-bold text-white">Install GifTap</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-zinc-300">
                <li className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-semibold text-white">
                    1
                  </span>
                  <span>
                    Tap the <Share className="inline h-4 w-4 text-[#D4FF00] mx-0.5" /> Share button in Safari.
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-semibold text-white">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-zinc-800 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
