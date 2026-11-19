import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LinkExtractView } from './components/LinkExtractView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';

const SOCIAL_LINK_REGEX =
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:tiktok\.com|instagram\.com|instagr\.am|x\.com|twitter\.com)\/[^\s"'<>]+/i;
const ANY_URL_REGEX = /https?:\/\/[^\s"'<>]+/i;

function extractSharedLinkFromQuery(search: string): {
  url: string;
  toastText: string;
} | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const hasShareTrigger =
    params.get('share') === '1' || params.has('url') || params.has('text');

  if (!hasShareTrigger) return null;

  const candidates = [params.get('url'), params.get('text'), params.get('title')].filter(
    (value): value is string => Boolean(value && value.trim())
  );

  let foundUrl = '';
  for (const raw of candidates) {
    const socialMatch = raw.match(SOCIAL_LINK_REGEX);
    if (socialMatch) {
      foundUrl = socialMatch[0];
      break;
    }
  }

  if (!foundUrl) {
    for (const raw of candidates) {
      const genericMatch = raw.match(ANY_URL_REGEX);
      if (genericMatch) {
        foundUrl = genericMatch[0];
        break;
      }
    }
  }

  if (!foundUrl) return null;

  let toastText = 'Link received from TikTok';
  if (/instagram\.com|instagr\.am/i.test(foundUrl)) {
    toastText = 'Link received from Instagram';
  } else if (/x\.com|twitter\.com/i.test(foundUrl)) {
    toastText = 'Link received from X';
  }

  return { url: foundUrl, toastText };
}

export default function App() {
  const [pendingShareUrl, setPendingShareUrl] = useState<string | undefined>(undefined);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    const parsed = extractSharedLinkFromQuery(window.location.search);
    if (!parsed) return;

    setPendingShareUrl(parsed.url);
    setShareToast(parsed.toastText);
    window.history.replaceState({}, '', '/');

    const timer = window.setTimeout(() => {
      setShareToast(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-50 pb-12">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-black/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 sm:px-6 h-14 sm:h-16">
          <a
            href="/"
            className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4FF00]"
          >
            Gif<span className="text-[#D4FF00]">Tap</span>
          </a>

          <PWAInstallButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-5 sm:pt-8 space-y-4">
        {shareToast && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#D4FF00]/40 bg-[#D4FF00]/10 px-4 py-3 text-sm font-semibold text-[#D4FF00]"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{shareToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setShareToast(null)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-[#D4FF00]/80 hover:bg-[#D4FF00]/15 hover:text-[#D4FF00]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <LinkExtractView
          initialUrl={pendingShareUrl}
          onConsumeInitialUrl={() => setPendingShareUrl(undefined)}
        />
      </main>

      <footer className="mx-auto max-w-4xl px-4 sm:px-6 pt-8 pb-4 border-t border-white/[0.06] mt-10 flex items-center justify-between text-xs text-zinc-500">
        <span>GifTap · PWA Share Overlay</span>
        <span>TikTok · Instagram · X</span>
      </footer>

      <OfflineIndicator />
    </div>
  );
}
