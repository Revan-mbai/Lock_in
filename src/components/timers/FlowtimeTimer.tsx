import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Coffee, RotateCcw, Sparkles, Brain, Clock, ArrowRight } from 'lucide-react';
import { formatTime, calculateFlowtimeBreakMinutes } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';

interface FlowtimeTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

export function FlowtimeTimer({ onSessionComplete, soundEnabled }: FlowtimeTimerProps) {
  // Mode: 'flow' (counting up) or 'break' (counting down)
  const [mode, setMode] = useState<'flow' | 'break'>('flow');
  const [elapsedFlowSeconds, setElapsedFlowSeconds] = useState(0);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [breakInitialSeconds, setBreakInitialSeconds] = useState(0);
  const [isFlowing, setIsFlowing] = useState(false);
  const [isBreakRunning, setIsBreakRunning] = useState(false);

  const [taskSubject, setTaskSubject] = useState('');
  const [sessionRecords, setSessionRecords] = useState<{ id: string; minutes: number; breakMins: number; timestamp: string }[]>([]);
  const [transitionNotification, setTransitionNotification] = useState<string | null>(null);

  const flowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentRecommendedBreak = calculateFlowtimeBreakMinutes(elapsedFlowSeconds);

  // Flow Stopwatch Effect (count up)
  useEffect(() => {
    if (mode === 'flow' && isFlowing) {
      flowTimerRef.current = setInterval(() => {
        setElapsedFlowSeconds((prev) => prev + 1);
      }, 1000);
    } else if (flowTimerRef.current) {
      clearInterval(flowTimerRef.current);
    }

    return () => {
      if (flowTimerRef.current) clearInterval(flowTimerRef.current);
    };
  }, [mode, isFlowing]);

  // Break Countdown Effect (count down)
  useEffect(() => {
    if (mode === 'break' && isBreakRunning) {
      breakTimerRef.current = setInterval(() => {
        setBreakTimeLeft((prev) => {
          if (prev <= 1) {
            // Break completed
            if (soundEnabled) playBreakCompleteChime();
            setIsBreakRunning(false);
            setMode('flow');
            setElapsedFlowSeconds(0);
            setTransitionNotification('Break completed! Your mind is recharged and ready for the next flow block.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
    }

    return () => {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, [mode, isBreakRunning, soundEnabled]);

  // When user feels fatigue or reaches natural stop in flow:
  const handleTriggerBreak = () => {
    const focusedMinutes = Math.max(1, Math.round(elapsedFlowSeconds / 60));
    const breakMinutes = calculateFlowtimeBreakMinutes(elapsedFlowSeconds);
    const breakSeconds = breakMinutes * 60;

    // Save session
    onSessionComplete({
      methodId: 'flowtime',
      methodName: 'Flowtime Technique',
      taskTitle: taskSubject.trim() || 'Uninterrupted Flow Session',
      durationMinutes: focusedMinutes,
      phase: 'work',
    });

    setSessionRecords((prev) => [
      {
        id: Math.random().toString(),
        minutes: focusedMinutes,
        breakMins: breakMinutes,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 4),
    ]);

    if (soundEnabled) playFocusCompleteChime();

    // Transition to break timer automatically
    setMode('break');
    setIsFlowing(false);
    setBreakInitialSeconds(breakSeconds);
    setBreakTimeLeft(breakSeconds);
    setIsBreakRunning(true);

    setTransitionNotification(
      `Flow session of ${focusedMinutes} min complete! Automatically starting your calculated ${breakMinutes}-min break.`
    );

    setTimeout(() => {
      setTransitionNotification(null);
    }, 7000);
  };

  const handleResetFlow = () => {
    setIsFlowing(false);
    setElapsedFlowSeconds(0);
  };

  const handleSkipBreak = () => {
    setIsBreakRunning(false);
    setMode('flow');
    setElapsedFlowSeconds(0);
    setBreakTimeLeft(0);
  };

  const breakProgressPercent = breakInitialSeconds > 0 
    ? Math.min(100, Math.max(0, ((breakInitialSeconds - breakTimeLeft) / breakInitialSeconds) * 100))
    : 0;

  return (
    <div id="flowtime-timer-container" className="max-w-2xl mx-auto space-y-6">
      {transitionNotification && (
        <div 
          id="flowtime-transition-alert"
          className="p-4 rounded-xl bg-[#EFECE6] border border-[#DDD7CD] text-[#2C2926] text-sm flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#58705C] shrink-0" />
            <span className="font-medium">{transitionNotification}</span>
          </div>
          <button 
            id="dismiss-flowtime-alert"
            onClick={() => setTransitionNotification(null)}
            className="text-xs text-[#78716C] hover:text-[#292524] underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Flowtime Card */}
      <div className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        {/* Status Mode Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#F5F2EB] text-[#44403C] border border-[#E5E0D6]">
            {mode === 'flow' ? (
              <>
                <Brain className="w-3.5 h-3.5 text-[#58705C]" />
                <span>Stopwatch Mode: Flow State Tracking</span>
              </>
            ) : (
              <>
                <Coffee className="w-3.5 h-3.5 text-[#B45309]" />
                <span>Restorative Break Countdown</span>
              </>
            )}
          </div>
        </div>

        {/* Task Focus Input */}
        <div className="max-w-md mx-auto mb-8">
          <label htmlFor="flowtime-task-input" className="block text-center text-xs tracking-wider uppercase text-[#78716C] mb-2 font-medium">
            {mode === 'flow' ? 'Deep Work Objective' : 'Break Recovery'}
          </label>
          {mode === 'flow' ? (
            <input
              id="flowtime-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g., Working through Linear Algebra proof..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-[#E7E3DC] bg-[#FAF8F5] text-sm text-[#292524] placeholder-[#A8A29E] focus:outline-none focus:border-[#58705C] transition-colors"
            />
          ) : (
            <p className="text-center text-sm font-serif italic text-[#58705C]">
              Step completely away from your desk. Let your brain consolidate the session.
            </p>
          )}
        </div>

        {/* Stopwatch or Break Countdown */}
        {mode === 'flow' ? (
          <div className="flex flex-col items-center justify-center my-6">
            <div className="font-mono text-5xl sm:text-6xl font-semibold tracking-tight text-[#1C1917]">
              {formatTime(elapsedFlowSeconds)}
            </div>
            <div className="text-xs font-medium uppercase tracking-widest text-[#78716C] mt-3">
              {isFlowing ? 'Flowing &bull; Count-Up Active' : 'Ready to Immerse'}
            </div>

            {/* Live Break Calculation Card */}
            <div className="mt-6 px-4 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] flex items-center gap-3 text-xs text-[#57534E]">
              <Clock className="w-4 h-4 text-[#58705C]" />
              <span>
                Earned Rest: <strong className="text-[#292524] font-semibold">{currentRecommendedBreak} minutes</strong> break recommended if you stop now
              </span>
            </div>
          </div>
        ) : (
          /* Break Countdown Visual */
          <div className="flex flex-col items-center justify-center my-6">
            <div className="relative w-60 h-60 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" stroke="#F0ECE4" strokeWidth="4" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="#58705C"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray={276.46}
                  strokeDashoffset={276.46 - (276.46 * breakProgressPercent) / 100}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span id="flowtime-break-digits" className="font-mono text-5xl font-semibold text-[#1C1917]">
                  {formatTime(breakTimeLeft)}
                </span>
                <span className="text-xs font-medium uppercase tracking-widest text-[#58705C] mt-2">
                  Break In Progress
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 mt-8">
          {mode === 'flow' ? (
            <>
              <button
                id="flowtime-reset-btn"
                onClick={handleResetFlow}
                title="Reset stopwatch"
                className="p-3 rounded-full border border-[#E7E3DC] text-[#78716C] hover:text-[#292524] hover:bg-[#F7F5F0] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                id="flowtime-start-pause-btn"
                onClick={() => setIsFlowing(!isFlowing)}
                className={`px-8 py-3.5 rounded-full font-medium text-sm flex items-center gap-2.5 transition-all shadow-xs ${
                  isFlowing
                    ? 'bg-[#EFECE6] text-[#292524] hover:bg-[#E5E0D8]'
                    : 'bg-[#1C1917] text-[#FAF8F5] hover:bg-[#2E2A27]'
                }`}
              >
                {isFlowing ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause Flow</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>{elapsedFlowSeconds > 0 ? 'Resume Flow' : 'Enter Flow State'}</span>
                  </>
                )}
              </button>

              {/* Transition to break button */}
              {elapsedFlowSeconds >= 60 && (
                <button
                  id="flowtime-take-break-btn"
                  onClick={handleTriggerBreak}
                  className="px-5 py-3 rounded-full bg-[#58705C] text-[#FAF8F5] hover:bg-[#475C4B] font-medium text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs"
                >
                  <Coffee className="w-4 h-4" />
                  <span>Take {currentRecommendedBreak}m Break</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                id="flowtime-break-pause-btn"
                onClick={() => setIsBreakRunning(!isBreakRunning)}
                className="px-6 py-3 rounded-full border border-[#E7E3DC] text-xs font-medium text-[#292524] hover:bg-[#F7F5F0] transition-colors"
              >
                {isBreakRunning ? 'Pause Break' : 'Resume Break'}
              </button>
              <button
                id="flowtime-skip-break-btn"
                onClick={handleSkipBreak}
                className="px-6 py-3 rounded-full bg-[#1C1917] text-[#FAF8F5] text-xs font-medium hover:bg-[#2E2A27] flex items-center gap-2 transition-colors"
              >
                <span>End Break & Refocus</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Science Breakdown Scale */}
        <div className="mt-10 pt-6 border-t border-[#F0ECE4]">
          <div className="text-xs text-[#78716C] mb-2 font-medium">Flowtime Rest Duration Formula:</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className={`p-2.5 rounded-lg border ${elapsedFlowSeconds < 20 * 60 ? 'border-[#58705C] bg-[#F4F6F4]' : 'border-[#E7E3DC] bg-[#FAF8F5]'}`}>
              <div className="font-medium text-[#292524]">&lt; 20 min flow</div>
              <div className="text-[#58705C] font-semibold">5 min break</div>
            </div>
            <div className={`p-2.5 rounded-lg border ${elapsedFlowSeconds >= 20 * 60 && elapsedFlowSeconds < 45 * 60 ? 'border-[#58705C] bg-[#F4F6F4]' : 'border-[#E7E3DC] bg-[#FAF8F5]'}`}>
              <div className="font-medium text-[#292524]">20 – 45 min flow</div>
              <div className="text-[#58705C] font-semibold">8 min break</div>
            </div>
            <div className={`p-2.5 rounded-lg border ${elapsedFlowSeconds >= 45 * 60 && elapsedFlowSeconds < 75 * 60 ? 'border-[#58705C] bg-[#F4F6F4]' : 'border-[#E7E3DC] bg-[#FAF8F5]'}`}>
              <div className="font-medium text-[#292524]">45 – 75 min flow</div>
              <div className="text-[#58705C] font-semibold">10 min break</div>
            </div>
            <div className={`p-2.5 rounded-lg border ${elapsedFlowSeconds >= 75 * 60 ? 'border-[#58705C] bg-[#F4F6F4]' : 'border-[#E7E3DC] bg-[#FAF8F5]'}`}>
              <div className="font-medium text-[#292524]">75+ min flow</div>
              <div className="text-[#58705C] font-semibold">15 min break</div>
            </div>
          </div>
        </div>

        {/* Recent Flow Sessions Today */}
        {sessionRecords.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#F0ECE4] text-xs">
            <div className="font-medium text-[#44403C] mb-2">Today's Flow Log:</div>
            <div className="space-y-1.5">
              {sessionRecords.map((rec) => (
                <div key={rec.id} className="flex justify-between items-center py-1 px-2.5 rounded bg-[#FAF8F5] text-[#57534E]">
                  <span>{rec.timestamp} &bull; Flow block</span>
                  <span className="font-mono text-[#292524] font-medium">{rec.minutes} mins focused &rarr; {rec.breakMins}m break</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Guide Note */}
      <div className="bg-[#FAF8F5] border border-[#E7E3DC] rounded-xl p-4 text-xs text-[#57534E] flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-[#EFECE6] text-[#58705C] shrink-0 mt-0.5">
          <Brain className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-[#292524]">Flowtime Philosophy: </span>
          When your mind is in genuine flow, timer alarms disrupt high-level neural synthesis. Work until you feel the first symptoms of distraction or restlessness, then reward yourself with the exact break your mind needs.
        </div>
      </div>
    </div>
  );
}
