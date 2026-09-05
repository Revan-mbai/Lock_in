import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, CheckCircle2, Sparkles, Settings2 } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';
import { loadPomodoroState, savePomodoroState, MAX_LIVE_GAP_SECONDS } from '../../utils/timerPersistence';

interface PomodoroTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

export function PomodoroTimer({ onSessionComplete, soundEnabled }: PomodoroTimerProps) {
  // Load saved state once on mount. Calling this during every render re-parsed localStorage
  // on every tick, for every mounted timer.
  const [saved] = useState(loadPomodoroState);

  // Preset durations (in minutes)
  const [workDuration, setWorkDuration] = useState(() => saved?.workDuration ?? 25);
  const [shortBreakDuration, setShortBreakDuration] = useState(() => saved?.shortBreakDuration ?? 5);
  // No UI changes these two; they are read from saved state and otherwise fixed.
  const [longBreakDuration] = useState(() => saved?.longBreakDuration ?? 15);
  const [cyclesBeforeLongBreak] = useState(() => saved?.cyclesBeforeLongBreak ?? 4);

  const [phase, setPhase] = useState<'work' | 'shortBreak' | 'longBreak'>(() => saved?.phase ?? 'work');
  const [timeLeft, setTimeLeft] = useState(() => saved?.timeLeft ?? 25 * 60);
  const [isRunning, setIsRunning] = useState(() => saved?.isRunning ?? false);
  const [completedCycles, setCompletedCycles] = useState(() => saved?.completedCycles ?? 0);
  const [taskSubject, setTaskSubject] = useState(() => saved?.taskSubject ?? '');
  const [autoStartNext, setAutoStartNext] = useState(() => saved?.autoStartNext ?? true);
  const [showSettings, setShowSettings] = useState(false);
  const [transitionNotification, setTransitionNotification] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the phase transition so a single expiry can only fire it once. Starts false: the
  // loader only returns isRunning with timeLeft at 0 when the block really did run out while
  // the app was briefly away, and that session still deserves to be logged.
  const transitionFiredRef = useRef(false);

  // Show a transition banner, replacing any banner still counting down.
  const showTransitionNotification = (message: string) => {
    setTransitionNotification(message);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setTransitionNotification(null);
      notificationTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    savePomodoroState({
      workDuration,
      shortBreakDuration,
      longBreakDuration,
      cyclesBeforeLongBreak,
      phase,
      timeLeft,
      isRunning,
      completedCycles,
      taskSubject,
      autoStartNext,
    });
  }, [
    workDuration,
    shortBreakDuration,
    longBreakDuration,
    cyclesBeforeLongBreak,
    phase,
    timeLeft,
    isRunning,
    completedCycles,
    taskSubject,
    autoStartNext,
  ]);

  // Total duration of current phase in seconds
  const totalPhaseSeconds = phase === 'work' 
    ? workDuration * 60 
    : phase === 'shortBreak' 
      ? shortBreakDuration * 60 
      : longBreakDuration * 60;

  const progressPercent = Math.min(100, Math.max(0, ((totalPhaseSeconds - timeLeft) / totalPhaseSeconds) * 100));

  // Switch phase logic. `elapsedSeconds` is the time actually spent in the phase, so that
  // skipping early logs what was really studied instead of the full configured block.
  const handlePhaseTransition = (
    fromPhase: 'work' | 'shortBreak' | 'longBreak',
    elapsedSeconds: number
  ) => {
    if (fromPhase === 'work') {
      const focusedMinutes = Math.round(elapsedSeconds / 60);
      // Skipping a focus phase you never actually started logs nothing, so it must not tick a
      // cycle off either — the dots and the long-break schedule would drift from reality.
      const countsAsCycle = focusedMinutes >= 1;
      const newCycles = countsAsCycle ? completedCycles + 1 : completedCycles;

      if (countsAsCycle) {
        setCompletedCycles(newCycles);
        onSessionComplete({
          methodId: 'pomodoro',
          methodName: 'Pomodoro Technique',
          taskTitle: taskSubject.trim() || 'Deep Study Session',
          durationMinutes: focusedMinutes,
          phase: 'work',
        });
      }

      if (soundEnabled) playFocusCompleteChime();

      const nextIsLongBreak = countsAsCycle && newCycles % cyclesBeforeLongBreak === 0;
      const nextPhase = nextIsLongBreak ? 'longBreak' : 'shortBreak';
      const nextDuration = nextIsLongBreak ? longBreakDuration : shortBreakDuration;

      setPhase(nextPhase);
      setTimeLeft(nextDuration * 60);
      showTransitionNotification(
        nextIsLongBreak
          ? `${cyclesBeforeLongBreak} cycles done. ${longBreakDuration}m long break started.`
          : `Focus complete. ${shortBreakDuration}m break started.`
      );

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    } else {
      // Break complete -> back to work
      if (soundEnabled) playBreakCompleteChime();

      setPhase('work');
      setTimeLeft(workDuration * 60);
      showTransitionNotification(`Break over. ${workDuration}m focus started.`);

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    }
  };

  // Main countdown effect. The updater stays pure — scheduling the phase transition from
  // inside it made React run the transition twice under StrictMode, which logged every
  // completed session twice.
  useEffect(() => {
    if (!isRunning) return;

    lastTickRef.current = Date.now();

    const tick = () => {
      // Advance by whole seconds and carry the sub-second remainder. Rounding (and flooring
      // at 1) meant the extra visibilitychange tick could charge a full second for a few
      // milliseconds, so the countdown ran fast on every tab switch.
      const delta = Math.floor((Date.now() - lastTickRef.current) / 1000);
      if (delta <= 0) return;
      lastTickRef.current += delta * 1000;
      if (delta > MAX_LIVE_GAP_SECONDS) {
        // Far more time passed than any block can span, so the machine was asleep rather
        // than the tab merely backgrounded. Pause instead of banking a session.
        setIsRunning(false);
        return;
      }
      setTimeLeft((prev) => Math.max(0, prev - delta));
    };

    timerRef.current = setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning]);

  // Fire the phase transition once the countdown reaches zero. Running it here rather than
  // inside the tick means it always sees the current task name, sound setting and durations.
  useEffect(() => {
    if (timeLeft > 0) {
      transitionFiredRef.current = false;
      return;
    }
    if (!isRunning || transitionFiredRef.current) return;
    transitionFiredRef.current = true;
    handlePhaseTransition(phase, totalPhaseSeconds);
  }, [timeLeft, isRunning, phase, totalPhaseSeconds]);

  const handleStartPause = () => {
    // Pressing Play on an exhausted block starts the next one rather than re-completing the
    // spent one and logging a phantom full-length session.
    if (!isRunning && timeLeft <= 0) {
      setTimeLeft(totalPhaseSeconds);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    const duration = phase === 'work' 
      ? workDuration * 60 
      : phase === 'shortBreak' 
        ? shortBreakDuration * 60 
        : longBreakDuration * 60;
    setTimeLeft(duration);
  };

  const handleSkipPhase = () => {
    // Two clicks dispatched before React re-renders share this closure, so without a guard a
    // fast double-click credited the same block twice. transitionFiredRef is reset by the
    // zero-detection effect as soon as the next phase's countdown is in place.
    if (transitionFiredRef.current) return;
    transitionFiredRef.current = true;
    // Credit only the time actually spent, not the whole configured block.
    handlePhaseTransition(phase, totalPhaseSeconds - timeLeft);
  };

  const handleApplyPreset = (work: number, sBreak: number) => {
    setWorkDuration(work);
    setShortBreakDuration(sBreak);
    if (phase === 'work') {
      setTimeLeft(work * 60);
    } else if (phase === 'shortBreak') {
      setTimeLeft(sBreak * 60);
    }
    setIsRunning(false);
    setShowSettings(false);
  };

  return (
    <div id="pomodoro-timer-container" className="max-w-2xl mx-auto space-y-6">
      {/* Warm transition notification banner */}
      {transitionNotification && (
        <div 
          id="pomodoro-transition-alert"
          className="p-4 rounded-xl bg-[#EFECE6] border border-[#DDD7CD] text-[#2C2926] text-sm flex items-center justify-between shadow-xs transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#C86D51] shrink-0" />
            <span className="font-medium">{transitionNotification}</span>
          </div>
          <button 
            id="dismiss-pomodoro-alert"
            onClick={() => setTransitionNotification(null)}
            className="text-xs text-[#78716C] hover:text-[#292524] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Study Card */}
      <div className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        {/* Subtle Phase Indicator tabs */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            id="pomodoro-phase-work-tab"
            onClick={() => {
              if (phase !== 'work') {
                setPhase('work');
                setTimeLeft(workDuration * 60);
                setIsRunning(false);
              }
            }}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
              phase === 'work'
                ? 'bg-[#2B2724] text-[#FAF8F5]'
                : 'text-[#78716C] hover:text-[#292524] bg-[#F7F5F0]'
            }`}
          >
            Focus ({workDuration}m)
          </button>
          <button
            id="pomodoro-phase-short-tab"
            onClick={() => {
              if (phase !== 'shortBreak') {
                setPhase('shortBreak');
                setTimeLeft(shortBreakDuration * 60);
                setIsRunning(false);
              }
            }}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
              phase === 'shortBreak'
                ? 'bg-[#58705C] text-[#FAF8F5]'
                : 'text-[#78716C] hover:text-[#292524] bg-[#F7F5F0]'
            }`}
          >
            Break ({shortBreakDuration}m)
          </button>
          <button
            id="pomodoro-phase-long-tab"
            onClick={() => {
              if (phase !== 'longBreak') {
                setPhase('longBreak');
                setTimeLeft(longBreakDuration * 60);
                setIsRunning(false);
              }
            }}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
              phase === 'longBreak'
                ? 'bg-[#7C6F5A] text-[#FAF8F5]'
                : 'text-[#78716C] hover:text-[#292524] bg-[#F7F5F0]'
            }`}
          >
            Long Break ({longBreakDuration}m)
          </button>
        </div>

        {/* Task Focus Input */}
        <div className="max-w-md mx-auto mb-8">
          <label htmlFor="pomodoro-task-input" className="block text-center text-xs tracking-wider uppercase text-[#78716C] mb-2 font-medium">
            {phase === 'work' ? 'Task' : 'Break'}
          </label>
          {phase === 'work' ? (
            <input
              id="pomodoro-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g. Chapter 4 problem set..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-[#E7E3DC] bg-[#FAF8F5] text-sm text-[#292524] placeholder-[#A8A29E] focus:outline-none focus:border-[#C86D51] transition-colors"
            />
          ) : (
            <div className="text-center text-sm font-serif italic text-[#58705C]">
              Step away, stretch, and hydrate.
            </div>
          )}
        </div>

        {/* Circular Progress & Digits */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="#F0ECE4"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={phase === 'work' ? '#C86D51' : phase === 'shortBreak' ? '#58705C' : '#7C6F5A'}
                strokeWidth="4"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span 
                id="pomodoro-timer-digits"
                className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-[#1C1917]"
              >
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-2">
                {phase === 'work' ? 'Focus' : phase === 'shortBreak' ? 'Break' : 'Long Break'}
              </span>
              <span className="text-[11px] text-[#A8A29E] mt-1">
                {autoStartNext ? 'Auto-shifts into break' : 'Manual shift'}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            id="pomodoro-reset-btn"
            onClick={handleReset}
            title="Reset timer"
            className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="pomodoro-start-pause-btn"
            onClick={handleStartPause}
            className={`px-8 py-3.5 rounded-full font-medium text-sm flex items-center gap-2.5 transition-all shadow-xs ${
              isRunning
                ? 'bg-[#EFECE6] text-[#292524] hover:bg-[#E5E0D8]'
                : 'bg-[#1C1917] text-[#FAF8F5] hover:bg-[#2E2A27]'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>{timeLeft < totalPhaseSeconds ? 'Resume' : 'Start'}</span>
              </>
            )}
          </button>

          <button
            id="pomodoro-skip-btn"
            onClick={handleSkipPhase}
            title="Skip to next phase"
            className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Cycle dots & Auto-transition toggle */}
        <div className="mt-10 pt-6 border-t border-[#F0ECE4] flex flex-wrap items-center justify-between gap-4 text-xs text-[#78716C]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#44403C]">Cycle {completedCycles % cyclesBeforeLongBreak + 1} of {cyclesBeforeLongBreak}:</span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: cyclesBeforeLongBreak }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i < (completedCycles % cyclesBeforeLongBreak)
                      ? 'bg-[#C86D51]'
                      : 'bg-[#E7E3DC]'
                  }`}
                />
              ))}
            </div>
            <span className="text-[#A8A29E] ml-1">({completedCycles} done)</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="pomodoro-auto-shift-toggle"
                type="checkbox"
                checked={autoStartNext}
                onChange={(e) => setAutoStartNext(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#C86D51]"
              />
              <span>Auto-shift</span>
            </label>

            <button
              id="pomodoro-settings-toggle"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1 hover:text-[#292524] transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Presets</span>
            </button>
          </div>
        </div>

        {/* Interval Settings Collapsible */}
        {showSettings && (
          <div id="pomodoro-settings-panel" className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] text-xs space-y-3">
            <p className="font-medium text-[#292524]">Select preset:</p>
            <div className="flex flex-wrap gap-2">
              <button
                id="preset-25-5-btn"
                onClick={() => handleApplyPreset(25, 5)}
                className={`px-3 py-1.5 rounded-lg border ${
                  workDuration === 25 ? 'border-[#C86D51] bg-[#FAF3F0] text-[#C86D51] font-semibold' : 'border-[#E7E3DC] bg-white'
                }`}
              >
                25m / 5m
              </button>
              <button
                id="preset-50-10-btn"
                onClick={() => handleApplyPreset(50, 10)}
                className={`px-3 py-1.5 rounded-lg border ${
                  workDuration === 50 ? 'border-[#C86D51] bg-[#FAF3F0] text-[#C86D51] font-semibold' : 'border-[#E7E3DC] bg-white'
                }`}
              >
                50m / 10m
              </button>
              <button
                id="preset-15-3-btn"
                onClick={() => handleApplyPreset(15, 3)}
                className={`px-3 py-1.5 rounded-lg border ${
                  workDuration === 15 ? 'border-[#C86D51] bg-[#FAF3F0] text-[#C86D51] font-semibold' : 'border-[#E7E3DC] bg-white'
                }`}
              >
                15m / 3m
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Break suggestion card */}
      <div className="bg-[#FAF8F5] border border-[#E7E3DC] rounded-xl p-4 text-xs text-[#57534E] flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-[#EFECE6] text-[#C86D51] shrink-0 mt-0.5">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-[#1C1917]">Tip: </span>
          When the timer rings, look 20 feet away to relax your eyes, stretch, and hydrate.
        </div>
      </div>
    </div>
  );
}
