import { Layers, ShieldCheck, Smartphone, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getOverlayState,
  requestOverlayPermission,
  toggleFloatingBubble,
} from '../lib/floatingBubble';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSimulateBubbleExtract?: () => void;
}

export function SettingsModal({
  open,
  onClose,
  onSimulateBubbleExtract,
}: SettingsModalProps) {
  const [isAndroidNative, setIsAndroidNative] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatusMessage(null);
    getOverlayState().then((state) => {
      setIsAndroidNative(state.isAndroidNative);
      setPermissionGranted(state.permissionGranted);
      setEnabled(state.running);
    });
  }, [open]);

  if (!open) return null;

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    setStatusMessage(null);
    const nextValue = !enabled;
    try {
      const result = await toggleFloatingBubble(nextValue);
      setEnabled(result.enabled);
      setPermissionGranted(result.permissionGranted);
      if (result.needsPermission) {
        setStatusMessage(
          'Allow "Draw over other apps" in Android Settings to show the floating button.'
        );
      } else if (result.enabled) {
        setStatusMessage(
          isAndroidNative
            ? 'Floating 60×60 GifTap button is active on top of TikTok, Instagram, and X.'
            : 'Floating button preference saved ON (active inside the GifTap Android APK).'
        );
      } else {
        setStatusMessage('Floating button turned OFF.');
      }
    } catch {
      setStatusMessage('Could not update floating overlay state.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestPermission = async () => {
    setBusy(true);
    try {
      const granted = await requestOverlayPermission();
      setPermissionGranted(granted);
      setStatusMessage(
        granted
          ? 'Overlay permission granted. Toggle Floating Button ON to show the bubble.'
          : 'Permission still disabled. Enable "Allow display over other apps" for GifTap.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="giftap-settings-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0E0E10] p-5 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 text-[#D4FF00]">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="giftap-settings-title" className="font-display text-lg font-bold text-white">
                GifTap Settings
              </h2>
              <p className="text-xs text-zinc-400">Android Floating Capture &amp; Overlay</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Enable Floating Button ON/OFF Toggle */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="block text-sm font-semibold text-white">
                Enable Floating Button
              </span>
              <span className="block text-xs text-zinc-400">
                Show 60×60 draggable GifTap logo over TikTok, IG &amp; X
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Enable Floating Button"
              disabled={busy}
              onClick={handleToggle}
              className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] ${
                enabled
                  ? 'border-[#D4FF00] bg-[#D4FF00]'
                  : 'border-white/15 bg-zinc-800'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full transition-transform ${
                  enabled ? 'translate-x-7 bg-black' : 'translate-x-1 bg-zinc-300'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-zinc-300">
              <ShieldCheck className="h-4 w-4 text-[#D4FF00]" aria-hidden="true" />
              <span>Draw over other apps</span>
            </span>
            {isAndroidNative ? (
              permissionGranted ? (
                <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">
                  Granted
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  disabled={busy}
                  className="rounded-lg bg-[#D4FF00]/15 px-2.5 py-1 font-semibold text-[#D4FF00] hover:bg-[#D4FF00]/25"
                >
                  Grant Permission
                </button>
              )
            ) : (
              <span className="rounded-lg bg-zinc-800 px-2 py-0.5 font-medium text-zinc-300">
                Android APK
              </span>
            )}
          </div>
        </div>

        {statusMessage && (
          <p
            role="status"
            className="rounded-xl border border-[#D4FF00]/30 bg-[#D4FF00]/10 px-3.5 py-2.5 text-xs leading-relaxed text-[#D4FF00]"
          >
            {statusMessage}
          </p>
        )}

        {/* How the Floating Bubble works */}
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Smartphone className="h-3.5 w-3.5 text-[#D4FF00]" aria-hidden="true" />
            <span>How Floating Capture Works</span>
          </div>
          <ol className="space-y-1.5 text-xs text-zinc-300 list-decimal list-inside">
            <li>Turn <span className="font-semibold text-white">Enable Floating Button ON</span> and grant <span className="font-semibold text-white">Draw over other apps</span>.</li>
            <li>While watching a comment GIF on TikTok, Instagram, or X, copy the link.</li>
            <li>Tap the floating <span className="font-semibold text-[#D4FF00]">GifTap</span> bubble to grab the link and open the extractor automatically.</li>
          </ol>

          {!isAndroidNative && onSimulateBubbleExtract && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSimulateBubbleExtract();
              }}
              className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              <Zap className="h-3.5 w-3.5 text-[#D4FF00]" aria-hidden="true" />
              <span>Test Quick Clipboard Capture in Extractor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
