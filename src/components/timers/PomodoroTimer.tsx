import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, CheckCircle2, Volume2, Sparkles, Settings2 } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';

interface PomodoroTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

export function PomodoroTimer({ onSessionComplete, soundEnabled }: PomodoroTimerProps) {
  // Preset durations (in minutes)
  const [workDuration, setWorkDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [cyclesBeforeLongBreak, setCyclesBeforeLongBreak] = useState(4);

  const [phase, setPhase] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [taskSubject, setTaskSubject] = useState('');
  const [autoStartNext, setAutoStartNext] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [transitionNotification, setTransitionNotification] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Total duration of current phase in seconds
  const totalPhaseSeconds = phase === 'work' 
    ? workDuration * 60 
    : phase === 'shortBreak' 
      ? shortBreakDuration * 60 
      : longBreakDuration * 60;

  const progressPercent = Math.min(100, Math.max(0, ((totalPhaseSeconds - timeLeft) / totalPhaseSeconds) * 100));

  // Switch phase logic
  const handlePhaseTransition = (fromPhase: 'work' | 'shortBreak' | 'longBreak') => {
    if (fromPhase === 'work') {
      const newCycles = completedCycles + 1;
      setCompletedCycles(newCycles);

      onSessionComplete({
        methodId: 'pomodoro',
        methodName: 'Pomodoro Technique',
        taskTitle: taskSubject.trim() || 'Deep Study Session',
        durationMinutes: workDuration,
        phase: 'work',
      });

      if (soundEnabled) playFocusCompleteChime();

      const nextIsLongBreak = newCycles % cyclesBeforeLongBreak === 0;
      const nextPhase = nextIsLongBreak ? 'longBreak' : 'shortBreak';
      const nextDuration = nextIsLongBreak ? longBreakDuration : shortBreakDuration;

      setPhase(nextPhase);
      setTimeLeft(nextDuration * 60);
      setTransitionNotification(
        nextIsLongBreak
          ? `4 cycles reached! Starting ${longBreakDuration}-min restorative long break.`
          : `Work sprint complete! Shifting directly into ${shortBreakDuration}-min break.`
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
      setTransitionNotification('Break over. Refocused and starting your next 25-min study sprint.');

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    }

    setTimeout(() => {
      setTransitionNotification(null);
    }, 6000);
  };

  // Main countdown effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handlePhaseTransition(phase);
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
  }, [isRunning, phase, completedCycles, workDuration, shortBreakDuration, longBreakDuration, autoStartNext]);

  const handleStartPause = () => {
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
    handlePhaseTransition(phase);
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
            Study Focus ({workDuration}m)
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
            Short Break ({shortBreakDuration}m)
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
            {phase === 'work' ? 'Current Focus Intention' : 'Resting State'}
          </label>
          {phase === 'work' ? (
            <input
              id="pomodoro-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g., Organic chemistry chapter 4 problem set..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-[#E7E3DC] bg-[#FAF8F5] text-sm text-[#292524] placeholder-[#A8A29E] focus:outline-none focus:border-[#C86D51] transition-colors"
            />
          ) : (
            <div className="text-center text-sm font-serif italic text-[#58705C]">
              Step away from screen &bull; Stretch shoulders &bull; Hydrate &bull; Deep breaths
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
                {phase === 'work' ? 'Deep Work' : phase === 'shortBreak' ? 'Short Recovery' : 'Extended Rest'}
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
                <span>{timeLeft < totalPhaseSeconds ? 'Resume' : 'Start Focus'}</span>
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
            <span className="text-[#A8A29E] ml-1">({completedCycles} finished)</span>
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
              <span>Auto-shift into break</span>
            </label>

            <button
              id="pomodoro-settings-toggle"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1 hover:text-[#292524] transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Intervals</span>
            </button>
          </div>
        </div>

        {/* Interval Settings Collapsible */}
        {showSettings && (
          <div id="pomodoro-settings-panel" className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] text-xs space-y-3">
            <p className="font-medium text-[#292524]">Select Interval Preset or Custom Time:</p>
            <div className="flex flex-wrap gap-2">
              <button
                id="preset-25-5-btn"
                onClick={() => handleApplyPreset(25, 5)}
                className={`px-3 py-1.5 rounded-lg border ${
                  workDuration === 25 ? 'border-[#C86D51] bg-[#FAF3F0] text-[#C86D51] font-semibold' : 'border-[#E7E3DC] bg-white'
                }`}
              >
                Standard (25m / 5m)
              </button>
              <button
                id="preset-50-10-btn"
                onClick={() => handleApplyPreset(50, 10)}
                className={`px-3 py-1.5 rounded-lg border ${
                  workDuration === 50 ? 'border-[#C86D51] bg-[#FAF3F0] text-[#C86D51] font-semibold' : 'border-[#E7E3DC] bg-white'
                }`}
              >
                Extended (50m / 10m)
              </button>
              <button
                id="preset-15-3-btn"
                onClick={() => handleApplyPreset(15, 3)}
                className={`px-3 py-1.5 rounded-lg border ${
                  workDuration === 15 ? 'border-[#C86D51] bg-[#FAF3F0] text-[#C86D51] font-semibold' : 'border-[#E7E3DC] bg-white'
                }`}
              >
                Micro Sprint (15m / 3m)
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
          <span className="font-semibold text-[#292524]">Pomodoro Best Practice: </span>
          When the study timer hits 0, don't check social media or stay in your chair. Look out a window at least 20 feet away to relax your ciliary eye muscles, and stretch your spine.
        </div>
      </div>
    </div>
  );
}
