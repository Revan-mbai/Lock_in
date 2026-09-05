import { useState } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running inside an installed standalone PWA, render a subtle indicator or nothing
  if (isInstalled) {
    return (
      <div 
        title="Running as installed app"
        className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F4EFE6] text-[#78716C] text-[11px] font-medium"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
        <span>App Ready</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow with active prompt
  if (isInstallable) {
    return (
      <button
        id="pwa-install-action-btn"
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1917] text-[#FAF8F5] text-xs font-medium hover:bg-[#38332F] transition-all shadow-xs active:scale-95"
        title="Install Lock In as an app on your device"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // Always provide install / Add to Home Screen access (for iOS Safari and manual guidance)
  return (
    <>
      <button
        id="pwa-install-guide-btn"
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E7DFD4] text-[#57534E] text-xs font-medium hover:bg-[#F4EFE6] hover:text-[#1C1917] transition-all active:scale-95"
        title="Install Lock In to Home Screen"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#8C827A]" />
        <span className="hidden sm:inline">{isIOS ? 'Add to Home' : 'Install App'}</span>
        <span className="sm:hidden">Install</span>
      </button>

      {showGuide && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setShowGuide(false)}
        >
          <div
            id="pwa-install-modal"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#FFFFFF] border border-[#E7DFD4] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/pwa-192x192.png"
                  alt="Lock In App Icon"
                  className="w-10 h-10 rounded-xl shadow-xs border border-[#EAE5DC]"
                />
                <div>
                  <h3 className="font-serif text-base font-semibold text-[#1C1917]">
                    Install Lock In
                  </h3>
                  <p className="text-[11px] text-[#8C827A]">
                    Full-screen offline focus app.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-[#A8A29E] hover:text-[#1C1917] p-1 rounded-lg hover:bg-[#FAF8F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] text-xs text-[#57534E]">
                <p className="leading-snug">
                  Tap <strong className="text-[#1C1917]">Share</strong> <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-[#2563EB]" /> in Safari, then tap <strong className="text-[#1C1917]">Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5" />.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] text-xs text-[#57534E]">
                <p className="leading-snug">
                  Open the browser menu <strong className="text-[#1C1917]">&#8942;</strong> and select <strong className="text-[#1C1917]">Install App</strong>.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-[#F0ECE4] flex items-center justify-between text-[11px] text-[#8C827A]">
              <span>Runs offline without an app store.</span>
              <button
                onClick={() => setShowGuide(false)}
                className="px-3 py-1 rounded-lg bg-[#FAF8F5] text-[#1C1917] hover:bg-[#EAE5DC] font-medium text-xs"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
