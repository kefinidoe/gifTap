import { ArrowLeft, Check, Code2, Copy, Download, Play, Sparkles, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GifItem } from '../types/gif';

interface DevelopersViewProps {
  onBackHome: () => void;
}

interface ChatMessage {
  id: string;
  gif: GifItem;
  timestamp: string;
}

const API_ENDPOINTS = [
  {
    id: 'trending',
    label: 'Trending',
    method: 'GET',
    path: '/api/v1/trending?page=1&per_page=6',
  },
  {
    id: 'search',
    label: 'Search',
    method: 'GET',
    path: '/api/v1/search?q=reactions&page=1&per_page=6',
  },
  {
    id: 'categories',
    label: 'Categories',
    method: 'GET',
    path: '/api/v1/categories',
  },
  {
    id: 'resolve',
    label: 'Resolve URL',
    method: 'GET',
    path: '/api/v1/resolve?url=https%3A%2F%2Fstatic.klipy.com%2Fii%2F925f17378dd1893b674a723c07535afe%2Fcb%2Feb%2FEv7I1SJr.mp4',
  },
];

export function DevelopersView({ onBackHome }: DevelopersViewProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-giftap-app.vercel.app';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedEndpoint, setSelectedEndpoint] = useState(API_ENDPOINTS[0]);
  const [apiResponse, setApiResponse] = useState<string>('');
  const [apiLoading, setApiLoading] = useState<boolean>(false);

  // Listen for live one-tap GIF selection from the embedded /embed preview iframe
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'giftap:select' && event.data?.gif) {
        const gif = event.data.gif as GifItem;
        setMessages((prev) => [
          {
            id: `${gif.id}-${Date.now()}`,
            gif,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev.slice(0, 5),
        ]);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // Ignore clipboard failures
    }
  };

  const runApiRequest = async (path: string) => {
    setApiLoading(true);
    try {
      const res = await fetch(path);
      const data = await res.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setApiResponse(JSON.stringify({ error: err instanceof Error ? err.message : 'Request failed' }, null, 2));
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    runApiRequest(selectedEndpoint.path);
  }, [selectedEndpoint]);

  const sdkSnippet = `<script src="${origin}/embed.js"></script>
<button id="gif-btn">Add GIF</button>
<script>
  document.getElementById('gif-btn').onclick = () => {
    GifTap.openPicker({
      onSelect: (gif) => {
        // Fast WebP/MP4 URLs ready to send
        console.log(gif.mp4Url, gif.webpUrl);
      }
    });
  };
</script>`;

  const iframeSnippet = `<iframe
  src="${origin}/embed?q=reactions"
  width="100%"
  height="460"
  style="border:0;border-radius:16px;"
  allow="clipboard-write"
></iframe>`;

  return (
    <div className="min-h-screen bg-black text-zinc-50 pb-16">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-black/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 h-16">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to GifTap</span>
          </button>

          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            Gif<span className="text-[#D4FF00]">Tap</span> Developers
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 space-y-12">
        <section className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
            Add one-tap GIF sending to any app
          </h1>
          <p className="mt-3 text-base text-zinc-400 leading-relaxed">
            Embed the lightweight GifTap picker widget with two lines of HTML, install the X browser extension, or query our CORS-enabled REST API directly for fast WebP and MP4 clips.
          </p>
        </section>

        {/* Live Embeddable Widget Sandbox */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 rounded-3xl border border-white/10 bg-zinc-950 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-[#D4FF00]" aria-hidden="true" />
                <span>Live Embeddable Widget</span>
              </div>
              <span className="text-xs text-zinc-500">Tap any GIF to test</span>
            </div>
            <iframe
              src="/embed"
              title="GifTap Embed Widget Demo"
              allow="clipboard-write"
              className="h-[430px] w-full rounded-2xl border border-white/10 bg-black"
            />
          </div>

          <div className="lg:col-span-6 space-y-5">
            {/* Simulated Host App Receiving postMessage */}
            <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
              <h2 className="font-display text-base font-bold text-white">
                Host App Event Stream (<code className="text-[#D4FF00] text-sm">giftap:select</code>)
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                When a user taps a GIF in the widget, your page receives the media URLs via <code className="text-zinc-200">window.postMessage</code>.
              </p>

              <div className="mt-4 min-h-[160px] rounded-2xl border border-white/[0.06] bg-black p-3.5 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex h-[136px] items-center justify-center text-xs text-zinc-500 text-center px-4">
                    Tap any GIF on the left to watch it appear instantly in this simulated chat feed.
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-zinc-900/70 p-2"
                    >
                      <img
                        src={msg.gif.webpUrl || msg.gif.stillUrl}
                        alt={msg.gif.title}
                        className="h-14 w-16 rounded-lg object-cover bg-black shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate">{msg.gif.title}</div>
                        <div className="mt-0.5 text-[11px] text-zinc-400 truncate">
                          {msg.gif.mp4Url || msg.gif.webpUrl}
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">{msg.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Drop-In Script SDK */}
            <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Code2 className="h-4 w-4 text-[#D4FF00]" aria-hidden="true" />
                  <span>Drop-In Picker SDK</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText('sdk', sdkSnippet)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
                >
                  {copiedId === 'sdk' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#D4FF00]" aria-hidden="true" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-black border border-white/[0.06] p-3.5 text-xs text-zinc-300 leading-relaxed">
                <code>{sdkSnippet}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Iframe & Extension Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-white">Inline Iframe Embed</h2>
              <button
                type="button"
                onClick={() => copyText('iframe', iframeSnippet)}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                {copiedId === 'iframe' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#D4FF00]" aria-hidden="true" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-black border border-white/[0.06] p-3.5 text-xs text-zinc-300 leading-relaxed">
              <code>{iframeSnippet}</code>
            </pre>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5 flex flex-col justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-white">X / Twitter Browser Extension</h2>
              <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
                Adds a hover <strong className="text-zinc-200">Send with GifTap</strong> button and right-click context menu directly on x.com timelines, pre-configured for this host.
              </p>
            </div>
            <a
              href="/api/extension.zip"
              download="giftap-x-extension.zip"
              className="mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#D4FF00] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c5ee00] whitespace-nowrap"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download Extension (.zip)</span>
            </a>
          </div>
        </section>

        {/* Public REST API Explorer */}
        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-base font-bold text-white font-display">
                <Terminal className="h-4 w-4 text-[#D4FF00]" aria-hidden="true" />
                <span>Developer REST API (<code className="text-sm text-[#D4FF00]">/api/v1/*</code>)</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                CORS-enabled public JSON endpoints returning fast WebP and MP4 URLs with aspect-ratio dimensions.
              </p>
            </div>

            <button
              type="button"
              onClick={() => runApiRequest(selectedEndpoint.path)}
              disabled={apiLoading}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#D4FF00] px-4 py-2 text-xs font-semibold text-black hover:bg-[#c5ee00] disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{apiLoading ? 'Running...' : 'Run Request'}</span>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {API_ENDPOINTS.map((ep) => {
              const active = ep.id === selectedEndpoint.id;
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => setSelectedEndpoint(ep)}
                  className={`min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#D4FF00] text-black'
                      : 'bg-zinc-900 border border-white/[0.08] text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {ep.method} {ep.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-black px-3.5 py-2.5 text-xs text-zinc-200">
            <code className="truncate">{origin}{selectedEndpoint.path}</code>
            <button
              type="button"
              onClick={() => copyText('curl', `curl "${origin}${selectedEndpoint.path}"`)}
              className="shrink-0 text-zinc-400 hover:text-white font-medium"
            >
              {copiedId === 'curl' ? 'Copied!' : 'Copy curl'}
            </button>
          </div>

          <pre className="mt-3 max-h-[340px] overflow-auto rounded-xl border border-white/[0.06] bg-black p-4 text-xs text-zinc-300 leading-relaxed">
            <code>{apiLoading ? 'Loading response...' : apiResponse}</code>
          </pre>
        </section>
      </main>
    </div>
  );
}
