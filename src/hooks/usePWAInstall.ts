import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed or launched from home screen)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);

    // Detect iOS devices. iPadOS 13+ reports a desktop Safari user agent, so a plain
    // /ipad/ test misses every modern iPad; those are identified by a Mac UA that also
    // reports touch points.
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIPadOS =
      /macintosh/.test(userAgent) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
    setIsIOS(/iphone|ipad|ipod/.test(userAgent) || isIPadOS);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    // A beforeinstallprompt event can only be prompted once — reusing it throws
    // InvalidStateError. Clear it whatever the user chooses, so a dismissed prompt hides
    // the button (the browser fires a fresh event when it is willing to ask again) instead
    // of leaving a button that throws on the next click.
    const prompt = deferredPrompt;
    setDeferredPrompt(null);

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }
    } catch {
      // The prompt was already consumed or was rejected by the browser.
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}
