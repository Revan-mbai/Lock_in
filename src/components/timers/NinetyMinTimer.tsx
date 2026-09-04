import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Sparkles, Activity, Moon, Sun } from 'lucide-react';
import { formatTimeWithHours } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';

interface NinetyMinTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

export function NinetyMinTimer({ onSessionComplete, soundEnabled }: NinetyMinTimerProps) {
  const WORK_SECONDS = 90 * 60; // 90 mins = 5400s
  const BREAK_SECONDS = 20 * 60; // 20 mins = 1200s

  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(WORK_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [taskSubject, setTaskSubject] = useState('');
  const [autoStartNext, setAutoStartNext] = useState(true);
  const [transitionNotification, setTransitionNotification] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalPhaseSeconds = phase === 'work' ? WORK_SECONDS : BREAK_SECONDS;
  const progressPercent = Math.min(100, Math.max(0, ((totalPhaseSeconds - timeLeft) / totalPhaseSeconds) * 100));

  // Determine current ultradian stage during 90m work
  const elapsedWorkMinutes = (WORK_SECONDS - timeLeft) / 60;
  let ultradianStage = 'Acclimatization & Warm-up (0 - 15m)';
  if (phase === 'work') {
    if (elapsedWorkMinutes >= 75) {
      ultradianStage = 'Consolidation & Winding Down (75 - 90m)';
    } else if (elapsedWorkMinutes >= 15) {
      ultradianStage = 'Peak Cognitive Velocity (15 - 75m)';
    }
  } else {
    ultradianStage = 'Deep Glycogen Replenishment & Rest';
  }

  const handlePhaseTransition = (fromPhase: 'work' | 'break') => {
    if (fromPhase === 'work') {
      onSessionComplete({
        methodId: 'ninety-min',
        methodName: '90-Minute Work Cycle',
        taskTitle: taskSubject.trim() || '90-Min Ultradian Block',
        durationMinutes: 90,
        phase: 'work',
      });

      if (soundEnabled) playFocusCompleteChime();

      setPhase('break');
      setTimeLeft(BREAK_SECONDS);
      setTransitionNotification(
        '90-Minute cycle finished! Shifting automatically into your 20-minute restorative break.'
      );

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    } else {
      if (soundEnabled) playBreakCompleteChime();

      setPhase('work');
      setTimeLeft(WORK_SECONDS);
      setTransitionNotification('20-minute recovery complete! Energy restored for the next ultradian cycle.');

      if (autoStartNext) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
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
  }, [isRunning, phase, autoStartNext]);

  const handleStartPause = () => setIsRunning(!isRunning);

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(phase === 'work' ? WORK_SECONDS : BREAK_SECONDS);
  };

  const handleSkipPhase = () => handlePhaseTransition(phase);

  return (
    <div id="ninety-min-timer-container" className="max-w-2xl mx-auto space-y-6">
      {transitionNotification && (
        <div 
          id="ninety-min-transition-alert"
          className="p-4 rounded-xl bg-[#EFECE6] border border-[#DDD7CD] text-[#2C2926] text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#7C6F5A] shrink-0" />
            <span className="font-medium">{transitionNotification}</span>
          </div>
          <button 
            id="dismiss-ninety-min-alert"
            onClick={() => setTransitionNotification(null)}
            className="text-xs text-[#78716C] hover:text-[#292524] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
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
                ? 'bg-[#2B2724] text-[#FAF8F5]'
                : 'text-[#78716C] hover:text-[#292524] bg-[#F7F5F0]'
            }`}
          >
            Deep Cycle (90 min)
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
                ? 'bg-[#7C6F5A] text-[#FAF8F5]'
                : 'text-[#78716C] hover:text-[#292524] bg-[#F7F5F0]'
            }`}
          >
            Restorative Break (20 min)
          </button>
        </div>

        {/* Task Focus Input */}
        <div className="max-w-md mx-auto mb-8">
          <label htmlFor="ninety-task-input" className="block text-center text-xs tracking-wider uppercase text-[#78716C] mb-2 font-medium">
            {phase === 'work' ? '90-Minute Deep Work Goal' : 'Unplugged Rest Period'}
          </label>
          {phase === 'work' ? (
            <input
              id="ninety-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g., Drafting Chapter 2 of Senior Thesis..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-[#E7E3DC] bg-[#FAF8F5] text-sm text-[#292524] placeholder-[#A8A29E] focus:outline-none focus:border-[#7C6F5A] transition-colors"
            />
          ) : (
            <p className="text-center text-sm font-serif italic text-[#7C6F5A]">
              Walk outside, stretch, lie down, or breathe deeply. Zero digital inputs recommended.
            </p>
          )}
        </div>

        {/* Countdown Ring */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="#F0ECE4" strokeWidth="4" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={phase === 'work' ? '#7C6F5A' : '#58705C'}
                strokeWidth="4"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span id="ninety-min-digits" className="font-mono text-4xl sm:text-5xl font-semibold tracking-tight text-[#1C1917]">
                {formatTimeWithHours(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-2">
                {phase === 'work' ? 'Ultradian Focus' : 'Cellular Renewal'}
              </span>
              <span className="text-[11px] text-[#A8A29E] mt-1">
                {autoStartNext ? 'Auto-shifts into 20m break' : 'Manual shift'}
              </span>
            </div>
          </div>
        </div>

        {/* Ultradian Stage Tracker */}
        {phase === 'work' && (
          <div className="max-w-md mx-auto my-4 p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] text-xs">
            <div className="flex items-center justify-between text-[#78716C] mb-1.5">
              <span className="flex items-center gap-1.5 font-medium text-[#292524]">
                <Activity className="w-3.5 h-3.5 text-[#7C6F5A]" />
                Current Biological Phase:
              </span>
              <span className="font-mono">{Math.floor(elapsedWorkMinutes)} / 90 min</span>
            </div>
            <div className="font-medium text-[#7C6F5A]">{ultradianStage}</div>
            {/* 3-segment progress meter */}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <div className={`h-1.5 rounded-full ${elapsedWorkMinutes > 0 ? 'bg-[#7C6F5A]' : 'bg-[#E7E3DC]'}`} />
              <div className={`h-1.5 rounded-full ${elapsedWorkMinutes >= 15 ? 'bg-[#7C6F5A]' : 'bg-[#E7E3DC]'}`} />
              <div className={`h-1.5 rounded-full ${elapsedWorkMinutes >= 75 ? 'bg-[#7C6F5A]' : 'bg-[#E7E3DC]'}`} />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            id="ninety-min-reset-btn"
            onClick={handleReset}
            title="Reset timer"
            className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="ninety-min-start-pause-btn"
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
                <span>{timeLeft < totalPhaseSeconds ? 'Resume' : 'Start 90-Min Cycle'}</span>
              </>
            )}
          </button>

          <button
            id="ninety-min-skip-btn"
            onClick={handleSkipPhase}
            title="Skip to next phase"
            className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Footer controls */}
        <div className="mt-10 pt-6 border-t border-[#F0ECE4] flex items-center justify-between text-xs text-[#78716C]">
          <div className="flex items-center gap-1.5">
            {phase === 'work' ? <Sun className="w-4 h-4 text-[#7C6F5A]" /> : <Moon className="w-4 h-4 text-[#58705C]" />}
            <span>{phase === 'work' ? '90m Focus Sprint' : '20m Biological Rest'}</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="ninety-min-auto-shift-toggle"
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-[#7C6F5A]"
            />
            <span>Auto-shift into break</span>
          </label>
        </div>
      </div>

      {/* Science card */}
      <div className="bg-[#FAF8F5] border border-[#E7E3DC] rounded-xl p-4 text-xs text-[#57534E] flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-[#EFECE6] text-[#7C6F5A] shrink-0 mt-0.5">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-[#292524]">The Ultradian Rhythm: </span>
          Our alertness naturally surges and dips in 90-minute waves. By stopping at 90 minutes before mental exhaustion sets in, you protect neural stamina and avoid the burnout slump of 4-hour non-stop cramming.
        </div>
      </div>
    </div>
  );
}
