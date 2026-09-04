import { useState, useEffect } from 'react';
import { ActiveTab, StudyMethodId, FocusSessionLog } from './types';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { MethodDetailView } from './components/MethodDetailView';
import { StudyStatsModal } from './components/StudyStatsModal';
import { OfflineIndicator } from './components/OfflineIndicator';

const STORAGE_KEY_LOGS = 'study_methods_focus_logs_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<FocusSessionLog[]>([]);

  // Load saved session history on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSessionLogs(parsed);
        }
      }
    } catch {
      // Ignore parse failure
    }
  }, []);

  const handleSessionComplete = (logData: Omit<FocusSessionLog, 'id' | 'completedAt'>) => {
    const newEntry: FocusSessionLog = {
      ...logData,
      id: Math.random().toString(36).substring(2, 9),
      completedAt: new Date().toISOString(),
    };

    setSessionLogs((prev) => {
      const updated = [newEntry, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
      } catch {
        // Ignore quota
      }
      return updated;
    });
  };

  const handleClearLogs = () => {
    setSessionLogs([]);
    try {
      localStorage.removeItem(STORAGE_KEY_LOGS);
    } catch {
      // Ignore
    }
  };

  const todayStr = new Date().toDateString();
  const todayFocusMinutes = sessionLogs
    .filter((log) => log.phase === 'work' && new Date(log.completedAt).toDateString() === todayStr)
    .reduce((sum, log) => sum + log.durationMinutes, 0);

  const handleSelectMethod = (id: StudyMethodId) => {
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${isZenMode ? 'bg-[#FAF8F5]' : 'bg-[#FAF8F5]'}`}>
      {/* Header with Navigation & Quick Utilities */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        isAmbientPlaying={isAmbientPlaying}
        onToggleAmbient={() => setIsAmbientPlaying(!isAmbientPlaying)}
        isZenMode={isZenMode}
        onToggleZenMode={() => setIsZenMode(!isZenMode)}
        onOpenStats={() => setIsStatsOpen(true)}
        todayFocusMinutes={todayFocusMinutes}
      />

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 pt-6 sm:pt-10">
        {activeTab === 'overview' ? (
          <HomePage onSelectMethod={handleSelectMethod} />
        ) : (
          <MethodDetailView
            methodId={activeTab}
            onBackToOverview={() => setActiveTab('overview')}
            onSelectMethod={handleSelectMethod}
            onSessionComplete={handleSessionComplete}
            soundEnabled={soundEnabled}
            isZenMode={isZenMode}
          />
        )}
      </main>

      {/* Minimal Warm Footer (hidden in Zen mode) */}
      {!isZenMode && (
        <footer className="border-t border-[#EAE5DC] py-6 text-center text-xs text-[#8C827A] bg-[#FAF8F5]">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span>Designed for deep work & mental clarity &bull; Minimalist study methods</span>
            </div>
            <div className="flex items-center gap-4 text-[#78716C]">
              <button
                onClick={() => setActiveTab('overview')}
                className="hover:text-[#1C1917] transition-colors"
              >
                All Methods
              </button>
              <span>&bull;</span>
              <button
                onClick={() => setIsStatsOpen(true)}
                className="hover:text-[#1C1917] transition-colors"
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
        onClearLogs={handleClearLogs}
      />

      {/* PWA Offline Mode Indicator */}
      <OfflineIndicator />
    </div>
  );
}
