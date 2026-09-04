import { ActiveTab } from '../types';
import { AmbientSoundPlayer } from './AmbientSoundPlayer';
import { Bell, BellOff, Maximize2, Minimize2, BarChart2, BookOpen, Layers } from 'lucide-react';

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
}: HeaderProps) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'overview', label: 'All Methods' },
    { id: 'pomodoro', label: 'Pomodoro' },
    { id: 'flowtime', label: 'Flowtime' },
    { id: 'ninety-min', label: '90-Min Cycle' },
    { id: 'time-boxing', label: 'Time Boxing' },
    { id: 'fifty-two-seventeen', label: '52/17 Rule' },
  ];

  if (isZenMode) {
    return (
      <header className="fixed top-4 right-4 z-40">
        <button
          id="exit-zen-mode-btn"
          onClick={onToggleZenMode}
          title="Exit Zen / Distraction-Free Mode"
          className="p-2.5 rounded-full bg-white/80 hover:bg-white text-[#57534E] hover:text-[#1C1917] border border-[#E7E3DC] shadow-xs backdrop-blur-xs transition-colors"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#EAE5DC]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Name */}
          <button
            id="brand-home-link"
            onClick={() => onTabChange('overview')}
            className="flex items-center text-left group transition-transform"
          >
            <div>
              <div className="font-serif text-lg font-semibold tracking-tight text-[#1C1917] leading-none group-hover:text-[#44403C] transition-colors">
                Lock In
              </div>
              <div className="text-[10px] text-[#8C827A] tracking-wider uppercase mt-0.5">
                Focus & Break Suite
              </div>
            </div>
          </button>

          {/* Center Tabs Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-[#F0ECE4]/70 p-1 rounded-xl border border-[#E5E0D6]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                      : 'text-[#6B655F] hover:text-[#1C1917] hover:bg-[#FAF8F5]/50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Toolbar Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Ambient Noise Player */}
            <AmbientSoundPlayer
              isPlaying={isAmbientPlaying}
              onTogglePlay={onToggleAmbient}
            />

            {/* Chime audio toggle */}
            <button
              id="header-sound-chime-toggle"
              onClick={onToggleSound}
              title={soundEnabled ? 'Chime sound active' : 'Chime sound muted'}
              className={`p-2 rounded-xl text-xs font-medium transition-colors ${
                soundEnabled
                  ? 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F2EFE9]'
                  : 'text-[#A8A29E] hover:text-[#57534E]'
              }`}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>

            {/* Today's Focus Stats */}
            <button
              id="open-stats-modal-btn"
              onClick={onOpenStats}
              title="View today's study stats"
              className="p-2 rounded-xl text-[#57534E] hover:text-[#1C1917] hover:bg-[#F2EFE9] flex items-center gap-1.5 transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              {todayFocusMinutes > 0 && (
                <span className="hidden sm:inline font-mono text-xs font-medium text-[#1C1917]">
                  {todayFocusMinutes}m
                </span>
              )}
            </button>

            {/* Zen Mode Toggle */}
            <button
              id="enter-zen-mode-btn"
              onClick={onToggleZenMode}
              title="Distraction-Free Zen Mode"
              className="p-2 rounded-xl text-[#57534E] hover:text-[#1C1917] hover:bg-[#F2EFE9] transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Scrollbar */}
        <div className="md:hidden flex items-center gap-1 overflow-x-auto pb-2.5 pt-1 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#1C1917] text-[#FAF8F5]'
                    : 'bg-[#F2EFE9] text-[#6B655F]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
