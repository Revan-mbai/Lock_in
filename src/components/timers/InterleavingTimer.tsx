import { useState, useEffect, useRef, FormEvent } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Plus, Trash2, Sparkles, Shuffle, Repeat } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime } from '../../utils/audio';
import { InterleaveSubject, FocusSessionLog } from '../../types';
import {
  loadInterleavingState,
  saveInterleavingState,
} from '../../utils/timerPersistence';
import { useTransitionBanner } from '../../hooks/useTransitionBanner';
import { useCountdown } from '../../hooks/useCountdown';

interface InterleavingTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

const DEFAULT_SUBJECTS: InterleaveSubject[] = [
  { id: '1', name: 'Calculus' },
  { id: '2', name: 'Organic Chemistry' },
  { id: '3', name: 'Statistics' },
];

const DEFAULT_BLOCK_MINUTES = 20;
const MIN_BLOCK_MINUTES = 5;
const MAX_BLOCK_MINUTES = 60;
const MAX_SUBJECTS = 5;

export function InterleavingTimer({ onSessionComplete, soundEnabled }: InterleavingTimerProps) {
  // Load saved state once on mount rather than re-parsing localStorage on every render.
  const [saved] = useState(loadInterleavingState);

  const [subjects, setSubjects] = useState<InterleaveSubject[]>(() =>
    saved?.subjects?.length ? saved.subjects : DEFAULT_SUBJECTS
  );
  const [blockMinutes, setBlockMinutes] = useState(() => saved?.blockMinutes ?? DEFAULT_BLOCK_MINUTES);
  const [activeSubjectIndex, setActiveSubjectIndex] = useState(() => saved?.activeSubjectIndex ?? 0);
  const [timeLeft, setTimeLeft] = useState(
    () => saved?.timeLeft ?? (saved?.blockMinutes ?? DEFAULT_BLOCK_MINUTES) * 60
  );
  const [isRunning, setIsRunning] = useState(() => saved?.isRunning ?? false);
  const [autoRotate, setAutoRotate] = useState(() => saved?.autoRotate ?? true);
  const [roundsCompleted, setRoundsCompleted] = useState(() => saved?.roundsCompleted ?? 0);

  const [newSubject, setNewSubject] = useState('');
  const [blockDraft, setBlockDraft] = useState(() => String(saved?.blockMinutes ?? DEFAULT_BLOCK_MINUTES));
  const [showAddForm, setShowAddForm] = useState(false);

  const { message: bannerMessage, show: showBanner, dismiss: dismissBanner } =
    useTransitionBanner('Interleaved Practice');

  // What the Skip click currently being processed acted on. Cleared after every commit below,
  // so it lives exactly as long as the double-click window it guards.
  const lastSkipSignatureRef = useRef<string | null>(null);


  // No dependency array on purpose: the Skip guard only has to outlive clicks dispatched before
  // this component re-rendered. Holding the signature any longer would kill the button for a
  // later click that happened to repeat an index:timeLeft pair.
  useEffect(() => {
    lastSkipSignatureRef.current = null;
  });

  // Save changes to localStorage
  useEffect(() => {
    saveInterleavingState({
      subjects,
      blockMinutes,
      activeSubjectIndex,
      timeLeft,
      isRunning,
      autoRotate,
      roundsCompleted,
    });
  }, [subjects, blockMinutes, activeSubjectIndex, timeLeft, isRunning, autoRotate, roundsCompleted]);

  const blockSeconds = blockMinutes * 60;
  const activeSubject = subjects[activeSubjectIndex] ?? subjects[0];
  const progressPercent = Math.min(100, Math.max(0, ((blockSeconds - timeLeft) / blockSeconds) * 100));

  // `elapsedSeconds` is the time actually spent on the subject, so rotating early logs what was
  // really studied rather than crediting the whole block.
  const rotate = (indexCompleted: number, elapsedSeconds: number) => {
    const finished = subjects[indexCompleted];
    const spentMinutes = Math.round(elapsedSeconds / 60);

    if (finished && spentMinutes >= 1) {
      onSessionComplete({
        methodId: 'interleaving',
        methodName: 'Interleaved Practice',
        taskTitle: finished.name,
        durationMinutes: spentMinutes,
        phase: 'work',
      });
    }

    if (soundEnabled) playFocusCompleteChime();

    // The rotation never ends — wrapping past the last subject starts another round. The count
    // is gated on the same threshold as the log above: rotating straight through without
    // studying must not claim a completed round.
    const nextIndex = subjects.length > 0 ? (indexCompleted + 1) % subjects.length : 0;
    if (nextIndex === 0 && spentMinutes >= 1) setRoundsCompleted((prev) => prev + 1);

    setActiveSubjectIndex(nextIndex);
    setTimeLeft(blockSeconds);
    showBanner(
      subjects[nextIndex]
        ? `Switch to "${subjects[nextIndex].name}" for ${blockMinutes} minutes.`
        : 'Rotation complete.'
    );
    setIsRunning(autoRotate);
  };

  // Shared countdown engine: tick, expiry detection and the sleep-gap guard.
  const countdown = useCountdown({
    timeLeft,
    setTimeLeft,
    isRunning,
    setIsRunning,
    totalSeconds: blockSeconds,
    onExpire: (elapsed) => rotate(activeSubjectIndex, elapsed),
  });


  const handleStartPause = countdown.toggle;

  const handleReset = countdown.reset;

  const handleSkip = () => {
    if (subjects.length === 0) return;
    // Clicks dispatched before React re-renders share this closure, so without a guard a fast
    // double-click credited the same block twice. Comparing what the click is about to do —
    // rather than latching a flag — means the guard can never get stuck.
    const signature = `${activeSubjectIndex}:${timeLeft}`;
    if (lastSkipSignatureRef.current === signature) return;
    lastSkipSignatureRef.current = signature;
    rotate(activeSubjectIndex, blockSeconds - timeLeft);
  };

  const handleSelectSubject = (index: number) => {
    // Re-selecting the subject already running would reset its countdown and pause it, so a
    // stray click on the active chip would throw away progress.
    if (index === activeSubjectIndex) return;
    setActiveSubjectIndex(index);
    setTimeLeft(blockSeconds);
    setIsRunning(false);
  };

  const handleAddSubject = (e: FormEvent) => {
    e.preventDefault();
    const name = newSubject.trim();
    if (!name || subjects.length >= MAX_SUBJECTS) return;
    setSubjects([
      ...subjects,
      { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name },
    ]);
    setNewSubject('');
    setShowAddForm(false);
  };

  const handleDeleteSubject = (index: number) => {
    // Interleaving needs at least two subjects to mean anything, so the last two stay put.
    if (subjects.length <= 2) return;
    const filtered = subjects.filter((_, i) => i !== index);

    if (index === activeSubjectIndex) {
      // Continue with whichever subject took its place, wrapping when the last one went.
      const nextIndex = Math.min(index, filtered.length - 1);
      setActiveSubjectIndex(nextIndex);
      setTimeLeft(blockSeconds);
      setIsRunning(false);
      setSubjects(filtered);
      return;
    }

    setSubjects(filtered);
    if (index < activeSubjectIndex) {
      // Everything after the removed subject shifts down one.
      setActiveSubjectIndex(activeSubjectIndex - 1);
    }
  };

  /**
   * Commit a block length. Only touches timeLeft when the value actually changed, so simply
   * focusing and leaving the field cannot discard a paused block's progress.
   */
  const commitBlockMinutes = (next: number) => {
    setBlockDraft(String(next));
    if (next === blockMinutes) return;
    setBlockMinutes(next);
    setTimeLeft(next * 60);
  };

  /**
   * Held as text while typing. Clamping on every keystroke made most values unreachable — the
   * field is controlled, so typing "3" toward 30 was rewritten to the 5-minute minimum, and
   * clearing it resolved to a silent 20.
   */
  const handleBlockDraftChange = (raw: string) => {
    if (isRunning) return;
    setBlockDraft(raw);
    // Spinner clicks and fully typed, in-range values are applied straight away.
    const value = Number(raw);
    if (
      raw.trim() !== '' &&
      Number.isInteger(value) &&
      value >= MIN_BLOCK_MINUTES &&
      value <= MAX_BLOCK_MINUTES
    ) {
      commitBlockMinutes(value);
    }
  };

  /** Partial or out-of-range text is only resolved here, so "3" can still become "30". */
  const handleBlockDraftCommit = () => {
    // Load-bearing: disabling a focused input fires blur, so pressing Start while the field has
    // focus would otherwise commit through the disabled attribute.
    if (isRunning) return;
    const rounded = Math.round(Number(blockDraft));
    const next =
      blockDraft.trim() !== '' && Number.isFinite(rounded) && rounded > 0
        ? Math.max(MIN_BLOCK_MINUTES, Math.min(MAX_BLOCK_MINUTES, rounded))
        : blockMinutes; // empty or unparseable restores what the user had, never a silent default
    commitBlockMinutes(next);
  };

  return (
    <div id="interleaving-timer-container" className="max-w-2xl mx-auto space-y-6">
      {bannerMessage && (
        <div
          id="interleaving-transition-alert"
          className="p-4 rounded-xl bg-surface-muted border border-line-strong text-ink-body text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-accent-rotate shrink-0" />
            <span className="font-medium">{bannerMessage}</span>
          </div>
          <button
            id="dismiss-interleaving-alert"
            onClick={() => dismissBanner()}
            className="text-xs text-ink-muted hover:text-ink-body underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Timer Card */}
      <div className="bg-surface border border-line rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-tint-rotate text-accent-rotate border border-line">
            <Shuffle className="w-3.5 h-3.5" />
            <span>
              Subject {subjects.length ? activeSubjectIndex + 1 : 0} of {subjects.length}
            </span>
          </div>
          <h3 id="interleaving-active-subject" className="mt-3 font-serif text-2xl font-medium text-ink">
            {activeSubject ? activeSubject.name : 'Add a subject'}
          </h3>
          <p className="text-xs text-ink-muted mt-1">{blockMinutes}-minute block</p>
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
                stroke="var(--color-accent-rotate)"
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
                id="interleaving-timer-digits"
                className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-ink"
              >
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-ink-muted mt-2">
                Focus
              </span>
              <span className="text-[11px] text-ink-faint mt-1">
                {autoRotate ? 'Auto-rotates to next subject' : 'Manual rotate'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            id="interleaving-reset-btn"
            onClick={handleReset}
            title="Reset block"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="interleaving-start-pause-btn"
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
                <span>{timeLeft < blockSeconds ? 'Resume' : 'Start'}</span>
              </>
            )}
          </button>

          <button
            id="interleaving-skip-btn"
            onClick={handleSkip}
            title="Rotate to next subject"
            className="p-3 rounded-full border border-line text-ink-muted hover:text-ink-body hover:bg-surface-subtle transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Footer info & auto-rotate toggle */}
        <div className="mt-10 pt-6 border-t border-track flex flex-wrap items-center justify-between gap-4 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <Repeat className="w-4 h-4 text-accent-rotate" />
            <span>
              {subjects.length} subjects &times; {blockMinutes}m
              <span className="text-ink-faint ml-1.5">({roundsCompleted} rounds done)</span>
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="interleaving-auto-rotate-toggle"
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-accent-rotate"
            />
            <span>Auto-rotate</span>
          </label>
        </div>
      </div>

      {/* Rotation editor */}
      <div className="bg-surface border border-line rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Rotation</h3>
            <p className="text-xs text-ink-muted">Click a subject to jump to it</p>
          </div>
          <button
            id="interleaving-add-toggle-btn"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={subjects.length >= MAX_SUBJECTS}
            className="px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink-body hover:bg-canvas flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {showAddForm && subjects.length < MAX_SUBJECTS && (
          <form onSubmit={handleAddSubject} className="flex gap-2 text-xs">
            <input
              id="interleaving-new-subject-input"
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject name..."
              required
              className="flex-1 px-3 py-2 rounded-lg border border-line bg-canvas text-xs text-ink-body placeholder-ink-faint focus:outline-none focus:border-accent-rotate"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-ink text-canvas text-xs font-medium hover:bg-ink-hover"
            >
              Add
            </button>
          </form>
        )}

        <div className="space-y-2">
          {subjects.map((subject, index) => {
            const isActive = index === activeSubjectIndex;
            return (
              <div
                key={subject.id}
                onClick={() => handleSelectSubject(index)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  isActive
                    ? 'border-accent-rotate bg-tint-rotate'
                    : 'border-line bg-canvas hover:border-line-strong'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 shrink-0 rounded-full text-[11px] font-mono font-semibold flex items-center justify-center ${
                      isActive ? 'bg-accent-rotate text-canvas' : 'bg-surface-muted text-ink-muted'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-xs font-medium text-ink truncate">{subject.name}</span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] text-ink-muted font-mono">{blockMinutes}m</span>
                  <button
                    onClick={() => handleDeleteSubject(index)}
                    disabled={subjects.length <= 2}
                    title={subjects.length <= 2 ? 'Interleaving needs at least two subjects' : 'Remove subject'}
                    className="p-1 rounded text-ink-faint hover:text-accent-danger transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-line-subtle flex items-center justify-between text-xs text-ink-muted">
          <label htmlFor="interleaving-block-input" className="font-medium">
            Block length
          </label>
          <div className="flex items-center gap-2">
            <input
              id="interleaving-block-input"
              type="number"
              min={MIN_BLOCK_MINUTES}
              max={MAX_BLOCK_MINUTES}
              value={blockDraft}
              disabled={isRunning}
              title={isRunning ? 'Pause to change the block length' : undefined}
              onChange={(e) => handleBlockDraftChange(e.target.value)}
              onBlur={handleBlockDraftCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBlockDraftCommit();
                }
              }}
              className="w-20 px-3 py-2 rounded-lg border border-line bg-canvas text-xs text-center text-ink-body focus:outline-none focus:border-accent-rotate disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span>mins</span>
          </div>
        </div>
      </div>

      {/* Science card */}
      <div className="bg-canvas border border-line rounded-xl p-4 text-xs text-ink-secondary flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-surface-muted text-accent-rotate shrink-0 mt-0.5">
          <Shuffle className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-ink">Tip: </span>
          Switching before a subject feels finished is uncomfortable, and that is the mechanism —
          returning to a half-settled topic forces your brain to reconstruct it rather than coast.
        </div>
      </div>
    </div>
  );
}
