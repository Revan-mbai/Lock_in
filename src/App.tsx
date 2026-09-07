import { useState, useEffect, useRef } from 'react';
import { ActiveTab, StudyMethodId, FocusSessionLog } from './types';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { MethodDetailView } from './components/MethodDetailView';
import { StudyStatsModal } from './components/StudyStatsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { loadActiveTab, saveActiveTab } from './utils/timerPersistence';
import {
  notificationSupport,
  notificationsEnabled,
  setNotificationsEnabled,
  requestNotificationPermission,
} from './utils/notifications';

const STORAGE_KEY_LOGS = 'study_methods_focus_logs_v1';

// Session history is capped so a long-running install cannot grow the entry until it trips
// the localStorage quota and silently stops saving.
const MAX_SESSION_LOGS = 500;

const STORAGE_KEY_SOUND = 'study_methods_sound_enabled_v1';
const STORAGE_KEY_ZEN = 'study_methods_zen_mode_v1';
// Shared with the pre-paint script in index.html, which reads this key before React loads.
const STORAGE_KEY_THEME = 'study_methods_theme_v1';

type Theme = 'light' | 'dark';

/**
 * The theme index.html already resolved and stamped on <html>, so React starts in agreement
 * with what is on screen instead of briefly disagreeing and repainting.
 */
function readAppliedTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function loadBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

function readStoredLogs(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_LOGS);
  } catch {
    return null;
  }
}

function parseStoredLogs(raw: string | null): FocusSessionLog[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SESSION_LOGS) : [];
  } catch {
    return [];
  }
}

function saveBooleanPreference(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore quota
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = loadActiveTab();
    if (saved && ['overview', 'pomodoro', 'flowtime', 'ninety-min', 'time-boxing', 'fifty-two-seventeen', 'retrieval-practice', 'interleaving', 'feynman'].includes(saved)) {
      return saved as ActiveTab;
    }
    return 'overview';
  });
  // Persisted alongside activeTab — a muted user had to re-mute on every reload.
  const [soundEnabled, setSoundEnabled] = useState(() => loadBooleanPreference(STORAGE_KEY_SOUND, true));
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [isZenMode, setIsZenMode] = useState(() => loadBooleanPreference(STORAGE_KEY_ZEN, false));
  const [theme, setTheme] = useState<Theme>(readAppliedTheme);
  // Read once: the browser's permission state cannot change without a user action, and each
  // action below updates this itself.
  const [notificationsOn, setNotificationsOn] = useState(notificationsEnabled);
  const [notificationSupportState, setNotificationSupportState] = useState(notificationSupport);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  // Read during render, not from an effect. Child effects run before the parent's, so a
  // timer that completed on this very mount recorded its session *before* a load effect
  // here could run — and that effect then overwrote it with the stored value.
  const [initialLogsRaw] = useState(readStoredLogs);
  const [sessionLogs, setSessionLogs] = useState<FocusSessionLog[]>(() => parseStoredLogs(initialLogsRaw));
  // The exact payload this tab last read or wrote, so a cross-tab sync does not bounce back
  // out as a fresh write and start a write/notify loop between tabs.
  const lastPersistedLogsRef = useRef<string | null>(initialLogsRaw);

  // Persist outside the updater — a state updater must stay pure, and StrictMode invokes it
  // twice.
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveBooleanPreference(STORAGE_KEY_SOUND, next);
  };

  const handleToggleZenMode = () => {
    const next = !isZenMode;
    setIsZenMode(next);
    saveBooleanPreference(STORAGE_KEY_ZEN, next);
  };

  const handleToggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, next);
    } catch {
      // Ignore quota; the theme still applies for this session.
    }
  };

  // Drive the attribute the stylesheet keys off, and keep the PWA's browser chrome in step.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        'content',
        getComputedStyle(document.documentElement).getPropertyValue('--color-canvas').trim()
      );
    }
  }, [theme]);

  // Follow the OS while the user has never chosen for themselves. Once they use the toggle a
  // value is stored, and their choice keeps winning.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(STORAGE_KEY_THEME) !== null) return;
      } catch {
        return;
      }
      setTheme(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // Permission has to be asked for from a real user gesture, which this click is.
  const handleToggleNotifications = async () => {
    if (notificationsOn) {
      setNotificationsOn(false);
      setNotificationsEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    setNotificationSupportState(notificationSupport());
    setNotificationsOn(granted);
    setNotificationsEnabled(granted);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    saveActiveTab(tab);
  };

  const handleSessionComplete = (logData: Omit<FocusSessionLog, 'id' | 'completedAt'>) => {
    const newEntry: FocusSessionLog = {
      ...logData,
      // Date-prefixed so two sessions finishing in the same millisecond cannot collide and
      // produce duplicate React keys.
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      completedAt: new Date().toISOString(),
    };

    // The updater stays pure: persisting from inside it wrote to localStorage twice per
    // session under StrictMode.
    setSessionLogs((prev) => [newEntry, ...prev].slice(0, MAX_SESSION_LOGS));
  };

  // Persist history whenever it changes, including clears.
  useEffect(() => {
    const serialized = JSON.stringify(sessionLogs);
    if (serialized === lastPersistedLogsRef.current) return;
    lastPersistedLogsRef.current = serialized;
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, serialized);
    } catch {
      // Ignore quota
    }
  }, [sessionLogs]);

  // History was read once on mount and then blind-overwritten, so a second tab silently
  // destroyed whatever the first tab had recorded. Adopt other tabs' writes instead.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY_LOGS) return;
      const raw = event.newValue;
      if (raw === lastPersistedLogsRef.current) return;
      lastPersistedLogsRef.current = raw;
      setSessionLogs(parseStoredLogs(raw));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const todayStr = new Date().toDateString();

  /**
   * Delete exactly the entries named. The modal decides which — the entries it is currently
   * showing, or a single one — so the button can never destroy history the user cannot see,
   * which is what the old blanket "clear" did.
   */
  const handleDeleteEntries = (ids: string[]) => {
    if (!ids.length) return;
    const doomed = new Set(ids);
    setSessionLogs((prev) => prev.filter((log) => !doomed.has(log.id)));
  };
  const todayFocusMinutes = sessionLogs
    .filter((log) => log.phase === 'work' && new Date(log.completedAt).toDateString() === todayStr)
    .reduce((sum, log) => sum + log.durationMinutes, 0);

  const handleSelectMethod = (id: StudyMethodId) => {
    handleTabChange(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300 bg-canvas">
      {/* Header with Navigation & Quick Utilities */}
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        isAmbientPlaying={isAmbientPlaying}
        onToggleAmbient={() => setIsAmbientPlaying(!isAmbientPlaying)}
        isZenMode={isZenMode}
        onToggleZenMode={handleToggleZenMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        notificationsOn={notificationsOn}
        notificationsAvailable={
          notificationSupportState !== 'unsupported' && notificationSupportState !== 'denied'
        }
        onToggleNotifications={handleToggleNotifications}
        onOpenStats={() => setIsStatsOpen(true)}
        todayFocusMinutes={todayFocusMinutes}
      />

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 pt-6 sm:pt-10">
        <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
          <HomePage onSelectMethod={handleSelectMethod} />
        </div>
        {(['pomodoro', 'flowtime', 'ninety-min', 'time-boxing', 'fifty-two-seventeen', 'retrieval-practice', 'interleaving', 'feynman'] as StudyMethodId[]).map((id) => (
          <div key={id} className={activeTab === id ? 'block' : 'hidden'}>
            <MethodDetailView
              methodId={id}
              onBackToOverview={() => handleTabChange('overview')}
              onSelectMethod={handleSelectMethod}
              onSessionComplete={handleSessionComplete}
              soundEnabled={soundEnabled}
              isZenMode={isZenMode}
            />
          </div>
        ))}
      </main>

      {/* Minimal Warm Footer (hidden in Zen mode) */}
      {!isZenMode && (
        <footer className="border-t border-line py-6 text-center text-xs text-ink-muted bg-canvas">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span>Designed for deep work & mental clarity &bull; Minimalist study methods</span>
            </div>
            <div className="flex items-center gap-4 text-ink-muted">
              <button
                onClick={() => handleTabChange('overview')}
                className="hover:text-ink transition-colors"
              >
                All Methods
              </button>
              <span>&bull;</span>
              <button
                onClick={() => setIsStatsOpen(true)}
                className="hover:text-ink transition-colors"
              >
                Study Stats ({todayFocusMinutes}m)
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Study Stats / History Modal */}
      <StudyStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        logs={sessionLogs}
        onDeleteEntries={handleDeleteEntries}
      />

      {/* PWA Offline Mode Indicator */}
      <OfflineIndicator />
    </div>
  );
}
