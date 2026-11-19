import { Check, ChevronLeft, ChevronRight, Film, FolderPlus, Heart, Plus, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GifPack } from '../hooks/useGifPacks';
import type { GifItem } from '../types/gif';
import { ShareActionButtons } from './ShareActionButtons';

interface GifPreviewModalProps {
  gif: GifItem | null;
  isFavorite: boolean;
  usageCount?: number;
  packs?: GifPack[];
  onClose: () => void;
  onToggleFavorite: (gif: GifItem) => void;
  onToggleGifInPack?: (packId: string, gif: GifItem) => void;
  onCreatePack?: (name: string, initialGif?: GifItem) => void;
  onOpenShareRoute?: (gif: GifItem) => void;
  onSendAction?: (gif: GifItem) => void;
  onNavigate?: (direction: -1 | 1) => void;
}

export function GifPreviewModal({
  gif,
  isFavorite,
  usageCount = 0,
  packs = [],
  onClose,
  onToggleFavorite,
  onToggleGifInPack,
  onCreatePack,
  onOpenShareRoute,
  onSendAction,
  onNavigate,
}: GifPreviewModalProps) {
  const [mediaError, setMediaError] = useState(false);
  const [showPackMenu, setShowPackMenu] = useState(false);
  const [newPackName, setNewPackName] = useState('');

  useEffect(() => {
    setMediaError(false);
    setShowPackMenu(false);
  }, [gif?.id]);

  useEffect(() => {
    if (!gif) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      const targetTag = (event.target as HTMLElement | null)?.tagName;
      const isTyping = targetTag === 'INPUT' || targetTag === 'TEXTAREA';

      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (isTyping) return;

      if (event.key === 'ArrowLeft' && onNavigate) {
        event.preventDefault();
        onNavigate(-1);
      } else if (event.key === 'ArrowRight' && onNavigate) {
        event.preventDefault();
        onNavigate(1);
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        onToggleFavorite(gif);
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        const copyBtn = document.querySelector<HTMLButtonElement>('[data-giftap-copy-btn="true"]');
        copyBtn?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gif, onClose, onNavigate, onToggleFavorite]);

  if (!gif) return null;

  const preferMp4 = Boolean(gif.mp4Url);
  const savedPackCount = packs.filter((p) => p.items.some((i) => i.id === gif.id)).length;

  const handleCreatePackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPackName.trim();
    if (!trimmed || !onCreatePack) return;
    onCreatePack(trimmed, gif);
    setNewPackName('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={gif.title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-zinc-950 p-4 sm:p-6 pb-6 shadow-2xl pb-safe max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" aria-hidden="true" />

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
              {gif.title || 'GIF Preview'}
            </h2>
            {usageCount > 0 && (
              <p className="text-xs text-zinc-500 tabular-nums">
                Sent {usageCount} {usageCount === 1 ? 'time' : 'times'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onToggleGifInPack && (
              <button
                type="button"
                onClick={() => setShowPackMenu((v) => !v)}
                aria-label="Add to GIF pack"
                aria-expanded={showPackMenu}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#D4FF00] ${
                  showPackMenu || savedPackCount > 0
                    ? 'text-[#D4FF00] bg-[#D4FF00]/10'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <FolderPlus className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            {onOpenShareRoute && (
              <button
                type="button"
                onClick={() => onOpenShareRoute(gif)}
                aria-label="Open share page"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white focus-visible:outline-2 focus-visible:outline-[#D4FF00]"
              >
                <Share2 className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleFavorite(gif)}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-[#D4FF00] ${
                isFavorite
                  ? 'text-[#FF3B5C] bg-[#FF3B5C]/10'
                  : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white focus-visible:outline-2 focus-visible:outline-[#D4FF00]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Inline Pack Selector */}
        {showPackMenu && onToggleGifInPack && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-zinc-900/70 p-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {packs.map((pack) => {
                const inPack = pack.items.some((item) => item.id === gif.id);
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => onToggleGifInPack(pack.id, gif)}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                      inPack
                        ? 'bg-[#D4FF00] text-black'
                        : 'bg-zinc-950 border border-white/10 text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {inPack && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    <span>{pack.name}</span>
                  </button>
                );
              })}
              {packs.length === 0 && (
                <span className="text-xs text-zinc-400">Create your first GIF pack below.</span>
              )}
            </div>

            {onCreatePack && (
              <form onSubmit={handleCreatePackSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  placeholder="New pack name (e.g. Reactions)"
                  maxLength={32}
                  className="h-9 flex-1 rounded-xl border border-white/10 bg-black px-3 text-xs text-white placeholder:text-zinc-500 focus:border-[#D4FF00]/70 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1 rounded-xl bg-zinc-800 px-3 text-xs font-semibold text-white hover:bg-zinc-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add</span>
                </button>
              </form>
            )}
          </div>
        )}

        <div className="relative mt-3 overflow-hidden rounded-2xl bg-black border border-white/[0.06] flex items-center justify-center max-h-[45vh]">
          {onNavigate && (
            <>
              <button
                type="button"
                onClick={() => onNavigate(-1)}
                aria-label="Previous GIF"
                className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-xl bg-black/65 text-zinc-200 hover:bg-black hover:text-white backdrop-blur-md transition-colors"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate(1)}
                aria-label="Next GIF"
                className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-xl bg-black/65 text-zinc-200 hover:bg-black hover:text-white backdrop-blur-md transition-colors"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          )}

          {mediaError ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-zinc-500">
              <Film className="h-8 w-8" aria-hidden="true" />
              <span className="text-xs">Preview unavailable</span>
            </div>
          ) : preferMp4 ? (
            <video
              key={gif.mp4Url}
              src={gif.mp4Url}
              poster={gif.stillUrl || gif.webpUrl || undefined}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setMediaError(true)}
              className="max-h-[45vh] w-full object-contain"
            />
          ) : (
            <img
              src={gif.webpUrl}
              alt={gif.title}
              referrerPolicy="no-referrer"
              onError={() => setMediaError(true)}
              className="max-h-[45vh] w-full object-contain"
            />
          )}
        </div>

        <div className="mt-4">
          <ShareActionButtons gif={gif} onAction={() => onSendAction?.(gif)} />
        </div>
      </div>
    </div>
  );
}
