import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Sparkles, Activity, Moon, Sun } from 'lucide-react';
import { formatTimeWithHours } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';
import { loadNinetyMinState, saveNinetyMinState, MAX_LIVE_GAP_SECONDS } from '../../utils/timerPersistence';

interface NinetyMinTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

export function NinetyMinTimer({ onSessionComplete, soundEnabled }: NinetyMinTimerProps) {
  const WORK_SECONDS = 90 * 60; // 90 mins = 5400s
  const BREAK_SECONDS = 20 * 60; // 20 mins = 1200s

  // Load saved state once on mount rather than re-parsing localStorage on every render.
  const [saved] = useState(loadNinetyMinState);

  const [phase, setPhase] = useState<'work' | 'break'>(() => saved?.phase ?? 'work');
  const [timeLeft, setTimeLeft] = useState(() => saved?.timeLeft ?? WORK_SECONDS);
  const [isRunning, setIsRunning] = useState(() => saved?.isRunning ?? false);
  const [taskSubject, setTaskSubject] = useState(() => saved?.taskSubject ?? '');
  const [autoStartNext, setAutoStartNext] = useState(() => saved?.autoStartNext ?? true);
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
    saveNinetyMinState({
      phase,
      timeLeft,
      isRunning,
      taskSubject,
      autoStartNext,
    });
  }, [phase, timeLeft, isRunning, taskSubject, autoStartNext]);

  const totalPhaseSeconds = phase === 'work' ? WORK_SECONDS : BREAK_SECONDS;
  const progressPercent = Math.min(100, Math.max(0, ((totalPhaseSeconds - timeLeft) / totalPhaseSeconds) * 100));

  // Determine current ultradian stage during 90m work
  const elapsedWorkMinutes = (WORK_SECONDS - timeLeft) / 60;
  let ultradianStage = 'Warm-up (0–15m)';
  if (phase === 'work') {
    if (elapsedWorkMinutes >= 75) {
      ultradianStage = 'Winding Down (75–90m)';
    } else if (elapsedWorkMinutes >= 15) {
      ultradianStage = 'Peak Velocity (15–75m)';
    }
  } else {
    ultradianStage = 'Rest & Recovery';
  }

  // `elapsedSeconds` is the time actually spent in the phase, so skipping early logs what
  // was really studied instead of crediting a full 90-minute block.
  const handlePhaseTransition = (fromPhase: 'work' | 'break', elapsedSeconds: number) => {
    if (fromPhase === 'work') {
      const focusedMinutes = Math.round(elapsedSeconds / 60);
      if (focusedMinutes >= 1) {
        onSessionComplete({
          methodId: 'ninety-min',
          methodName: '90-Minute Work Cycle',
          taskTitle: taskSubject.trim() || '90-Min Ultradian Block',
          durationMinutes: focusedMinutes,
          phase: 'work',
        });
      }

      if (soundEnabled) playFocusCompleteChime();

      setPhase('break');
      setTimeLeft(BREAK_SECONDS);
      showTransitionNotification('90m cycle done. Starting 20m break.');

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    } else {
      if (soundEnabled) playBreakCompleteChime();

      setPhase('work');
      setTimeLeft(WORK_SECONDS);
      showTransitionNotification('Break complete. Ready for 90m focus.');

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    }
  };

  // The updater stays pure — scheduling the phase transition from inside it made React run
  // the transition twice under StrictMode, which logged every completed cycle twice.
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
  // inside the tick means it always sees the current task name and sound setting.
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
    setTimeLeft(phase === 'work' ? WORK_SECONDS : BREAK_SECONDS);
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

  return (
    <div id="ninety-min-timer-container" className="max-w-2xl mx-auto space-y-6">
      {transitionNotification && (
        <div 
          id="ninety-min-transition-alert"
          className="p-4 rounded-xl bg-surface-muted border border-line-strong text-ink-body text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-accent-deep shrink-0" />
            <span className="font-medium">{transitionNotification}</span>
          </div>
          <button 
            id="dismiss-ninety-min-alert"
            onClick={() => setTransitionNotification(null)}
            className="text-xs text-ink-muted hover:text-ink-body underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-surface border border-line rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        {/* Phase selector tabs */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            id="ninety-min-work-tab"
            onClick={() => {
              if (phase !== 'work') {
                setPhase('work');
                setTimeLeft(WORK_SECONDS);
                setIsRunning(false);
              }
            }}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
              phase === 'work'
                ? 'bg-ink text-canvas'
                : 'text-ink-muted hover:text-ink-body bg-surface-subtle'
            }`}
          >
            Focus (90m)
          </button>
          <button
            id="ninety-min-break-tab"
            onClick={() => {
              if (phase !== 'break') {
                setPhase('break');
                setTimeLeft(BREAK_SECONDS);
                setIsRunning(false);
              }
            }}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
              phase === 'break'
                ? 'bg-accent-deep text-canvas'
                : 'text-ink-muted hover:text-ink-body bg-surface-subtle'
            }`}
          >
            Break (20m)
          </button>
        </div>

        {/* Task Focus Input */}
        <div className="max-w-md mx-auto mb-8">
          <label htmlFor="ninety-task-input" className="block text-center text-xs tracking-wider uppercase text-ink-muted mb-2 font-medium">
            {phase === 'work' ? 'Task' : 'Break'}
          </label>
          {phase === 'work' ? (
            <input
              id="ninety-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g. Drafting chapter 2..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-line bg-canvas text-sm text-ink-body placeholder-ink-faint focus:outline-none focus:border-accent-deep transition-colors"
            />
          ) : (
            <p className="text-center text-sm font-serif italic text-accent-deep">
              Walk, stretch, or hydrate without screens.
            </p>
          )}
        </div>

        {/* Countdown Ring */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="var(--color-track)" strokeWidth="4" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={phase === 'work' ? 'var(--color-accent-deep)' : 'var(--color-accent-break)'}
                strokeWidth="4"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span id="ninety-min-digits" className="font-mono text-4xl sm:text-5xl font-semibold tracking-tight text-ink">
                {formatTimeWithHours(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-ink-muted mt-2">
                {phase === 'work' ? 'Focus' : 'Break'}
              </span>
              <span className="text-[11px] text-ink-faint mt-1">
                {autoStartNext ? 'Auto-shifts into break' : 'Manual shift'}
              </span>
            </div>
          </div>
        </div>

        {/* Ultradian Stage Tracker */}
        {phase === 'work' && (
          <div className="max-w-md mx-auto my-4 p-3 rounded-xl bg-canvas border border-line text-xs">
            <div className="flex items-center justify-between text-ink-muted mb-1.5">
              <span className="flex items-center gap-1.5 font-medium text-ink-body">
                <Activity className="w-3.5 h-3.5 text-accent-deep" />
                Phase:
              </span>
              <span className="font-mono">{Math.floor(elapsedWorkMinutes)} / 90m</span>
            </div>
            <div className="font-medium text-accent-deep">{ultradianStage}</div>
            {/* 3-segment progress meter */}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <div className={`h-1.5 rounded-full ${elapsedWorkMinutes > 0 ? 'bg-accent-deep' : 'bg-line'}`} />
              <div className={`h-1.5 rounded-full ${elapsedWorkMinutes >= 15 ? 'bg-accent-deep' : 'bg-line'}`} />
              <div className={`h-1.5 rounded-full ${elapsedWorkMinutes >= 75 ? 'bg-accent-deep' : 'bg-line'}`} />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            id="ninety-min-reset-btn"
            onClick={handleReset}
            title="Reset timer"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="ninety-min-start-pause-btn"
            onClick={handleStartPause}
            className={`px-8 py-3.5 rounded-full font-medium text-sm flex items-center gap-2.5 transition-all shadow-xs ${
              isRunning
                ? 'bg-surface-muted text-ink-body hover:bg-surface-active'
                : 'bg-ink text-canvas hover:bg-ink-hover'
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
            id="ninety-min-skip-btn"
            onClick={handleSkipPhase}
            title="Skip to next phase"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Footer controls */}
        <div className="mt-10 pt-6 border-t border-track flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            {phase === 'work' ? <Sun className="w-4 h-4 text-accent-deep" /> : <Moon className="w-4 h-4 text-accent-break" />}
            <span>{phase === 'work' ? '90m Focus' : '20m Rest'}</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="ninety-min-auto-shift-toggle"
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-accent-deep"
            />
            <span>Auto-shift</span>
          </label>
        </div>
      </div>

      {/* Science card */}
      <div className="bg-canvas border border-line rounded-xl p-4 text-xs text-ink-secondary flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-surface-muted text-accent-deep shrink-0 mt-0.5">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-ink">Tip: </span>
          Alertness peaks in 90-minute waves. Stopping at 90 minutes prevents fatigue and cognitive burnout.
        </div>
      </div>
    </div>
  );
}
