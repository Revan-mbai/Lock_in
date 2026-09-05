import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Coffee, RotateCcw, Sparkles, Brain, Clock, ArrowRight } from 'lucide-react';
import { formatTime, calculateFlowtimeBreakMinutes } from '../../utils/formatters';
import { playFocusCompleteChime, playBreakCompleteChime } from '../../utils/audio';
import { FocusSessionLog } from '../../types';
import { loadFlowtimeState, saveFlowtimeState, MAX_LIVE_GAP_SECONDS, MAX_FLOW_GAP_SECONDS } from '../../utils/timerPersistence';

// Kept in lockstep with calculateFlowtimeBreakMinutes in ../../utils/formatters.
const REST_TIERS: { label: string; fromMinutes: number; toMinutes: number | null; breakMinutes: number }[] = [
  { label: '< 20m flow', fromMinutes: 0, toMinutes: 20, breakMinutes: 5 },
  { label: '20–45m flow', fromMinutes: 20, toMinutes: 45, breakMinutes: 8 },
  { label: '45–75m flow', fromMinutes: 45, toMinutes: 75, breakMinutes: 10 },
  { label: '75–100m flow', fromMinutes: 75, toMinutes: 100, breakMinutes: 15 },
  { label: '100m+ flow', fromMinutes: 100, toMinutes: null, breakMinutes: 20 },
];

interface FlowtimeTimerProps {
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
}

export function FlowtimeTimer({ onSessionComplete, soundEnabled }: FlowtimeTimerProps) {
  // Load saved state once on mount rather than re-parsing localStorage on every render.
  const [saved] = useState(loadFlowtimeState);

  // Mode: 'flow' (counting up) or 'break' (counting down)
  const [mode, setMode] = useState<'flow' | 'break'>(() => saved?.mode ?? 'flow');
  const [elapsedFlowSeconds, setElapsedFlowSeconds] = useState(() => saved?.elapsedFlowSeconds ?? 0);
  const [breakTimeLeft, setBreakTimeLeft] = useState(() => saved?.breakTimeLeft ?? 0);
  const [breakInitialSeconds, setBreakInitialSeconds] = useState(() => saved?.breakInitialSeconds ?? 0);
  const [isFlowing, setIsFlowing] = useState(() => saved?.isFlowing ?? false);
  const [isBreakRunning, setIsBreakRunning] = useState(() => saved?.isBreakRunning ?? false);

  const [taskSubject, setTaskSubject] = useState(() => saved?.taskSubject ?? '');
  const [sessionRecords, setSessionRecords] = useState<{ id: string; minutes: number; breakMins: number; timestamp: string; dateKey?: string }[]>(() => saved?.sessionRecords ?? []);
  const [transitionNotification, setTransitionNotification] = useState<string | null>(null);

  const flowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFlowTickRef = useRef<number>(Date.now());
  const lastBreakTickRef = useRef<number>(Date.now());
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the break-complete transition so a single expiry can only fire it once.
  const breakEndedRef = useRef(false);
  // Guards ending a flow block: two clicks dispatched before React re-renders share the same
  // closure, so a fast double-click on "Break" logged the same flow session twice.
  const flowEndFiredRef = useRef(false);

  // Show a transition banner, replacing any banner still counting down.
  const showTransitionNotification = (message: string) => {
    setTransitionNotification(message);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setTransitionNotification(null);
      notificationTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    saveFlowtimeState({
      mode,
      elapsedFlowSeconds,
      breakTimeLeft,
      breakInitialSeconds,
      isFlowing,
      isBreakRunning,
      taskSubject,
      sessionRecords,
    });
  }, [
    mode,
    elapsedFlowSeconds,
    breakTimeLeft,
    breakInitialSeconds,
    isFlowing,
    isBreakRunning,
    taskSubject,
    sessionRecords,
  ]);

  const currentRecommendedBreak = calculateFlowtimeBreakMinutes(elapsedFlowSeconds);

  // Flow Stopwatch Effect (count up)
  useEffect(() => {
    if (mode === 'flow' && isFlowing) {
      lastFlowTickRef.current = Date.now();

      const tick = () => {
        // Advance by whole seconds and carry the sub-second remainder. Rounding (and
        // flooring at 1) meant the extra visibilitychange tick could charge a full second
        // for a few milliseconds, over-counting flow time on every tab switch.
        const delta = Math.floor((Date.now() - lastFlowTickRef.current) / 1000);
        if (delta <= 0) return;
        lastFlowTickRef.current += delta * 1000;
        if (delta > MAX_FLOW_GAP_SECONDS) {
          // Nothing ticked for far longer than even a throttled background tab allows, so the
          // machine slept or the tab was frozen. This stopwatch's reading is logged verbatim as
          // focus minutes, so pause and let the user decide rather than banking the gap.
          setIsFlowing(false);
          return;
        }
        setElapsedFlowSeconds((prev) => prev + delta);
      };

      flowTimerRef.current = setInterval(tick, 1000);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          tick();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (flowTimerRef.current) clearInterval(flowTimerRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else if (flowTimerRef.current) {
      clearInterval(flowTimerRef.current);
    }
  }, [mode, isFlowing]);

  // Break Countdown Effect (count down)
  useEffect(() => {
    if (mode === 'break' && isBreakRunning) {
      lastBreakTickRef.current = Date.now();

      const tick = () => {
        // Advance by whole seconds and carry the sub-second remainder, so the extra
        // visibilitychange tick cannot charge a full second for a few milliseconds.
        const delta = Math.floor((Date.now() - lastBreakTickRef.current) / 1000);
        if (delta <= 0) return;
        lastBreakTickRef.current += delta * 1000;
        if (delta > MAX_LIVE_GAP_SECONDS) {
          setIsBreakRunning(false);
          return;
        }
        setBreakTimeLeft((prev) => Math.max(0, prev - delta));
      };

      breakTimerRef.current = setInterval(tick, 1000);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          tick();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (breakTimerRef.current) clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }
  }, [mode, isBreakRunning]);

  // End the break once its countdown reaches zero. Doing this from an effect rather than
  // from inside the tick updater keeps the updater pure — React ran it twice under
  // StrictMode, which played the chime twice.
  useEffect(() => {
    if (breakTimeLeft > 0) {
      breakEndedRef.current = false;
      return;
    }
    if (mode !== 'break' || !isBreakRunning || breakEndedRef.current) return;
    breakEndedRef.current = true;

    if (soundEnabled) playBreakCompleteChime();
    setIsBreakRunning(false);
    setMode('flow');
    setElapsedFlowSeconds(0);
    showTransitionNotification('Break complete. Ready for next flow block.');
  }, [breakTimeLeft, mode, isBreakRunning, soundEnabled]);

  // Released once the mode change has actually landed, so a later flow block can end normally.
  useEffect(() => {
    flowEndFiredRef.current = false;
  }, [mode]);

  // When user feels fatigue or reaches natural stop in flow:
  const handleTriggerBreak = () => {
    if (flowEndFiredRef.current) return;
    flowEndFiredRef.current = true;

    // Floor, matching calculateFlowtimeBreakMinutes — rounding up made the logged minutes
    // contradict the rest tier the same block was awarded.
    const focusedMinutes = Math.max(1, Math.floor(elapsedFlowSeconds / 60));
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

    const record = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      minutes: focusedMinutes,
      breakMins: breakMinutes,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateKey: new Date().toDateString(),
    };
    setSessionRecords((prev) => [record, ...prev.slice(0, 4)]);

    if (soundEnabled) playFocusCompleteChime();

    // Transition to break timer automatically
    setMode('break');
    setIsFlowing(false);
    setBreakInitialSeconds(breakSeconds);
    setBreakTimeLeft(breakSeconds);
    setIsBreakRunning(true);

    showTransitionNotification(
      `Flow ended (${focusedMinutes}m). Starting ${breakMinutes}m break.`
    );
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
    setBreakInitialSeconds(0);
  };

  // The log is headed "Today's", but records only carried a clock time, so yesterday's
  // blocks kept showing. Records saved before the day key existed are treated as stale.
  const todayKey = new Date().toDateString();
  const todayRecords = sessionRecords.filter((rec) => rec.dateKey === todayKey);

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
                <span>Flow Stopwatch</span>
              </>
            ) : (
              <>
                <Coffee className="w-3.5 h-3.5 text-[#B45309]" />
                <span>Break Countdown</span>
              </>
            )}
          </div>
        </div>

        {/* Task Focus Input */}
        <div className="max-w-md mx-auto mb-8">
          <label htmlFor="flowtime-task-input" className="block text-center text-xs tracking-wider uppercase text-[#78716C] mb-2 font-medium">
            {mode === 'flow' ? 'Task' : 'Break'}
          </label>
          {mode === 'flow' ? (
            <input
              id="flowtime-task-input"
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="e.g. Linear Algebra proof..."
              className="w-full text-center px-4 py-2.5 rounded-xl border border-[#E7E3DC] bg-[#FAF8F5] text-sm text-[#292524] placeholder-[#A8A29E] focus:outline-none focus:border-[#58705C] transition-colors"
            />
          ) : (
            <p className="text-center text-sm font-serif italic text-[#58705C]">
              Step away and rest your eyes.
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
              {isFlowing ? 'Flowing' : 'Ready'}
            </div>

            {/* Live Break Calculation Card */}
            <div className="mt-6 px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] flex items-center gap-2.5 text-xs text-[#57534E]">
              <Clock className="w-4 h-4 text-[#58705C]" />
              <span>
                Earned rest: <strong className="text-[#292524] font-semibold">{currentRecommendedBreak}m</strong> if you stop now
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
                  Break
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
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>{elapsedFlowSeconds > 0 ? 'Resume' : 'Start'}</span>
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
                  <span>Break ({currentRecommendedBreak}m)</span>
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
                {isBreakRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                id="flowtime-skip-break-btn"
                onClick={handleSkipBreak}
                className="px-6 py-3 rounded-full bg-[#1C1917] text-[#FAF8F5] text-xs font-medium hover:bg-[#2E2A27] flex items-center gap-2 transition-colors"
              >
                <span>Finish Break</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Science Breakdown Scale */}
        <div className="mt-10 pt-6 border-t border-[#F0ECE4]">
          <div className="text-xs text-[#78716C] mb-2 font-medium">Rest Scale:</div>
          {/* Tiers mirror calculateFlowtimeBreakMinutes exactly. The 100m+ tier used to be
              missing, so a long block was promised a 15m break and given 20m. */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {REST_TIERS.map((tier) => {
              const isCurrent =
                elapsedFlowSeconds >= tier.fromMinutes * 60 &&
                (tier.toMinutes === null || elapsedFlowSeconds < tier.toMinutes * 60);
              return (
                <div
                  key={tier.label}
                  className={`p-2.5 rounded-lg border ${
                    isCurrent ? 'border-[#58705C] bg-[#F4F6F4]' : 'border-[#E7E3DC] bg-[#FAF8F5]'
                  }`}
                >
                  <div className="font-medium text-[#292524]">{tier.label}</div>
                  <div className="text-[#58705C] font-semibold">{tier.breakMinutes}m break</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Flow Sessions Today */}
        {todayRecords.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#F0ECE4] text-xs">
            <div className="font-medium text-[#44403C] mb-2">Today's Flow Log:</div>
            <div className="space-y-1.5">
              {todayRecords.map((rec) => (
                <div key={rec.id} className="flex justify-between items-center py-1 px-2.5 rounded bg-[#FAF8F5] text-[#57534E]">
                  <span>{rec.timestamp} &bull; Flow block</span>
                  <span className="font-mono text-[#292524] font-medium">{rec.minutes}m focus &rarr; {rec.breakMins}m break</span>
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
          <span className="font-semibold text-[#1C1917]">Tip: </span>
          Stop when you notice fatigue or restlessness, then take your earned proportional rest.
        </div>
      </div>
    </div>
  );
}
