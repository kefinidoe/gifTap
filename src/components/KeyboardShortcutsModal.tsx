import { Keyboard, X } from 'lucide-react';
import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['/'], description: 'Focus search bar' },
  { keys: ['1', '2', '3', '4'], description: 'Switch Trending, Grab Link, Recent, Saved tabs' },
  { keys: ['←', '→'], description: 'Previous / next GIF inside preview' },
  { keys: ['C'], description: 'Copy GIF link inside preview' },
  { keys: ['F'], description: 'Toggle Favorite inside preview' },
  { keys: ['Esc'], description: 'Close modal or overlay' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
];

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
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
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-zinc-950 p-5 sm:p-6 shadow-2xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-[#D4FF00]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-white/[0.06]">
          {SHORTCUTS.map((item) => (
            <li key={item.description} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="text-zinc-300">{item.description}</span>
              <div className="flex items-center gap-1 shrink-0">
                {item.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex min-w-[26px] items-center justify-center rounded-lg border border-white/15 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-100"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
