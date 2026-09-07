import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Sparkles, BookOpen, Brain, Coffee } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';
import {
  loadRetrievalPracticeState,
  saveRetrievalPracticeState,
} from '../../utils/timerPersistence';
import { useTransitionBanner } from '../../hooks/useTransitionBanner';
import { useCountdown } from '../../hooks/useCountdown';

interface RetrievalPracticeTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

type Phase = 'study' | 'recall' | 'rest';

const PHASE_SECONDS: Record<Phase, number> = {
  study: 20 * 60,
  recall: 5 * 60,
  rest: 5 * 60,
};

const PHASE_LABEL: Record<Phase, string> = {
  study: 'Study',
  recall: 'Recall',
  rest: 'Rest',
};

export function RetrievalPracticeTimer({ onSessionComplete, soundEnabled }: RetrievalPracticeTimerProps) {
  // Load saved state once on mount rather than re-parsing localStorage on every render.
  const [saved] = useState(loadRetrievalPracticeState);

  const [phase, setPhase] = useState<Phase>(() => saved?.phase ?? 'study');
  const [timeLeft, setTimeLeft] = useState(() => saved?.timeLeft ?? PHASE_SECONDS.study);
  const [isRunning, setIsRunning] = useState(() => saved?.isRunning ?? false);
  const [taskSubject, setTaskSubject] = useState(() => saved?.taskSubject ?? '');
  const [autoStartNext, setAutoStartNext] = useState(() => saved?.autoStartNext ?? true);
  const [completedCycles, setCompletedCycles] = useState(() => saved?.completedCycles ?? 0);

  const { message: bannerMessage, show: showBanner, dismiss: dismissBanner } =
    useTransitionBanner('Retrieval Practice');


  // Save changes to localStorage
  useEffect(() => {
    saveRetrievalPracticeState({
      phase,
      timeLeft,
      isRunning,
      taskSubject,
      autoStartNext,
      completedCycles,
    });
  }, [phase, timeLeft, isRunning, taskSubject, autoStartNext, completedCycles]);

  const totalPhaseSeconds = PHASE_SECONDS[phase];
  const progressPercent = Math.min(100, Math.max(0, ((totalPhaseSeconds - timeLeft) / totalPhaseSeconds) * 100));

  const topicName = taskSubject.trim() || 'Retrieval Cycle';

  // `elapsedSeconds` is the time actually spent in the phase, so skipping early logs what was
  // really studied rather than crediting the whole block.
  const handlePhaseTransition = (fromPhase: Phase, elapsedSeconds: number) => {
    const spentMinutes = Math.round(elapsedSeconds / 60);

    if (fromPhase === 'study') {
      if (spentMinutes >= 1) {
        onSessionComplete({
          methodId: 'retrieval-practice',
          methodName: 'Retrieval Practice',
          taskTitle: topicName,
          durationMinutes: spentMinutes,
          phase: 'work',
        });
      }
      if (soundEnabled) playFocusCompleteChime();

      setPhase('recall');
      setTimeLeft(PHASE_SECONDS.recall);
      showBanner('Notes away. Recall everything you can for 5 minutes.');
      setIsRunning(autoStartNext);
      return;
    }

    if (fromPhase === 'recall') {
      // Recall is effort too, logged separately so the history shows the retrieval actually
      // happened rather than folding it into the study block.
      if (spentMinutes >= 1) {
        onSessionComplete({
          methodId: 'retrieval-practice',
          methodName: 'Retrieval Practice',
          taskTitle: `${topicName} — recall`,
          durationMinutes: spentMinutes,
          phase: 'work',
        });
      }
      // A cycle counts once its recall is done — that is where the learning happens.
      if (spentMinutes >= 1) setCompletedCycles((prev) => prev + 1);
      if (soundEnabled) playFocusCompleteChime();

      setPhase('rest');
      setTimeLeft(PHASE_SECONDS.rest);
      showBanner('Recall done. Take 5 minutes before the next topic.');
      setIsRunning(autoStartNext);
      return;
    }

    if (soundEnabled) playBreakCompleteChime();
    setPhase('study');
    setTimeLeft(PHASE_SECONDS.study);
    showBanner('Rest over. Ready for 20 minutes of study.');
    setIsRunning(autoStartNext);
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

  const selectPhase = (next: Phase) => {
    if (phase === next) return;
    setPhase(next);
    setTimeLeft(PHASE_SECONDS[next]);
    setIsRunning(false);
  };

  const ringColour =
    phase === 'study'
      ? 'var(--color-accent-recall)'
      : phase === 'recall'
        ? 'var(--color-accent-focus)'
        : 'var(--color-accent-break)';

  return (
    <div id="retrieval-practice-timer-container" className="max-w-2xl mx-auto space-y-6">
      {bannerMessage && (
        <div
          id="retrieval-transition-alert"
          className="p-4 rounded-xl bg-surface-muted border border-line-strong text-ink-body text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-accent-recall shrink-0" />
            <span className="font-medium">{bannerMessage}</span>
          </div>
          <button
            id="dismiss-retrieval-alert"
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
          {(['study', 'recall', 'rest'] as Phase[]).map((p) => (
            <button
              key={p}
              id={`retrieval-phase-${p}-tab`}
              onClick={() => selectPhase(p)}
              className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                phase === p
                  ? p === 'rest'
                    ? 'bg-accent-break text-canvas'
                    : 'bg-ink text-canvas'
                  : 'text-ink-muted hover:text-ink-body bg-surface-subtle'
              }`}
            >
              {PHASE_LABEL[p]} ({PHASE_SECONDS[p] / 60}m)
            </button>
          ))}
        </div>

        {/* Topic input, or the phase instruction */}
        <div className="max-w-md mx-auto mb-8">
          <label
            htmlFor="retrieval-task-input"
            className="block text-center text-xs tracking-wider uppercase text-ink-muted mb-2 font-medium"
          >
            {phase === 'study' ? 'Topic' : PHASE_LABEL[phase]}
          </label>
          {phase === 'study' ? (
            <input
              id="retrieval-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g. Krebs cycle..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-line bg-canvas text-sm text-ink-body placeholder-ink-faint focus:outline-none focus:border-accent-recall transition-colors"
            />
          ) : phase === 'recall' ? (
            <div className="text-center text-sm font-serif italic text-accent-focus flex items-center justify-center gap-1.5">
              <Brain className="w-4 h-4 shrink-0" />
              <span>Close everything. Write down all you remember.</span>
            </div>
          ) : (
            <div className="text-center text-sm font-serif italic text-accent-break flex items-center justify-center gap-1.5">
              <Coffee className="w-4 h-4 shrink-0" />
              <span>Step away — let the memory settle.</span>
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
                stroke={ringColour}
                strokeWidth="4"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                id="retrieval-timer-digits"
                className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-ink"
              >
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-ink-muted mt-2">
                {PHASE_LABEL[phase]}
              </span>
              <span className="text-[11px] text-ink-faint mt-1">
                {autoStartNext ? 'Auto-shifts through the cycle' : 'Manual shift'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            id="retrieval-reset-btn"
            onClick={handleReset}
            title="Reset timer"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="retrieval-start-pause-btn"
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
            id="retrieval-skip-btn"
            onClick={handleSkipPhase}
            title="Skip to next phase"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Footer info & Auto-shift toggle */}
        <div className="mt-10 pt-6 border-t border-track flex flex-wrap items-center justify-between gap-4 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-accent-recall" />
            <span>
              Cycle: 20m study &rarr; 5m recall &rarr; 5m rest
              <span className="text-ink-faint ml-1.5">({completedCycles} done)</span>
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="retrieval-auto-shift-toggle"
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-accent-recall"
            />
            <span>Auto-shift</span>
          </label>
        </div>
      </div>

      {/* Science card */}
      <div className="bg-canvas border border-line rounded-xl p-4 text-xs text-ink-secondary flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-surface-muted text-accent-recall shrink-0 mt-0.5">
          <Brain className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-ink">Tip: </span>
          During recall, resist peeking. The struggle to retrieve is what builds the memory — a
          blank you fill in yourself sticks far better than a line you re-read.
        </div>
      </div>
    </div>
  );
}
