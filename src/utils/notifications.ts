/**
 * System notifications for phase transitions.
 *
 * A chime is the only signal this app had, which fails at exactly the moment the app matters
 * most: the tab is in the background and the volume is down. Notifications reach the user there.
 *
 * Permission is never requested on load — an unprompted permission dialog is hostile and
 * browsers increasingly ignore it. The user opts in from the header, which is a real user
 * gesture, and the preference is stored alongside the other toggles.
 */

const STORAGE_KEY = 'study_methods_notifications_v1';

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationSupport(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as 'default' | 'granted' | 'denied';
}

/** Whether the user has asked for notifications AND the browser still permits them. */
export function notificationsEnabled(): boolean {
  if (notificationSupport() !== 'granted') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setNotificationsEnabled(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Ignore quota; the choice still applies for this session.
  }
}

/**
 * Ask for permission. Must be called from a user gesture. Returns whether notifications are
 * usable afterwards.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (notificationSupport() === 'unsupported') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    // Safari once exposed only the callback form; treat a rejection as a decline.
    return false;
  }
}

/**
 * Show a transition notification, if the user opted in.
 *
 * `tag` collapses repeats so a timer left running for hours cannot stack up a wall of
 * notifications — each new one replaces the previous for that timer.
 */
export function notifyTransition(title: string, body: string, tag = 'lock-in-timer'): void {
  if (!notificationsEnabled()) return;
  // A visible tab already shows the in-app banner; a system notification on top is just noise.
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
  try {
    new Notification(title, {
      body,
      tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      silent: false,
    });
  } catch {
    // Some browsers throw when constructing notifications outside a service worker; the
    // in-app banner and chime still fire, so there is nothing to recover here.
  }
}
