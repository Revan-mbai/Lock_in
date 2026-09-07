import { useEffect, useState } from 'react';
import { getTimerSummaries, TimerSummaryInfo } from '../utils/timerPersistence';
import { StudyMethodId } from '../types';

type Summaries = Record<StudyMethodId, TimerSummaryInfo>;

/**
 * One poller for the whole app.
 *
 * The header and every method card used to run their own one-second interval, each calling
 * `getTimerSummaries()` — which reads and parses all eight timer keys. On the overview tab that
 * was nine intervals a second, measured at 72 localStorage reads and 72 JSON.parse calls per
 * second while completely idle. They all want the same snapshot, so it is computed once here and
 * handed to every subscriber.
 */
let snapshot: Summaries = getTimerSummaries();
const subscribers = new Set<(value: Summaries) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function summariesEqual(a: Summaries, b: Summaries): boolean {
  for (const key of Object.keys(a) as StudyMethodId[]) {
    const x = a[key];
    const y = b[key];
    if (!y || x.isRunning !== y.isRunning || x.remainingSeconds !== y.remainingSeconds || x.phase !== y.phase) {
      return false;
    }
  }
  return true;
}

function refresh() {
  const next = getTimerSummaries();
  // Bail out when nothing moved so idle timers do not re-render every subscriber each second.
  if (summariesEqual(snapshot, next)) return;
  snapshot = next;
  subscribers.forEach((notify) => notify(next));
}

function start() {
  if (intervalId !== null) return;
  intervalId = setInterval(refresh, 1000);
  window.addEventListener('study_timers_changed', refresh);
  window.addEventListener('storage', refresh);
}

function stop() {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
  window.removeEventListener('study_timers_changed', refresh);
  window.removeEventListener('storage', refresh);
}

/** Live timer summaries, shared across every component that asks for them. */
export function useTimerSummaries(): Summaries {
  const [value, setValue] = useState<Summaries>(snapshot);

  useEffect(() => {
    // Adopt whatever the shared snapshot holds now, in case it moved between render and effect.
    setValue(snapshot);
    subscribers.add(setValue);
    start();
    return () => {
      subscribers.delete(setValue);
      // The last component to unmount switches the poller off rather than leaving it running.
      if (subscribers.size === 0) stop();
    };
  }, []);

  return value;
}
