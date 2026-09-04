import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#1C1917] text-[#FAF8F5] px-3 py-2 text-xs font-medium shadow-lg border border-[#38332F] animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#D97706]" />
      <span>Offline Mode &bull; Timers and audio generators work offline</span>
    </div>
  );
}
