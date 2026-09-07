import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Sparkles, Lightbulb, CheckCircle2 } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';
import {
  loadFeynmanState,
  saveFeynmanState,
  FEYNMAN_STAGE_LABELS,
} from '../../utils/timerPersistence';
import { useTransitionBanner } from '../../hooks/useTransitionBanner';
import { useCountdown } from '../../hooks/useCountdown';

interface FeynmanTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

const STAGES: { label: string; minutes: number; instruction: string }[] = [
  { label: 'Study', minutes: 15, instruction: 'Read and take notes on the concept.' },
  { label: 'Explain', minutes: 10, instruction: 'Write it out in plain words, as if for a twelve-year-old.' },
  { label: 'Find gaps', minutes: 10, instruction: 'Where the explanation broke down, go back to the source.' },
  { label: 'Simplify', minutes: 5, instruction: 'Tighten it and add an analogy of your own.' },
];

const TOTAL_MINUTES = STAGES.reduce((sum, s) => sum + s.minutes, 0);

export function FeynmanTimer({ onSessionComplete, soundEnabled }: FeynmanTimerProps) {
  // Load saved state once on mount rather than re-parsing localStorage on every render.
  const [saved] = useState(loadFeynmanState);

  const [stageIndex, setStageIndex] = useState(() => saved?.stageIndex ?? 0);
  const [timeLeft, setTimeLeft] = useState(() => saved?.timeLeft ?? STAGES[0].minutes * 60);
  const [isRunning, setIsRunning] = useState(() => saved?.isRunning ?? false);
  const [concept, setConcept] = useState(() => saved?.concept ?? '');
  const [autoStartNext, setAutoStartNext] = useState(() => saved?.autoStartNext ?? true);

  const { message: bannerMessage, show: showBanner, dismiss: dismissBanner } =
    useTransitionBanner('Feynman Technique');



  // Save changes to localStorage
  useEffect(() => {
    saveFeynmanState({ stageIndex, timeLeft, isRunning, concept, autoStartNext });
  }, [stageIndex, timeLeft, isRunning, concept, autoStartNext]);

  // Unlike the looping methods this protocol ends: stageIndex runs past the last stage and the
  // run is finished until the user starts a new concept.
  const isComplete = stageIndex >= STAGES.length;
  const currentStage = STAGES[stageIndex];
  const totalStageSeconds = currentStage ? currentStage.minutes * 60 : 0;
  const progressPercent = totalStageSeconds
    ? Math.min(100, Math.max(0, ((totalStageSeconds - timeLeft) / totalStageSeconds) * 100))
    : 100;

  const conceptName = concept.trim() || 'Concept';

  // `elapsedSeconds` is the time actually spent on the stage, so skipping early logs what was
  // really done rather than crediting the whole stage.
  const handleStageComplete = (indexCompleted: number, elapsedSeconds: number) => {
    const stage = STAGES[indexCompleted];
    if (!stage) return;

    const spentMinutes = Math.round(elapsedSeconds / 60);
    if (spentMinutes >= 1) {
      onSessionComplete({
        methodId: 'feynman',
        methodName: 'Feynman Technique',
        taskTitle: `${conceptName} — ${stage.label.toLowerCase()}`,
        durationMinutes: spentMinutes,
        phase: 'work',
      });
    }

    const nextIndex = indexCompleted + 1;
    if (nextIndex < STAGES.length) {
      if (soundEnabled) playFocusCompleteChime();
      setStageIndex(nextIndex);
      setTimeLeft(STAGES[nextIndex].minutes * 60);
      showBanner(
        `${stage.label} done. Next: ${STAGES[nextIndex].label.toLowerCase()} (${STAGES[nextIndex].minutes}m).`
      );
      setIsRunning(autoStartNext);
      return;
    }

    // All four stages are done. Park the clock at zero so the finished run is unambiguous.
    if (soundEnabled) playBreakCompleteChime();
    setStageIndex(STAGES.length);
    setTimeLeft(0);
    setIsRunning(false);
    showBanner(`"${conceptName}" worked through. Start another concept when ready.`);
  };

  // Shared countdown engine. A finished protocol parks at zero, so onExpire refuses to run
  // again rather than re-completing the last stage.
  const countdown = useCountdown({
    timeLeft,
    setTimeLeft,
    isRunning,
    setIsRunning,
    totalSeconds: totalStageSeconds,
    onExpire: (elapsed) => {
      if (isComplete) return;
      handleStageComplete(stageIndex, elapsed);
    },
  });


  const startFreshRun = () => {
    setStageIndex(0);
    setTimeLeft(STAGES[0].minutes * 60);
    setIsRunning(true);
  };

  const handleStartPause = () => {
    if (!isRunning && isComplete) {
      // The protocol finished; the button restarts it from the top for a new concept.
      startFreshRun();
      return;
    }
    countdown.toggle();
  };

  const handleReset = () => {
    setIsRunning(false);
    if (isComplete) {
      setStageIndex(0);
      setTimeLeft(STAGES[0].minutes * 60);
      return;
    }
    setTimeLeft(totalStageSeconds);
  };

  const handleSkipStage = () => {
    // A finished run has already logged its last stage; skipping again would log it twice.
    if (isComplete) return;
    countdown.runGuarded(() => handleStageComplete(stageIndex, totalStageSeconds - timeLeft));
  };

  const selectStage = (index: number) => {
    if (index === stageIndex) return;
    setStageIndex(index);
    setTimeLeft(STAGES[index].minutes * 60);
    setIsRunning(false);
  };

  return (
    <div id="feynman-timer-container" className="max-w-2xl mx-auto space-y-6">
      {bannerMessage && (
        <div
          id="feynman-transition-alert"
          className="p-4 rounded-xl bg-surface-muted border border-line-strong text-ink-body text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-accent-explain shrink-0" />
            <span className="font-medium">{bannerMessage}</span>
          </div>
          <button
            id="dismiss-feynman-alert"
            onClick={() => dismissBanner()}
            className="text-xs text-ink-muted hover:text-ink-body underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Timer Card */}
      <div className="bg-surface border border-line rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        {/* Stage selector — a one-pass protocol, so these read as a progress trail */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {STAGES.map((stage, index) => {
            const isCurrent = !isComplete && index === stageIndex;
            const isDone = isComplete || index < stageIndex;
            return (
              <button
                key={stage.label}
                id={`feynman-stage-${index}-tab`}
                onClick={() => selectStage(index)}
                className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-ink text-canvas'
                    : isDone
                      ? 'bg-tint-explain text-accent-explain border border-line'
                      : 'text-ink-muted hover:text-ink-body bg-surface-subtle'
                }`}
              >
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {index + 1}. {stage.label} ({stage.minutes}m)
                </span>
              </button>
            );
          })}
        </div>

        {/* Concept input, or the current stage instruction */}
        <div className="max-w-md mx-auto mb-8">
          <label
            htmlFor="feynman-concept-input"
            className="block text-center text-xs tracking-wider uppercase text-ink-muted mb-2 font-medium"
          >
            Concept
          </label>
          <input
            id="feynman-concept-input"
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g. Why entropy always increases..."
            className="w-full text-center px-4 py-2.5 rounded-xl border border-line bg-canvas text-sm text-ink-body placeholder-ink-faint focus:outline-none focus:border-accent-explain transition-colors"
          />
          <p className="mt-3 text-center text-sm font-serif italic text-accent-explain">
            {isComplete ? 'All four stages complete.' : currentStage.instruction}
          </p>
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
                stroke="var(--color-accent-explain)"
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
                id="feynman-timer-digits"
                className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-ink"
              >
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-ink-muted mt-2">
                {isComplete ? 'Complete' : `Stage ${stageIndex + 1} of ${STAGES.length}`}
              </span>
              <span className="text-[11px] text-ink-faint mt-1">
                {isComplete
                  ? 'Start another concept'
                  : autoStartNext
                    ? 'Auto-shifts to next stage'
                    : 'Manual shift'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            id="feynman-reset-btn"
            onClick={handleReset}
            title={isComplete ? 'Back to stage 1' : 'Reset stage'}
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="feynman-start-pause-btn"
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
                <span>
                  {isComplete ? 'Restart' : timeLeft < totalStageSeconds ? 'Resume' : 'Start'}
                </span>
              </>
            )}
          </button>

          <button
            id="feynman-skip-btn"
            onClick={handleSkipStage}
            title="Skip to next stage"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Footer info & Auto-shift toggle */}
        <div className="mt-10 pt-6 border-t border-track flex flex-wrap items-center justify-between gap-4 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-accent-explain" />
            <span>
              {FEYNMAN_STAGE_LABELS.join(' → ')}
              <span className="text-ink-faint ml-1.5">({TOTAL_MINUTES}m total)</span>
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="feynman-auto-shift-toggle"
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-accent-explain"
            />
            <span>Auto-shift</span>
          </label>
        </div>
      </div>

      {/* Science card */}
      <div className="bg-canvas border border-line rounded-xl p-4 text-xs text-ink-secondary flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-surface-muted text-accent-explain shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-ink">Tip: </span>
          Write the explanation out rather than saying it in your head. The moment you reach for a
          word you do not have is the gap worth studying.
        </div>
      </div>
    </div>
  );
}
