import { TimeBoxItem, InterleaveSubject, StudyMethodId } from '../types';

export interface PomodoroSavedState {
  /** Tab that owns the running timer; see TAB_ID. */
  ownerId?: string;
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  cyclesBeforeLongBreak: number;
  phase: 'work' | 'shortBreak' | 'longBreak';
  timeLeft: number;
  isRunning: boolean;
  completedCycles: number;
  taskSubject: string;
  autoStartNext: boolean;
  lastTimestamp: number;
}

export interface FlowtimeSavedState {
  /** Tab that owns the running timer; see TAB_ID. */
  ownerId?: string;
  mode: 'flow' | 'break';
  elapsedFlowSeconds: number;
  breakTimeLeft: number;
  breakInitialSeconds: number;
  isFlowing: boolean;
  isBreakRunning: boolean;
  taskSubject: string;
  sessionRecords: { id: string; minutes: number; breakMins: number; timestamp: string; dateKey?: string }[];
  lastTimestamp: number;
}

export interface NinetyMinSavedState {
  /** Tab that owns the running timer; see TAB_ID. */
  ownerId?: string;
  phase: 'work' | 'break';
  timeLeft: number;
  isRunning: boolean;
  taskSubject: string;
  autoStartNext: boolean;
  lastTimestamp: number;
}

export interface FiftyTwoSeventeenSavedState {
  /** Tab that owns the running timer; see TAB_ID. */
  ownerId?: string;
  phase: 'work' | 'break';
  timeLeft: number;
  isRunning: boolean;
  taskSubject: string;
  autoStartNext: boolean;
  lastTimestamp: number;
}

export interface TimeBoxingSavedState {
  /** Tab that owns the running timer; see TAB_ID. */
  ownerId?: string;
  boxes: TimeBoxItem[];
  activeBoxIndex: number;
  timeLeft: number;
  isRunning: boolean;
  autoShiftNext: boolean;
  lastTimestamp: number;
}

export interface RetrievalPracticeSavedState {
  /** Tab that owns the running timer; see TAB_ID. */
  ownerId?: string;
  phase: 'study' | 'recall' | 'rest';
  timeLeft: number;
  isRunning: boolean;
  taskSubject: string;
  autoStartNext: boolean;
  completedCycles: number;
  lastTimestamp: number;
}

export interface InterleavingSavedState {
  /** Tab that owns the running timer; see TAB_ID. */
  ownerId?: string;
  subjects: InterleaveSubject[];
  blockMinutes: number;
  activeSubjectIndex: number;
  timeLeft: number;
  isRunning: boolean;
  autoRotate: boolean;
  roundsCompleted: number;
  lastTimestamp: number;
}

export interface FeynmanSavedState {
  /** Tab that owns the running timer; see TAB_ID. */
  ownerId?: string;
  /** Index into the fixed four-stage protocol; equal to the stage count once finished. */
  stageIndex: number;
  timeLeft: number;
  isRunning: boolean;
  concept: string;
  autoStartNext: boolean;
  lastTimestamp: number;
}

const STORAGE_KEYS = {
  pomodoro: 'study_timer_pomodoro_v2',
  flowtime: 'study_timer_flowtime_v2',
  'ninety-min': 'study_timer_ninety-min_v2',
  'time-boxing': 'study_timer_time-boxing_v2',
  'fifty-two-seventeen': 'study_timer_fifty-two-seventeen_v2',
  'retrieval-practice': 'study_timer_retrieval-practice_v1',
  interleaving: 'study_timer_interleaving_v1',
  feynman: 'study_timer_feynman_v1',
  activeTab: 'study_methods_active_tab_v2',
};

// A closed tab, a sleeping machine or an evicted PWA all leave a large gap between
// `lastTimestamp` and now. Crediting that gap in full would mean the app invents study time
// nobody spent, so only a short window — long enough to cover ordinary backgrounding — is
// carried over. Anything longer means the timer should be treated as no longer running.
export const MAX_CATCHUP_SECONDS = 120;

// The live tick needs a far looser bound than the restore path above. While the page stays
// loaded the timer really is running, and backgrounding the tab — which browsers throttle to
// roughly one tick a minute, or freeze outright — is the normal way to use a focus timer, so a
// gap of many minutes is expected and must still be credited. Only a gap far larger than any
// supported block indicates the machine was asleep, and that should pause rather than invent a
// completed session.
export const MAX_LIVE_GAP_SECONDS = 2 * 60 * 60;

// The Flowtime stopwatch counts UP with no block to bound it, and whatever it reads is logged
// verbatim as focus minutes, so it cannot afford the countdowns' generous allowance — a slept
// machine would bank the whole gap as study time. This is still well clear of the ~1/minute
// tick a throttled background tab gets, so ordinary backgrounded studying is credited in full.
export const MAX_FLOW_GAP_SECONDS = 5 * 60;

// Identifies this tab for the lifetime of the page. A running timer records the tab driving
// it, because otherwise every open tab rehydrates the same running block, counts it down
// independently and logs its own completed session — one 25-minute block counted twice.
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * True when another live tab is already driving this timer.
 *
 * Ownership lasts exactly as long as the loader would still credit the gap and keep the timer
 * running. Saves are tick-driven, and a hidden tab is throttled to roughly one tick — so one
 * save — per minute, so any narrower window leaves a band in which a second tab neither defers
 * to the owner nor treats the block as ended: both count it down and both log it. Deriving both
 * from `elapsedSince` closes that band by construction.
 */
function ownedByAnotherTab(state: { ownerId?: string; lastTimestamp: number }): boolean {
  if (!state.ownerId || state.ownerId === TAB_ID) return false;
  return !elapsedSince(state.lastTimestamp).exceededWindow;
}

/**
 * True when this tab is only mirroring a block another live tab owns. Such a tab renders the
 * timer paused, and must not stamp that paused state over the owner's live record — every
 * tab's header summary, and the owner's own reload, read back from it.
 */
function deferToOwner(key: string, running: boolean): boolean {
  if (running) return false;
  try {
    const raw = localStorage.getItem(key);
    if (!raw || !raw.startsWith('{')) return false;
    const prev = JSON.parse(raw);
    const prevRunning = prev.isRunning || prev.isFlowing || prev.isBreakRunning;
    return Boolean(prevRunning) && ownedByAnotherTab(prev);
  } catch {
    return false;
  }
}

// A tab that is closing or reloading must hand back ownership. Without this, reloading the page
// while a timer runs would leave a one-second-old record owned by the tab that just went away,
// and the replacement page — which gets a fresh TAB_ID — would mistake it for a live rival and
// refuse to run the user's own timer.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      try {
        const raw = localStorage.getItem(key);
        // activeTab holds a bare string rather than a state object.
        if (!raw || !raw.startsWith('{')) continue;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.ownerId === TAB_ID) {
          delete parsed.ownerId;
          localStorage.setItem(key, JSON.stringify(parsed));
        }
      } catch {
        // A malformed or unreadable entry is nothing to release.
      }
    }
  });
}

// Milliseconds of clock skew tolerated before a saved timestamp is treated as corrupt.
// A `lastTimestamp` in the future (system clock change) would otherwise poison every
// subsequent catch-up calculation.
const MAX_CLOCK_SKEW_MS = 60_000;

/** Seconds elapsed since `lastTimestamp`, and whether the gap exceeded the catch-up window. */
function elapsedSince(lastTimestamp: number | undefined): {
  seconds: number;
  exceededWindow: boolean;
} {
  if (!lastTimestamp) return { seconds: 0, exceededWindow: false };

  const now = Date.now();
  if (lastTimestamp > now + MAX_CLOCK_SKEW_MS) {
    // Clock moved backwards since the save; do not credit anything.
    return { seconds: 0, exceededWindow: false };
  }

  const raw = Math.max(0, Math.floor((now - lastTimestamp) / 1000));
  return { seconds: Math.min(raw, MAX_CATCHUP_SECONDS), exceededWindow: raw > MAX_CATCHUP_SECONDS };
}

function notifyTimersChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('study_timers_changed'));
  }
}

// POMODORO PERSISTENCE
export function loadPomodoroState(): PomodoroSavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pomodoro);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PomodoroSavedState;
    if (parsed.isRunning && ownedByAnotherTab(parsed)) {
      // Another live tab is already counting this block down and will log it when it ends.
      // Rehydrate as paused so this tab shows the state without racing it or double-logging.
      parsed.isRunning = false;
    } else if (parsed.isRunning) {
      const { seconds, exceededWindow } = elapsedSince(parsed.lastTimestamp);
      if (exceededWindow) {
        // Away longer than the catch-up window. Pause where the block actually stood rather
        // than crediting unattended time — and rather than parking it at 00:00, which would
        // leave a frozen card whose Resume restarts a whole fresh block.
        parsed.isRunning = false;
      } else {
        // Inside the window the block really did run down, so leave isRunning set and let
        // the timer fire its transition: the session is logged and the phase advances.
        parsed.timeLeft = Math.max(0, parsed.timeLeft - seconds);
      }
      parsed.lastTimestamp = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePomodoroState(state: Omit<PomodoroSavedState, 'lastTimestamp'>) {
  if (deferToOwner(STORAGE_KEYS.pomodoro, state.isRunning)) return;
  try {
    const toSave: PomodoroSavedState = {
      ...state,
      lastTimestamp: Date.now(),
      ownerId: TAB_ID,
    };
    localStorage.setItem(STORAGE_KEYS.pomodoro, JSON.stringify(toSave));
    notifyTimersChanged();
  } catch {
    // Ignore quota errors
  }
}

// FLOWTIME PERSISTENCE
export function loadFlowtimeState(): FlowtimeSavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.flowtime);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlowtimeSavedState;
    if ((parsed.isFlowing || parsed.isBreakRunning) && ownedByAnotherTab(parsed)) {
      // Another live tab drives this block; mirror it as paused rather than racing it.
      parsed.isFlowing = false;
      parsed.isBreakRunning = false;
    } else if (parsed.lastTimestamp) {
      const { seconds, exceededWindow } = elapsedSince(parsed.lastTimestamp);
      if (parsed.mode === 'flow' && parsed.isFlowing) {
        // The stopwatch counts up, so an uncapped credit grew without bound and was then
        // logged verbatim as focus minutes. Past the window, credit nothing at all: the gap
        // is the proof the user was away.
        if (exceededWindow) {
          parsed.isFlowing = false;
        } else {
          parsed.elapsedFlowSeconds += seconds;
        }
      } else if (parsed.mode === 'break' && parsed.isBreakRunning) {
        if (exceededWindow) {
          parsed.isBreakRunning = false;
        } else {
          parsed.breakTimeLeft = Math.max(0, parsed.breakTimeLeft - seconds);
        }
      }
      parsed.lastTimestamp = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveFlowtimeState(state: Omit<FlowtimeSavedState, 'lastTimestamp'>) {
  if (deferToOwner(STORAGE_KEYS.flowtime, state.isFlowing || state.isBreakRunning)) return;
  try {
    const toSave: FlowtimeSavedState = {
      ...state,
      lastTimestamp: Date.now(),
      ownerId: TAB_ID,
    };
    localStorage.setItem(STORAGE_KEYS.flowtime, JSON.stringify(toSave));
    notifyTimersChanged();
  } catch {
    // Ignore
  }
}

// 90-MIN PERSISTENCE
export function loadNinetyMinState(): NinetyMinSavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS['ninety-min']);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NinetyMinSavedState;
    if (parsed.isRunning && ownedByAnotherTab(parsed)) {
      // Another live tab is already counting this block down and will log it when it ends.
      // Rehydrate as paused so this tab shows the state without racing it or double-logging.
      parsed.isRunning = false;
    } else if (parsed.isRunning) {
      const { seconds, exceededWindow } = elapsedSince(parsed.lastTimestamp);
      if (exceededWindow) {
        // Away longer than the catch-up window. Pause where the block actually stood rather
        // than crediting unattended time — and rather than parking it at 00:00, which would
        // leave a frozen card whose Resume restarts a whole fresh block.
        parsed.isRunning = false;
      } else {
        // Inside the window the block really did run down, so leave isRunning set and let
        // the timer fire its transition: the session is logged and the phase advances.
        parsed.timeLeft = Math.max(0, parsed.timeLeft - seconds);
      }
      parsed.lastTimestamp = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveNinetyMinState(state: Omit<NinetyMinSavedState, 'lastTimestamp'>) {
  if (deferToOwner(STORAGE_KEYS['ninety-min'], state.isRunning)) return;
  try {
    const toSave: NinetyMinSavedState = {
      ...state,
      lastTimestamp: Date.now(),
      ownerId: TAB_ID,
    };
    localStorage.setItem(STORAGE_KEYS['ninety-min'], JSON.stringify(toSave));
    notifyTimersChanged();
  } catch {
    // Ignore
  }
}

// 52/17 PERSISTENCE
export function loadFiftyTwoSeventeenState(): FiftyTwoSeventeenSavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS['fifty-two-seventeen']);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FiftyTwoSeventeenSavedState;
    if (parsed.isRunning && ownedByAnotherTab(parsed)) {
      // Another live tab is already counting this block down and will log it when it ends.
      // Rehydrate as paused so this tab shows the state without racing it or double-logging.
      parsed.isRunning = false;
    } else if (parsed.isRunning) {
      const { seconds, exceededWindow } = elapsedSince(parsed.lastTimestamp);
      if (exceededWindow) {
        // Away longer than the catch-up window. Pause where the block actually stood rather
        // than crediting unattended time — and rather than parking it at 00:00, which would
        // leave a frozen card whose Resume restarts a whole fresh block.
        parsed.isRunning = false;
      } else {
        // Inside the window the block really did run down, so leave isRunning set and let
        // the timer fire its transition: the session is logged and the phase advances.
        parsed.timeLeft = Math.max(0, parsed.timeLeft - seconds);
      }
      parsed.lastTimestamp = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveFiftyTwoSeventeenState(state: Omit<FiftyTwoSeventeenSavedState, 'lastTimestamp'>) {
  if (deferToOwner(STORAGE_KEYS['fifty-two-seventeen'], state.isRunning)) return;
  try {
    const toSave: FiftyTwoSeventeenSavedState = {
      ...state,
      lastTimestamp: Date.now(),
      ownerId: TAB_ID,
    };
    localStorage.setItem(STORAGE_KEYS['fifty-two-seventeen'], JSON.stringify(toSave));
    notifyTimersChanged();
  } catch {
    // Ignore
  }
}

// TIME BOXING PERSISTENCE
export function loadTimeBoxingState(): TimeBoxingSavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS['time-boxing']);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimeBoxingSavedState;
    if (parsed.isRunning && ownedByAnotherTab(parsed)) {
      // Another live tab is already counting this block down and will log it when it ends.
      // Rehydrate as paused so this tab shows the state without racing it or double-logging.
      parsed.isRunning = false;
    } else if (parsed.isRunning) {
      const { seconds, exceededWindow } = elapsedSince(parsed.lastTimestamp);
      if (exceededWindow) {
        // Away longer than the catch-up window. Pause where the block actually stood rather
        // than crediting unattended time — and rather than parking it at 00:00, which would
        // leave a frozen card whose Resume restarts a whole fresh block.
        parsed.isRunning = false;
      } else {
        // Inside the window the block really did run down, so leave isRunning set and let
        // the timer fire its transition: the session is logged and the phase advances.
        parsed.timeLeft = Math.max(0, parsed.timeLeft - seconds);
      }
      parsed.lastTimestamp = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveTimeBoxingState(state: Omit<TimeBoxingSavedState, 'lastTimestamp'>) {
  if (deferToOwner(STORAGE_KEYS['time-boxing'], state.isRunning)) return;
  try {
    const toSave: TimeBoxingSavedState = {
      ...state,
      lastTimestamp: Date.now(),
      ownerId: TAB_ID,
    };
    localStorage.setItem(STORAGE_KEYS['time-boxing'], JSON.stringify(toSave));
    notifyTimersChanged();
  } catch {
    // Ignore
  }
}


// RETRIEVAL PRACTICE PERSISTENCE
export function loadRetrievalPracticeState(): RetrievalPracticeSavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS['retrieval-practice']);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RetrievalPracticeSavedState;
    if (parsed.isRunning && ownedByAnotherTab(parsed)) {
      // Another live tab is already counting this block down and will log it when it ends.
      // Rehydrate as paused so this tab shows the state without racing it or double-logging.
      parsed.isRunning = false;
    } else if (parsed.isRunning) {
      const { seconds, exceededWindow } = elapsedSince(parsed.lastTimestamp);
      if (exceededWindow) {
        // Away longer than the catch-up window. Pause where the block actually stood rather
        // than crediting unattended time — and rather than parking it at 00:00, which would
        // leave a frozen card whose Resume restarts a whole fresh block.
        parsed.isRunning = false;
      } else {
        // Inside the window the block really did run down, so leave isRunning set and let
        // the timer fire its transition: the session is logged and the phase advances.
        parsed.timeLeft = Math.max(0, parsed.timeLeft - seconds);
      }
      parsed.lastTimestamp = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRetrievalPracticeState(state: Omit<RetrievalPracticeSavedState, 'lastTimestamp'>) {
  if (deferToOwner(STORAGE_KEYS['retrieval-practice'], state.isRunning)) return;
  try {
    const toSave: RetrievalPracticeSavedState = {
      ...state,
      lastTimestamp: Date.now(),
      ownerId: TAB_ID,
    };
    localStorage.setItem(STORAGE_KEYS['retrieval-practice'], JSON.stringify(toSave));
    notifyTimersChanged();
  } catch {
    // Ignore quota errors
  }
}

// INTERLEAVING PERSISTENCE
export function loadInterleavingState(): InterleavingSavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS['interleaving']);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InterleavingSavedState;
    if (parsed.isRunning && ownedByAnotherTab(parsed)) {
      // Another live tab is already counting this block down and will log it when it ends.
      // Rehydrate as paused so this tab shows the state without racing it or double-logging.
      parsed.isRunning = false;
    } else if (parsed.isRunning) {
      const { seconds, exceededWindow } = elapsedSince(parsed.lastTimestamp);
      if (exceededWindow) {
        // Away longer than the catch-up window. Pause where the block actually stood rather
        // than crediting unattended time — and rather than parking it at 00:00, which would
        // leave a frozen card whose Resume restarts a whole fresh block.
        parsed.isRunning = false;
      } else {
        // Inside the window the block really did run down, so leave isRunning set and let
        // the timer fire its transition: the session is logged and the phase advances.
        parsed.timeLeft = Math.max(0, parsed.timeLeft - seconds);
      }
      parsed.lastTimestamp = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveInterleavingState(state: Omit<InterleavingSavedState, 'lastTimestamp'>) {
  if (deferToOwner(STORAGE_KEYS['interleaving'], state.isRunning)) return;
  try {
    const toSave: InterleavingSavedState = {
      ...state,
      lastTimestamp: Date.now(),
      ownerId: TAB_ID,
    };
    localStorage.setItem(STORAGE_KEYS['interleaving'], JSON.stringify(toSave));
    notifyTimersChanged();
  } catch {
    // Ignore quota errors
  }
}

// FEYNMAN PERSISTENCE
export function loadFeynmanState(): FeynmanSavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS['feynman']);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeynmanSavedState;
    if (parsed.isRunning && ownedByAnotherTab(parsed)) {
      // Another live tab is already counting this block down and will log it when it ends.
      // Rehydrate as paused so this tab shows the state without racing it or double-logging.
      parsed.isRunning = false;
    } else if (parsed.isRunning) {
      const { seconds, exceededWindow } = elapsedSince(parsed.lastTimestamp);
      if (exceededWindow) {
        // Away longer than the catch-up window. Pause where the block actually stood rather
        // than crediting unattended time — and rather than parking it at 00:00, which would
        // leave a frozen card whose Resume restarts a whole fresh block.
        parsed.isRunning = false;
      } else {
        // Inside the window the block really did run down, so leave isRunning set and let
        // the timer fire its transition: the session is logged and the phase advances.
        parsed.timeLeft = Math.max(0, parsed.timeLeft - seconds);
      }
      parsed.lastTimestamp = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveFeynmanState(state: Omit<FeynmanSavedState, 'lastTimestamp'>) {
  if (deferToOwner(STORAGE_KEYS['feynman'], state.isRunning)) return;
  try {
    const toSave: FeynmanSavedState = {
      ...state,
      lastTimestamp: Date.now(),
      ownerId: TAB_ID,
    };
    localStorage.setItem(STORAGE_KEYS['feynman'], JSON.stringify(toSave));
    notifyTimersChanged();
  } catch {
    // Ignore quota errors
  }
}

// ACTIVE TAB PERSISTENCE
export function loadActiveTab(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.activeTab);
  } catch {
    return null;
  }
}

export function saveActiveTab(tab: string) {
  try {
    localStorage.setItem(STORAGE_KEYS.activeTab, tab);
  } catch {
    // Ignore
  }
}

/** Short labels for the Feynman stages, shared by the timer and the header summary. */
export const FEYNMAN_STAGE_LABELS = ['Study', 'Explain', 'Find gaps', 'Simplify'] as const;

// SUMMARY FOR HEADER & METHOD CARDS
export interface TimerSummaryInfo {
  isRunning: boolean;
  remainingSeconds: number;
  phase?: string;
}

export function getTimerSummaries(): Record<StudyMethodId, TimerSummaryInfo> {
  const summaries: Record<StudyMethodId, TimerSummaryInfo> = {
    pomodoro: { isRunning: false, remainingSeconds: 0 },
    flowtime: { isRunning: false, remainingSeconds: 0 },
    'ninety-min': { isRunning: false, remainingSeconds: 0 },
    'time-boxing': { isRunning: false, remainingSeconds: 0 },
    'fifty-two-seventeen': { isRunning: false, remainingSeconds: 0 },
    'retrieval-practice': { isRunning: false, remainingSeconds: 0 },
    interleaving: { isRunning: false, remainingSeconds: 0 },
    feynman: { isRunning: false, remainingSeconds: 0 },
  };

  try {
    const pomo = loadPomodoroState();
    if (pomo) {
      summaries.pomodoro = {
        isRunning: pomo.isRunning,
        remainingSeconds: pomo.timeLeft,
        phase: pomo.phase === 'work' ? 'Focus' : 'Break',
      };
    }

    const flow = loadFlowtimeState();
    if (flow) {
      summaries.flowtime = {
        isRunning: flow.mode === 'flow' ? flow.isFlowing : flow.isBreakRunning,
        remainingSeconds: flow.mode === 'flow' ? flow.elapsedFlowSeconds : flow.breakTimeLeft,
        phase: flow.mode === 'flow' ? 'Flowing' : 'Break',
      };
    }

    const ninety = loadNinetyMinState();
    if (ninety) {
      summaries['ninety-min'] = {
        isRunning: ninety.isRunning,
        remainingSeconds: ninety.timeLeft,
        phase: ninety.phase === 'work' ? 'Focus' : 'Break',
      };
    }

    const fiftyTwo = loadFiftyTwoSeventeenState();
    if (fiftyTwo) {
      summaries['fifty-two-seventeen'] = {
        isRunning: fiftyTwo.isRunning,
        remainingSeconds: fiftyTwo.timeLeft,
        phase: fiftyTwo.phase === 'work' ? 'Sprint' : 'Break',
      };
    }

    const boxing = loadTimeBoxingState();
    if (boxing) {
      summaries['time-boxing'] = {
        isRunning: boxing.isRunning,
        remainingSeconds: boxing.timeLeft,
        phase: boxing.boxes[boxing.activeBoxIndex]?.title || 'Box',
      };
    }

    const retrieval = loadRetrievalPracticeState();
    if (retrieval) {
      summaries['retrieval-practice'] = {
        isRunning: retrieval.isRunning,
        remainingSeconds: retrieval.timeLeft,
        phase:
          retrieval.phase === 'study' ? 'Study' : retrieval.phase === 'recall' ? 'Recall' : 'Rest',
      };
    }

    const interleave = loadInterleavingState();
    if (interleave) {
      summaries.interleaving = {
        isRunning: interleave.isRunning,
        remainingSeconds: interleave.timeLeft,
        phase: interleave.subjects[interleave.activeSubjectIndex]?.name || 'Subject',
      };
    }

    const feynman = loadFeynmanState();
    if (feynman) {
      summaries.feynman = {
        isRunning: feynman.isRunning,
        remainingSeconds: feynman.timeLeft,
        phase: FEYNMAN_STAGE_LABELS[feynman.stageIndex] ?? 'Complete',
      };
    }
  } catch {
    // Ignore
  }

  return summaries;
}
