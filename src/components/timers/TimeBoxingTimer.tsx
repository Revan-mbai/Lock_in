import { useState, useEffect, useRef, FormEvent } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Plus, Trash2, CheckCircle, Clock, Coffee, BookOpen, Sparkles } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { TimeBoxItem, FocusSessionLog } from '../../types';

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
  const [boxes, setBoxes] = useState<TimeBoxItem[]>(DEFAULT_BOXES);
  const [activeBoxIndex, setActiveBoxIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_BOXES[0].durationMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [autoShiftNext, setAutoShiftNext] = useState(true);

  // New box form modal / inline
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newIsBreak, setNewIsBreak] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [transitionNotification, setTransitionNotification] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeBox = boxes[activeBoxIndex] || boxes[0];
  const activeBoxTotalSeconds = activeBox ? activeBox.durationMinutes * 60 : 1800;
  const progressPercent = Math.min(100, Math.max(0, ((activeBoxTotalSeconds - timeLeft) / activeBoxTotalSeconds) * 100));

  // Advance to next box
  const handleBoxComplete = (indexCompleted: number) => {
    const completedItem = boxes[indexCompleted];

    // Mark as completed
    const updatedBoxes = boxes.map((b, idx) => 
      idx === indexCompleted ? { ...b, completed: true } : b
    );
    setBoxes(updatedBoxes);

    if (completedItem && !completedItem.isBreak) {
      onSessionComplete({
        methodId: 'time-boxing',
        methodName: 'Time Boxing',
        taskTitle: completedItem.title,
        durationMinutes: completedItem.durationMinutes,
        phase: 'work',
      });
      if (soundEnabled) playFocusCompleteChime();
    } else {
      if (soundEnabled) playBreakCompleteChime();
    }

    // Check if there is a next box
    const nextIndex = indexCompleted + 1;
    if (nextIndex < boxes.length) {
      const nextBox = boxes[nextIndex];
      setActiveBoxIndex(nextIndex);
      setTimeLeft(nextBox.durationMinutes * 60);

      setTransitionNotification(
        `"${completedItem.title}" completed! Automatically shifting into "${nextBox.title}" (${nextBox.durationMinutes}m).`
      );

      if (autoShiftNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    } else {
      // All boxes finished!
      setIsRunning(false);
      setTransitionNotification('All scheduled study boxes for this session are complete! Exceptional focus.');
    }

    setTimeout(() => {
      setTransitionNotification(null);
    }, 7000);
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleBoxComplete(activeBoxIndex);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, activeBoxIndex, boxes, autoShiftNext]);

  const handleSelectBox = (index: number) => {
    setActiveBoxIndex(index);
    setTimeLeft(boxes[index].durationMinutes * 60);
    setIsRunning(false);
  };

  const handleStartPause = () => setIsRunning(!isRunning);

  const handleReset = () => {
    setIsRunning(false);
    if (activeBox) {
      setTimeLeft(activeBox.durationMinutes * 60);
    }
  };

  const handleSkip = () => {
    handleBoxComplete(activeBoxIndex);
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
    setBoxes(filtered);
    if (index === activeBoxIndex) {
      setActiveBoxIndex(0);
      setTimeLeft(filtered[0].durationMinutes * 60);
      setIsRunning(false);
    } else if (index < activeBoxIndex) {
      setActiveBoxIndex(activeBoxIndex - 1);
    }
  };

  const totalStudyMinutes = boxes.filter(b => !b.isBreak).reduce((sum, b) => sum + b.durationMinutes, 0);
  const totalBreakMinutes = boxes.filter(b => b.isBreak).reduce((sum, b) => sum + b.durationMinutes, 0);

  return (
    <div id="time-boxing-timer-container" className="max-w-2xl mx-auto space-y-6">
      {transitionNotification && (
        <div 
          id="timebox-transition-alert"
          className="p-4 rounded-xl bg-[#EFECE6] border border-[#DDD7CD] text-[#2C2926] text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#B45309] shrink-0" />
            <span className="font-medium">{transitionNotification}</span>
          </div>
          <button 
            id="dismiss-timebox-alert"
            onClick={() => setTransitionNotification(null)}
            className="text-xs text-[#78716C] hover:text-[#292524] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Box Card */}
      <div className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        {/* Active Box Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#FAF8F5] text-[#78716C] border border-[#E7E3DC] mb-2">
            <span>Box {activeBoxIndex + 1} of {boxes.length}</span>
            <span>&bull;</span>
            <span className={activeBox?.isBreak ? 'text-[#58705C] font-semibold' : 'text-[#B45309] font-semibold'}>
              {activeBox?.isBreak ? 'Break Buffer' : 'Focus Task'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-medium text-[#1C1917]">
            {activeBox?.title || 'Study Block'}
          </h2>
        </div>

        {/* Circular Ring */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="#F0ECE4" strokeWidth="4" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={activeBox?.isBreak ? '#58705C' : '#B45309'}
                strokeWidth="4"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span id="timebox-timer-digits" className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-[#1C1917]">
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-2">
                {activeBox?.isBreak ? 'Break Window' : 'Boxed Focus'}
              </span>
              <span className="text-[11px] text-[#A8A29E] mt-1">
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
            title="Reset active box timer"
            className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="timebox-start-pause-btn"
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
                <span>Pause Box</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>{timeLeft < activeBoxTotalSeconds ? 'Resume' : 'Start Active Box'}</span>
              </>
            )}
          </button>

          <button
            id="timebox-skip-btn"
            onClick={handleSkip}
            title="Complete & shift to next box"
            className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Auto shift toggle */}
        <div className="mt-8 pt-4 border-t border-[#F0ECE4] flex items-center justify-between text-xs text-[#78716C]">
          <div className="flex items-center gap-2">
            <span>Session: <strong className="text-[#292524]">{totalStudyMinutes}m study</strong> + {totalBreakMinutes}m breaks</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="timebox-auto-shift-toggle"
              type="checkbox"
              checked={autoShiftNext}
              onChange={(e) => setAutoShiftNext(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-[#B45309]"
            />
            <span>Auto-shift to next box</span>
          </label>
        </div>
      </div>

      {/* Schedule / Time Boxes List Card */}
      <div className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1C1917]">Scheduled Time Boxes</h3>
            <p className="text-xs text-[#78716C]">Click any box to switch active timer or add new study blocks</p>
          </div>
          <button
            id="timebox-add-toggle-btn"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 rounded-lg border border-[#E7E3DC] text-xs font-medium text-[#292524] hover:bg-[#FAF8F5] flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Box</span>
          </button>
        </div>

        {/* Add Box Form */}
        {showAddForm && (
          <form onSubmit={handleAddBox} className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] space-y-3 text-xs">
            <div className="font-medium text-[#292524]">Create New Time Box</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Subject or activity name..."
                required
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-[#E7E3DC] bg-white text-xs focus:outline-none focus:border-[#B45309]"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-20 px-3 py-2 rounded-lg border border-[#E7E3DC] bg-white text-xs text-center focus:outline-none focus:border-[#B45309]"
                />
                <span className="text-[#78716C]">mins</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[#57534E]">
                <input
                  type="checkbox"
                  checked={newIsBreak}
                  onChange={(e) => setNewIsBreak(e.target.checked)}
                  className="rounded accent-[#58705C]"
                />
                <span>This box is a break / buffer</span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#78716C] hover:text-[#292524]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#1C1917] text-[#FAF8F5] text-xs font-medium hover:bg-[#2E2A27]"
                >
                  Add to Schedule
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
                    ? 'border-[#B45309] bg-[#FFFBF7] shadow-xs'
                    : box.completed
                      ? 'border-[#E7E3DC] bg-[#F7F5F0] opacity-75'
                      : 'border-[#E7E3DC] bg-[#FAF8F5] hover:border-[#D4CEBF]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md ${
                    box.completed 
                      ? 'text-[#58705C] bg-[#EAF0EB]' 
                      : box.isBreak 
                        ? 'text-[#58705C] bg-[#F0F3F0]' 
                        : 'text-[#B45309] bg-[#FBF2E9]'
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
                      <span className={`text-xs font-medium ${box.completed ? 'line-through text-[#78716C]' : 'text-[#1C1917]'}`}>
                        {box.title}
                      </span>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#B45309] text-white font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#78716C] flex items-center gap-2">
                      <span>{box.durationMinutes} min</span>
                      <span>&bull;</span>
                      <span>{box.isBreak ? 'Rest' : 'Study block'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {boxes.length > 1 && (
                    <button
                      onClick={() => handleDeleteBox(box.id, index)}
                      title="Delete box"
                      className="p-1.5 text-[#A8A29E] hover:text-[#DC2626] rounded transition-colors"
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
