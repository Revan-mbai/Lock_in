import { useState, useEffect } from 'react';
import { ActiveTab, StudyMethodId } from '../types';
import { AmbientSoundPlayer } from './AmbientSoundPlayer';
import { PWAInstallButton } from './PWAInstallButton';
import { Bell, BellOff, Maximize2, Minimize2, BarChart2, Sun, Moon } from 'lucide-react';
import { getTimerSummaries } from '../utils/timerPersistence';
import { formatTime } from '../utils/formatters';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isAmbientPlaying: boolean;
  onToggleAmbient: () => void;
  isZenMode: boolean;
  onToggleZenMode: () => void;
  onOpenStats: () => void;
  todayFocusMinutes: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  soundEnabled,
  onToggleSound,
  isAmbientPlaying,
  onToggleAmbient,
  isZenMode,
  onToggleZenMode,
  onOpenStats,
  todayFocusMinutes,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const [timerSummaries, setTimerSummaries] = useState(getTimerSummaries);

  useEffect(() => {
    const update = () => setTimerSummaries(getTimerSummaries());
    window.addEventListener('study_timers_changed', update);
    window.addEventListener('storage', update);
    const interval = setInterval(update, 1000);
    return () => {
      window.removeEventListener('study_timers_changed', update);
      window.removeEventListener('storage', update);
      clearInterval(interval);
    };
  }, []);

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'All' },
    { id: 'pomodoro', label: 'Pomodoro' },
    { id: 'flowtime', label: 'Flowtime' },
    { id: 'ninety-min', label: '90-Min' },
    { id: 'time-boxing', label: 'Time Boxing' },
    { id: 'fifty-two-seventeen', label: '52/17' },
  ];

  if (isZenMode) {
    return (
      <header className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <button
          id="zen-theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2.5 rounded-full bg-surface/80 hover:bg-surface text-ink-secondary hover:text-ink border border-line shadow-xs backdrop-blur-xs transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          id="exit-zen-mode-btn"
          onClick={onToggleZenMode}
          title="Exit Zen Mode"
          className="p-2.5 rounded-full bg-surface/80 hover:bg-surface text-ink-secondary hover:text-ink border border-line shadow-xs backdrop-blur-xs transition-colors"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-md border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Name */}
          <button
            id="brand-home-link"
            onClick={() => onTabChange('overview')}
            className="flex items-center text-left group transition-transform"
          >
            <div>
              <div className="font-serif text-lg font-semibold tracking-tight text-ink leading-none group-hover:text-ink-secondary transition-colors">
                Lock In
              </div>
              <div className="text-[10px] text-ink-muted tracking-wider uppercase mt-0.5">
                Focus Timers
              </div>
            </div>
          </button>

          {/* Center Tabs Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-track/70 p-1 rounded-xl border border-line">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const isTimerRunning = tab.id !== 'overview' && timerSummaries[tab.id as StudyMethodId]?.isRunning;
              const remainingSec = (tab.id !== 'overview' ? timerSummaries[tab.id as StudyMethodId]?.remainingSeconds : 0) ?? 0;

              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-surface text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-canvas/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isTimerRunning && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-live-bg text-live-ink font-semibold border border-live-line">
                      <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
                      {formatTime(remainingSec)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Toolbar Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Install App Button / Add to Home Screen */}
            <PWAInstallButton />

            {/* Ambient Noise Player */}
            <AmbientSoundPlayer
              isPlaying={isAmbientPlaying}
              onTogglePlay={onToggleAmbient}
            />

            {/* Chime audio toggle */}
            <button
              id="header-sound-chime-toggle"
              onClick={onToggleSound}
              title={soundEnabled ? 'Sound on' : 'Muted'}
              className={`p-2 rounded-xl text-xs font-medium transition-colors ${
                soundEnabled
                  ? 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                  : 'text-ink-faint hover:text-ink-secondary'
              }`}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>

            {/* Today's Focus Stats */}
            <button
              id="open-stats-modal-btn"
              onClick={onOpenStats}
              title="Today's stats"
              className="p-2 rounded-xl text-ink-secondary hover:text-ink hover:bg-surface-hover flex items-center gap-1.5 transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              {todayFocusMinutes > 0 && (
                <span className="hidden sm:inline font-mono text-xs font-medium text-ink">
                  {todayFocusMinutes}m
                </span>
              )}
            </button>

            {/* Light / dark theme */}
            <button
              id="theme-toggle-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              className="p-2 rounded-xl text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Zen Mode Toggle */}
            <button
              id="enter-zen-mode-btn"
              onClick={onToggleZenMode}
              title="Zen Mode"
              className="p-2 rounded-xl text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Scrollbar */}
        <div className="md:hidden flex items-center gap-1 overflow-x-auto pb-2.5 pt-1 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isTimerRunning = tab.id !== 'overview' && timerSummaries[tab.id as StudyMethodId]?.isRunning;
            const remainingSec = (tab.id !== 'overview' ? timerSummaries[tab.id as StudyMethodId]?.remainingSeconds : 0) ?? 0;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-ink text-canvas'
                    : 'bg-surface-hover text-ink-muted'
                }`}
              >
                <span>{tab.label}</span>
                {isTimerRunning && (
                  <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-mono font-semibold bg-live-bg text-live-ink border border-live-line">
                    <span className="w-1 h-1 rounded-full bg-live animate-pulse" />
                    {formatTime(remainingSec)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
