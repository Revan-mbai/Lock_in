import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Sparkles, Compass, ShieldCheck, Footprints } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';
import { loadFiftyTwoSeventeenState, saveFiftyTwoSeventeenState } from '../../utils/timerPersistence';
import { useTransitionBanner } from '../../hooks/useTransitionBanner';
import { useCountdown } from '../../hooks/useCountdown';

interface FiftyTwoSeventeenTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

export function FiftyTwoSeventeenTimer({ onSessionComplete, soundEnabled }: FiftyTwoSeventeenTimerProps) {
  const WORK_SECONDS = 52 * 60; // 3120s
  const BREAK_SECONDS = 17 * 60; // 1020s

  // Load saved state once on mount rather than re-parsing localStorage on every render.
  const [saved] = useState(loadFiftyTwoSeventeenState);

  const [phase, setPhase] = useState<'work' | 'break'>(() => saved?.phase ?? 'work');
  const [timeLeft, setTimeLeft] = useState(() => saved?.timeLeft ?? WORK_SECONDS);
  const [isRunning, setIsRunning] = useState(() => saved?.isRunning ?? false);
  const [taskSubject, setTaskSubject] = useState(() => saved?.taskSubject ?? '');
  const [autoStartNext, setAutoStartNext] = useState(() => saved?.autoStartNext ?? true);

  const { message: bannerMessage, show: showBanner, dismiss: dismissBanner } =
    useTransitionBanner('The 52/17 Rule');


  // Save changes to localStorage
  useEffect(() => {
    saveFiftyTwoSeventeenState({
      phase,
      timeLeft,
      isRunning,
      taskSubject,
      autoStartNext,
    });
  }, [phase, timeLeft, isRunning, taskSubject, autoStartNext]);

  const totalPhaseSeconds = phase === 'work' ? WORK_SECONDS : BREAK_SECONDS;
  const progressPercent = Math.min(100, Math.max(0, ((totalPhaseSeconds - timeLeft) / totalPhaseSeconds) * 100));

  // `elapsedSeconds` is the time actually spent in the phase, so skipping early logs what
  // was really studied instead of crediting a full 52-minute sprint.
  const handlePhaseTransition = (fromPhase: 'work' | 'break', elapsedSeconds: number) => {
    if (fromPhase === 'work') {
      const focusedMinutes = Math.round(elapsedSeconds / 60);
      if (focusedMinutes >= 1) {
        onSessionComplete({
          methodId: 'fifty-two-seventeen',
          methodName: 'The 52/17 Rule',
          taskTitle: taskSubject.trim() || '52-Minute Sprint',
          durationMinutes: focusedMinutes,
          phase: 'work',
        });
      }

      if (soundEnabled) playFocusCompleteChime();

      setPhase('break');
      setTimeLeft(BREAK_SECONDS);
      showBanner('52m sprint done. Starting 17m break.');

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    } else {
      if (soundEnabled) playBreakCompleteChime();

      setPhase('work');
      setTimeLeft(WORK_SECONDS);
      showBanner('Break complete. Ready for 52m focus.');

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    }
  };

  // The countdown engine — tick, expiry detection and the skip guard — is shared by
  // every timer so that its subtleties live in one place.
  const countdown = useCountdown({
    timeLeft,
    setTimeLeft,
    isRunning,
    setIsRunning,
    totalSeconds: totalPhaseSeconds,
    onExpire: (elapsed) => handlePhaseTransition(phase, elapsed),
  });


  const handleStartPause = countdown.toggle;

  const handleReset = countdown.reset;

  const handleSkipPhase = () => {
    // Credit only the time actually spent, not the whole configured block.
    countdown.runGuarded(() => handlePhaseTransition(phase, totalPhaseSeconds - timeLeft));
  };

  return (
    <div id="fifty-two-seventeen-timer-container" className="max-w-2xl mx-auto space-y-6">
      {bannerMessage && (
        <div 
          id="fifty-two-transition-alert"
          className="p-4 rounded-xl bg-surface-muted border border-line-strong text-ink-body text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-accent-sprint shrink-0" />
            <span className="font-medium">{bannerMessage}</span>
          </div>
          <button 
            id="dismiss-fifty-two-alert"
            onClick={() => dismissBanner()}
            className="text-xs text-ink-muted hover:text-ink-body underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Timer Card */}
      <div className="bg-surface border border-line rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        {/* Phase selector tabs */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            id="fifty-two-work-tab"
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
            Focus (52m)
          </button>
          <button
            id="fifty-two-break-tab"
            onClick={() => {
              if (phase !== 'break') {
                setPhase('break');
                setTimeLeft(BREAK_SECONDS);
                setIsRunning(false);
              }
            }}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
              phase === 'break'
                ? 'bg-accent-sprint text-canvas'
                : 'text-ink-muted hover:text-ink-body bg-surface-subtle'
            }`}
          >
            Break (17m)
          </button>
        </div>

        {/* Task Focus Input */}
        <div className="max-w-md mx-auto mb-8">
          <label htmlFor="fifty-two-task-input" className="block text-center text-xs tracking-wider uppercase text-ink-muted mb-2 font-medium">
            {phase === 'work' ? 'Task' : 'Break'}
          </label>
          {phase === 'work' ? (
            <input
              id="fifty-two-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g. Research synthesis notes..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-line bg-canvas text-sm text-ink-body placeholder-ink-faint focus:outline-none focus:border-accent-sprint transition-colors"
            />
          ) : (
            <div className="text-center text-sm font-serif italic text-accent-sprint flex items-center justify-center gap-1.5">
              <Footprints className="w-4 h-4" />
              <span>Step away from screens and recharge.</span>
            </div>
          )}
        </div>

        {/* Circular Progress Display */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="var(--color-track)" strokeWidth="4" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={phase === 'work' ? 'var(--color-accent-sprint)' : 'var(--color-accent-break)'}
                strokeWidth="4"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span id="fifty-two-digits" className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-ink">
                {formatTime(timeLeft)}
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

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            id="fifty-two-reset-btn"
            onClick={handleReset}
            title="Reset timer"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="fifty-two-start-pause-btn"
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
            id="fifty-two-skip-btn"
            onClick={handleSkipPhase}
            title="Skip to next phase"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Footer info & Auto-shift toggle */}
        <div className="mt-10 pt-6 border-t border-track flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-accent-sprint" />
            <span>Ratio: 52m Focus / 17m Rest</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="fifty-two-auto-shift-toggle"
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-accent-sprint"
            />
            <span>Auto-shift</span>
          </label>
        </div>
      </div>

      {/* Science card */}
      <div className="bg-canvas border border-line rounded-xl p-4 text-xs text-ink-secondary flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-surface-muted text-accent-sprint shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-ink">Tip: </span>
          17 minutes of offline rest resets dopamine and mental sharpness without causing grogginess.
        </div>
      </div>
    </div>
  );
}
