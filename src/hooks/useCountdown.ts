import { useEffect, useRef } from 'react';
import { MAX_LIVE_GAP_SECONDS } from '../utils/timerPersistence';

interface CountdownOptions {
  /** Seconds remaining, owned by the caller so each timer persists it its own way. */
  timeLeft: number;
  setTimeLeft: (updater: (prev: number) => number) => void;
  isRunning: boolean;
  setIsRunning: (value: boolean) => void;
  /** Length of the block in progress — used to re-arm an exhausted one and to credit expiry. */
  totalSeconds: number;
  /** Runs exactly once when the countdown reaches zero while running. */
  onExpire: (elapsedSeconds: number) => void;
  /**
   * Larger gaps mean the machine slept rather than the tab being backgrounded, so the timer
   * pauses instead of banking the time. Flowtime's count-up stopwatch passes a tighter bound
   * because its reading is logged verbatim as focus minutes.
   */
  maxGapSeconds?: number;
}

/**
 * The countdown engine shared by every timer.
 *
 * This was copy-pasted into each timer component, which is why the same handful of bugs had to
 * be found and fixed five to eight separate times. Everything subtle lives here now:
 *
 *  - the tick's state updater stays PURE. Scheduling the expiry from inside it made React run
 *    the transition twice under StrictMode and log every completed session twice.
 *  - the tick advances by whole seconds and carries the sub-second remainder, so the extra
 *    visibilitychange tick cannot charge a full second for a few milliseconds.
 *  - expiry is detected by a separate effect, guarded so one expiry fires once — and that
 *    effect sees the current render's callback, so the logged task name is never stale.
 *  - `runGuarded` protects manual skips: two clicks dispatched before React re-renders share
 *    one closure and would otherwise credit the same block twice.
 */
export function useCountdown({
  timeLeft,
  setTimeLeft,
  isRunning,
  setIsRunning,
  totalSeconds,
  onExpire,
  maxGapSeconds = MAX_LIVE_GAP_SECONDS,
}: CountdownOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  // Released whenever the clock is above zero again, so the next expiry can fire.
  const firedRef = useRef(false);
  // Always holds the current render's callback, so the effect below never closes over a stale
  // task name, sound setting or duration.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!isRunning) return;

    lastTickRef.current = Date.now();

    const tick = () => {
      const delta = Math.floor((Date.now() - lastTickRef.current) / 1000);
      if (delta <= 0) return;
      lastTickRef.current += delta * 1000;
      if (delta > maxGapSeconds) {
        setIsRunning(false);
        return;
      }
      setTimeLeft((prev) => Math.max(0, prev - delta));
    };

    timerRef.current = setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // Deliberately only `isRunning`: including the tick's other inputs would tear the interval
    // down and rebuild it on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, maxGapSeconds]);

  // No dependency array on purpose. Keying this on [timeLeft, isRunning, totalSeconds] looks
  // right but silently breaks when a transition lands on an identical clock: the Feynman
  // protocol has two consecutive 10-minute stages, so skipping between them changed neither
  // value, the effect never re-ran, and the guard stayed latched — killing the Skip button for
  // the rest of the run. Running after every commit releases the guard as soon as the clock is
  // above zero again, and a double-click inside a single batch still sees no render between the
  // two clicks, so it stays guarded.
  useEffect(() => {
    if (timeLeft > 0) {
      firedRef.current = false;
      return;
    }
    if (!isRunning || firedRef.current) return;
    firedRef.current = true;
    onExpireRef.current(totalSeconds);
  });

  return {
    /** Start, pause, or re-arm and start an exhausted block. */
    toggle() {
      if (!isRunning && timeLeft <= 0) {
        setTimeLeft(() => totalSeconds);
      }
      setIsRunning(!isRunning);
    },

    /** Stop and put the full block back on the clock. */
    reset() {
      setIsRunning(false);
      setTimeLeft(() => totalSeconds);
    },

    /**
     * Run a manual transition at most once per render. Returns false when the call was
     * suppressed as a repeat, so callers can skip their own side effects too.
     */
    runGuarded(action: () => void): boolean {
      if (firedRef.current) return false;
      firedRef.current = true;
      action();
      return true;
    },
  };
}
