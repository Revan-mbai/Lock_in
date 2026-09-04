import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Sparkles, Compass, ShieldCheck, Footprints } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';

interface FiftyTwoSeventeenTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

export function FiftyTwoSeventeenTimer({ onSessionComplete, soundEnabled }: FiftyTwoSeventeenTimerProps) {
  const WORK_SECONDS = 52 * 60; // 3120s
  const BREAK_SECONDS = 17 * 60; // 1020s

  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(WORK_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [taskSubject, setTaskSubject] = useState('');
  const [autoStartNext, setAutoStartNext] = useState(true);
  const [transitionNotification, setTransitionNotification] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalPhaseSeconds = phase === 'work' ? WORK_SECONDS : BREAK_SECONDS;
  const progressPercent = Math.min(100, Math.max(0, ((totalPhaseSeconds - timeLeft) / totalPhaseSeconds) * 100));

  const handlePhaseTransition = (fromPhase: 'work' | 'break') => {
    if (fromPhase === 'work') {
      onSessionComplete({
        methodId: 'fifty-two-seventeen',
        methodName: 'The 52/17 Rule',
        taskTitle: taskSubject.trim() || '52-Minute Sprint',
        durationMinutes: 52,
        phase: 'work',
      });

      if (soundEnabled) playFocusCompleteChime();

      setPhase('break');
      setTimeLeft(BREAK_SECONDS);
      setTransitionNotification(
        '52-minute sprint completed! Automatically starting your 17-minute unplugged break.'
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
      setTransitionNotification('17-minute unplugged rest over. Refocused and starting your next 52-minute sprint.');

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
    <div id="fifty-two-seventeen-timer-container" className="max-w-2xl mx-auto space-y-6">
      {transitionNotification && (
        <div 
          id="fifty-two-transition-alert"
          className="p-4 rounded-xl bg-[#EFECE6] border border-[#DDD7CD] text-[#2C2926] text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#4A6B82] shrink-0" />
            <span className="font-medium">{transitionNotification}</span>
          </div>
          <button 
            id="dismiss-fifty-two-alert"
            onClick={() => setTransitionNotification(null)}
            className="text-xs text-[#78716C] hover:text-[#292524] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Timer Card */}
      <div className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
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
                ? 'bg-[#2B2724] text-[#FAF8F5]'
                : 'text-[#78716C] hover:text-[#292524] bg-[#F7F5F0]'
            }`}
          >
            Sprint Focus (52 min)
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
                ? 'bg-[#4A6B82] text-[#FAF8F5]'
                : 'text-[#78716C] hover:text-[#292524] bg-[#F7F5F0]'
            }`}
          >
            Disconnected Break (17 min)
          </button>
        </div>

        {/* Task Focus Input */}
        <div className="max-w-md mx-auto mb-8">
          <label htmlFor="fifty-two-task-input" className="block text-center text-xs tracking-wider uppercase text-[#78716C] mb-2 font-medium">
            {phase === 'work' ? 'Sprint Objective' : 'Recovery Protocol'}
          </label>
          {phase === 'work' ? (
            <input
              id="fifty-two-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g., Drafting research synthesis notes..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-[#E7E3DC] bg-[#FAF8F5] text-sm text-[#292524] placeholder-[#A8A29E] focus:outline-none focus:border-[#4A6B82] transition-colors"
            />
          ) : (
            <div className="text-center text-sm font-serif italic text-[#4A6B82] flex items-center justify-center gap-1.5">
              <Footprints className="w-4 h-4" />
              <span>Unplug completely: Leave the desk &bull; No phone &bull; Sunlight or light stretch</span>
            </div>
          )}
        </div>

        {/* Circular Progress Display */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" stroke="#F0ECE4" strokeWidth="4" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={phase === 'work' ? '#4A6B82' : '#58705C'}
                strokeWidth="4"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={276.46}
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span id="fifty-two-digits" className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-[#1C1917]">
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-2">
                {phase === 'work' ? '52m Sprint Intensity' : '17m Real Rest'}
              </span>
              <span className="text-[11px] text-[#A8A29E] mt-1">
                {autoStartNext ? 'Auto-shifts into 17m break' : 'Manual shift'}
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
            className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="fifty-two-start-pause-btn"
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
                <span>{timeLeft < totalPhaseSeconds ? 'Resume' : 'Start 52m Sprint'}</span>
              </>
            )}
          </button>

          <button
            id="fifty-two-skip-btn"
            onClick={handleSkipPhase}
            title="Skip to next phase"
            className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Footer info & Auto-shift toggle */}
        <div className="mt-10 pt-6 border-t border-[#F0ECE4] flex items-center justify-between text-xs text-[#78716C]">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-[#4A6B82]" />
            <span>Ratio: 75% Deep Focus / 25% Disconnected Rest</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="fifty-two-auto-shift-toggle"
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-[#4A6B82]"
            />
            <span>Auto-shift into break</span>
          </label>
        </div>
      </div>

      {/* Science card */}
      <div className="bg-[#FAF8F5] border border-[#E7E3DC] rounded-xl p-4 text-xs text-[#57534E] flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-[#EFECE6] text-[#4A6B82] shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-[#292524]">The DeskTime Finding: </span>
          The key reason the 52/17 ratio outperforms longer sessions is the strict detachment: 17 minutes without notifications or screen glare is the exact sweet spot that resets dopamine and mental sharpness without inducing the grogginess of longer naps.
        </div>
      </div>
    </div>
  );
}
