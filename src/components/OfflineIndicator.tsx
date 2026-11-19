import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-zinc-950/95 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-md whitespace-nowrap"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
      <span>Offline — saved favorites remain available</span>
    </div>
  );
}
