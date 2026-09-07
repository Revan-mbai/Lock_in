import { useState, useEffect, useRef, FormEvent } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Plus, Trash2, CheckCircle, Coffee, BookOpen, Sparkles } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { TimeBoxItem, FocusSessionLog } from '../../types';
import { loadTimeBoxingState, saveTimeBoxingState } from '../../utils/timerPersistence';
import { useTransitionBanner } from '../../hooks/useTransitionBanner';
import { useCountdown } from '../../hooks/useCountdown';

interface TimeBoxingTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

const DEFAULT_BOXES: TimeBoxItem[] = [
  { id: '1', title: 'Problem Set / Practice Questions', durationMinutes: 40, isBreak: false, completed: false },
  { id: '2', title: 'Hydration & Stretch Buffer', durationMinutes: 10, isBreak: true, completed: false },
  { id: '3', title: 'Synthesis & Summary Notes', durationMinutes: 30, isBreak: false, completed: false },
  { id: '4', title: 'Walk & Screen Break', durationMinutes: 15, isBreak: true, completed: false },
  { id: '5', title: 'Flashcards & Rapid Recall', durationMinutes: 25, isBreak: false, completed: false },
];

export function TimeBoxingTimer({ onSessionComplete, soundEnabled }: TimeBoxingTimerProps) {
  // Load saved state once on mount rather than re-parsing localStorage on every render.
  const [saved] = useState(loadTimeBoxingState);

  const [boxes, setBoxes] = useState<TimeBoxItem[]>(() => saved?.boxes ?? DEFAULT_BOXES);
  const [activeBoxIndex, setActiveBoxIndex] = useState(() => saved?.activeBoxIndex ?? 0);
  const [timeLeft, setTimeLeft] = useState(() => saved?.timeLeft ?? (saved?.boxes?.[saved.activeBoxIndex]?.durationMinutes ?? DEFAULT_BOXES[0].durationMinutes) * 60);
  const [isRunning, setIsRunning] = useState(() => saved?.isRunning ?? false);
  const [autoShiftNext, setAutoShiftNext] = useState(() => saved?.autoShiftNext ?? true);

  // New box form modal / inline
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newIsBreak, setNewIsBreak] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const { message: bannerMessage, show: showBanner, dismiss: dismissBanner } =
    useTransitionBanner('Time Boxing');

  // What the Skip click currently being processed acted on. Cleared after every commit below,
  // so it lives exactly as long as the double-click window it guards.
  const lastSkipSignatureRef = useRef<string | null>(null);


  // No dependency array on purpose: the Skip guard only has to outlive clicks dispatched
  // before React re-rendered. Holding the signature any longer killed the button for any
  // later click that repeated an index:timeLeft pair — and those repeat constantly, since
  // every path that re-arms a box parks it at exactly its full duration.
  useEffect(() => {
    lastSkipSignatureRef.current = null;
  });

  // Save changes to localStorage
  useEffect(() => {
    saveTimeBoxingState({
      boxes,
      activeBoxIndex,
      timeLeft,
      isRunning,
      autoShiftNext,
    });
  }, [boxes, activeBoxIndex, timeLeft, isRunning, autoShiftNext]);

  const activeBox = boxes[activeBoxIndex] || boxes[0];
  const activeBoxTotalSeconds = activeBox ? activeBox.durationMinutes * 60 : 1800;

  // Derived from persisted state rather than held in a ref: a ref is lost on reload, and the
  // exhausted schedule survives it, so Skip would re-log the final box after every refresh.
  const scheduleFinished =
    boxes.length > 0 &&
    activeBoxIndex === boxes.length - 1 &&
    Boolean(boxes[activeBoxIndex]?.completed);
  const progressPercent = Math.min(100, Math.max(0, ((activeBoxTotalSeconds - timeLeft) / activeBoxTotalSeconds) * 100));

  // Advance to next box. `elapsedSeconds` is the time actually spent on the box, so
  // skipping early logs what was really studied instead of the box's full length.
  const handleBoxComplete = (indexCompleted: number, elapsedSeconds: number) => {
    const completedItem = boxes[indexCompleted];
    const nextIndex = indexCompleted + 1;

    // Tick off the finished box, and clear the tick on the one starting next so its own
    // completion is credited normally when it ends.
    const updatedBoxes = boxes.map((b, idx) => {
      if (idx === indexCompleted) return { ...b, completed: true };
      if (idx === nextIndex && b.completed) return { ...b, completed: false };
      return b;
    });
    setBoxes(updatedBoxes);

    // A box still carrying its tick has already been credited once. Every path that gives a
    // box a fresh countdown clears the flag first, so this only ever catches a genuine repeat
    // — such as Skip pressed again on a schedule that has already run out.
    const isRepeatCompletion = Boolean(completedItem?.completed);

    if (completedItem && !completedItem.isBreak && !isRepeatCompletion) {
      const focusedMinutes = Math.round(elapsedSeconds / 60);
      if (focusedMinutes >= 1) {
        onSessionComplete({
          methodId: 'time-boxing',
          methodName: 'Time Boxing',
          taskTitle: completedItem.title,
          durationMinutes: focusedMinutes,
          phase: 'work',
        });
      }
      if (soundEnabled) playFocusCompleteChime();
    } else if (!isRepeatCompletion) {
      if (soundEnabled) playBreakCompleteChime();
    }

    // Check if there is a next box
    if (nextIndex < boxes.length) {
      const nextBox = boxes[nextIndex];
      setActiveBoxIndex(nextIndex);
      setTimeLeft(nextBox.durationMinutes * 60);

      showBanner(
        `"${completedItem.title}" done. Starting "${nextBox.title}" (${nextBox.durationMinutes}m).`
      );

      if (autoShiftNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    } else {
      // All boxes finished. Park the clock at zero so the exhausted schedule cannot be
      // mistaken for a box that still has time left on it.
      setIsRunning(false);
      setTimeLeft(0);
      showBanner('All scheduled boxes completed.');
    }
  };

  // Shared countdown engine, used for its effects only. This timer keeps its own start and
  // reset handlers because they also clear box completion flags, and its own signature-based
  // skip guard: the hook's guard latches until the clock leaves zero, and the terminal "all
  // boxes finished" branch parks it AT zero, which is exactly how that guard once got stuck
  // and killed the Skip button for good.
  useCountdown({
    timeLeft,
    setTimeLeft,
    isRunning,
    setIsRunning,
    totalSeconds: activeBoxTotalSeconds,
    onExpire: (elapsed) => handleBoxComplete(activeBoxIndex, elapsed),
  });


  const handleSelectBox = (index: number) => {
    // Re-selecting the box already running would reset its countdown and pause it, so a
    // stray click anywhere on the active row threw away the progress on it.
    if (index === activeBoxIndex) return;
    setActiveBoxIndex(index);
    // Picking a finished box means running it again, so drop its tick — otherwise the repeat
    // guard above would treat the re-run as already logged.
    if (boxes[index].completed) {
      setBoxes(boxes.map((b, i) => (i === index ? { ...b, completed: false } : b)));
    }
    setTimeLeft(boxes[index].durationMinutes * 60);
    setIsRunning(false);
  };

  const handleStartPause = () => {
    if (!isRunning && scheduleFinished) {
      // Every box was ticked off and the completed flags were never cleared, leaving the
      // schedule permanently finished. Starting again runs the whole plan from the top.
        setBoxes(boxes.map((b) => (b.completed ? { ...b, completed: false } : b)));
      setActiveBoxIndex(0);
      setTimeLeft(boxes[0].durationMinutes * 60);
      setIsRunning(true);
      return;
    }
    if (!isRunning) {
      // Pressing Play on an exhausted box restarts it rather than instantly re-completing it
      // and logging a phantom full-duration session.
      if (timeLeft <= 0) {
        setTimeLeft(activeBoxTotalSeconds);
      }
      // Starting a box that still carries its tick means running it again — keyed off the
      // flag, not the clock, because an early skip leaves time on it.
      if (boxes[activeBoxIndex]?.completed) {
        setBoxes(boxes.map((b, i) => (i === activeBoxIndex ? { ...b, completed: false } : b)));
      }
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    if (activeBox) {
      setTimeLeft(activeBox.durationMinutes * 60);
      // A reset box is being run again from the top, so it is no longer a completed one.
      setBoxes(boxes.map((b, i) => (i === activeBoxIndex && b.completed ? { ...b, completed: false } : b)));
    }
  };

  const handleSkip = () => {
    // The final box has already been completed and logged; skipping again would log it once
    // more on every click.
    if (scheduleFinished) return;
    // Clicks dispatched before React re-renders share this closure, so a fast double-click
    // would credit the same box twice. Compare what this click is about to do rather than
    // latching a flag: a latch has to be un-set somewhere, and every miss leaves Skip dead.
    const signature = `${activeBoxIndex}:${timeLeft}`;
    if (lastSkipSignatureRef.current === signature) return;
    lastSkipSignatureRef.current = signature;
    // Credit only the time actually spent, not the box's full length.
    handleBoxComplete(activeBoxIndex, activeBoxTotalSeconds - timeLeft);
  };

  const handleAddBox = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newBox: TimeBoxItem = {
      id: Math.random().toString(),
      title: newTitle.trim(),
      durationMinutes: Math.max(1, newDuration),
      isBreak: newIsBreak,
      completed: false,
    };

    setBoxes([...boxes, newBox]);
    setNewTitle('');
    setNewDuration(25);
    setNewIsBreak(false);
    setShowAddForm(false);
  };

  const handleDeleteBox = (id: string, index: number) => {
    if (boxes.length <= 1) return;
    const filtered = boxes.filter((b) => b.id !== id);

    if (index === activeBoxIndex) {
      // Move on to the box that took its place — falling back to the last one when the
      // schedule's final box was removed. Jumping back to box 1 restarted the whole plan.
      const nextIndex = Math.min(index, filtered.length - 1);
      // It gets a fresh countdown, so clear any tick it is still carrying.
      setBoxes(filtered.map((b, i) => (i === nextIndex && b.completed ? { ...b, completed: false } : b)));
      setActiveBoxIndex(nextIndex);
      setTimeLeft(filtered[nextIndex].durationMinutes * 60);
      setIsRunning(false);
      return;
    }

    setBoxes(filtered);
    if (index < activeBoxIndex) {
      // Everything after the removed box shifts down one.
      setActiveBoxIndex(activeBoxIndex - 1);
    }
  };

  const totalStudyMinutes = boxes.filter(b => !b.isBreak).reduce((sum, b) => sum + b.durationMinutes, 0);
  const totalBreakMinutes = boxes.filter(b => b.isBreak).reduce((sum, b) => sum + b.durationMinutes, 0);

  return (
    <div id="time-boxing-timer-container" className="max-w-2xl mx-auto space-y-6">
      {bannerMessage && (
        <div 
          id="timebox-transition-alert"
          className="p-4 rounded-xl bg-surface-muted border border-line-strong text-ink-body text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-accent-box shrink-0" />
            <span className="font-medium">{bannerMessage}</span>
          </div>
          <button 
            id="dismiss-timebox-alert"
            onClick={() => dismissBanner()}
            className="text-xs text-ink-muted hover:text-ink-body underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Box Card */}
      <div className="bg-surface border border-line rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        {/* Active Box Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-canvas text-ink-muted border border-line mb-2">
            <span>Box {activeBoxIndex + 1} of {boxes.length}</span>
            <span>&bull;</span>
            <span className={activeBox?.isBreak ? 'text-accent-break font-semibold' : 'text-accent-box font-semibold'}>
              {activeBox?.isBreak ? 'Break' : 'Focus'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-medium text-ink">
            {activeBox?.title || 'Study Block'}
          </h2>
        </div>

        {/* Circular Ring */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="var(--color-track)" strokeWidth="4" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={activeBox?.isBreak ? 'var(--color-accent-break)' : 'var(--color-accent-box)'}
                strokeWidth="4"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span id="timebox-timer-digits" className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-ink">
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-ink-muted mt-2">
                {activeBox?.isBreak ? 'Break' : 'Focus'}
              </span>
              <span className="text-[11px] text-ink-faint mt-1">
                {autoShiftNext ? 'Auto-shifts into next box' : 'Manual shift'}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            id="timebox-reset-btn"
            onClick={handleReset}
            title="Reset timer"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="timebox-start-pause-btn"
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
                  {scheduleFinished
                    ? 'Restart'
                    : timeLeft < activeBoxTotalSeconds
                      ? 'Resume'
                      : 'Start'}
                </span>
              </>
            )}
          </button>

          <button
            id="timebox-skip-btn"
            onClick={handleSkip}
            title="Skip to next box"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Auto shift toggle */}
        <div className="mt-8 pt-4 border-t border-track flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <span>Session: <strong className="text-ink-body">{totalStudyMinutes}m focus</strong>, {totalBreakMinutes}m break</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="timebox-auto-shift-toggle"
              type="checkbox"
              checked={autoShiftNext}
              onChange={(e) => setAutoShiftNext(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-accent-box"
            />
            <span>Auto-shift</span>
          </label>
        </div>
      </div>

      {/* Schedule / Time Boxes List Card */}
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Scheduled Boxes</h3>
            <p className="text-xs text-ink-muted">Click any box to switch or add blocks</p>
          </div>
          <button
            id="timebox-add-toggle-btn"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink-body hover:bg-canvas flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Box</span>
          </button>
        </div>

        {/* Add Box Form */}
        {showAddForm && (
          <form onSubmit={handleAddBox} className="p-4 rounded-xl bg-canvas border border-line space-y-3 text-xs">
            <div className="font-medium text-ink-body">New Time Box</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title..."
                required
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-line bg-surface text-xs focus:outline-none focus:border-accent-box"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-20 px-3 py-2 rounded-lg border border-line bg-surface text-xs text-center focus:outline-none focus:border-accent-box"
                />
                <span className="text-ink-muted">mins</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-ink-secondary">
                <input
                  type="checkbox"
                  checked={newIsBreak}
                  onChange={(e) => setNewIsBreak(e.target.checked)}
                  className="rounded accent-accent-break"
                />
                <span>Break / buffer</span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-ink-muted hover:text-ink-body"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-ink text-canvas text-xs font-medium hover:bg-ink-hover"
                >
                  Add Box
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Box List */}
        <div className="space-y-2">
          {boxes.map((box, index) => {
            const isActive = index === activeBoxIndex;
            return (
              <div
                key={box.id}
                onClick={() => handleSelectBox(index)}
                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isActive
                    ? 'border-accent-box bg-surface shadow-xs'
                    : box.completed
                      ? 'border-line bg-surface-subtle opacity-75'
                      : 'border-line bg-canvas hover:border-line-strong'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md ${
                    box.completed 
                      ? 'text-accent-break bg-tint-break' 
                      : box.isBreak 
                        ? 'text-accent-break bg-tint-break' 
                        : 'text-accent-box bg-surface-muted'
                  }`}>
                    {box.completed ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : box.isBreak ? (
                      <Coffee className="w-4 h-4" />
                    ) : (
                      <BookOpen className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${box.completed ? 'line-through text-ink-muted' : 'text-ink'}`}>
                        {box.title}
                      </span>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent-box text-canvas font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-muted flex items-center gap-2">
                      <span>{box.durationMinutes}m</span>
                      <span>&bull;</span>
                      <span>{box.isBreak ? 'Break' : 'Focus'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {boxes.length > 1 && (
                    <button
                      onClick={() => handleDeleteBox(box.id, index)}
                      title="Delete box"
                      className="p-1.5 text-ink-faint hover:text-accent-danger rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
