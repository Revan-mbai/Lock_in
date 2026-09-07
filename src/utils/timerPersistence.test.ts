import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadPomodoroState,
  savePomodoroState,
  loadFlowtimeState,
  saveFlowtimeState,
  getTimerSummaries,
  MAX_CATCHUP_SECONDS,
} from './timerPersistence';

const POMODORO_KEY = 'study_timer_pomodoro_v2';
const FLOWTIME_KEY = 'study_timer_flowtime_v2';

function writePomodoro(overrides: Record<string, unknown>) {
  localStorage.setItem(
    POMODORO_KEY,
    JSON.stringify({
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      cyclesBeforeLongBreak: 4,
      phase: 'work',
      timeLeft: 1500,
      isRunning: false,
      completedCycles: 0,
      taskSubject: '',
      autoStartNext: true,
      lastTimestamp: Date.now(),
      ...overrides,
    })
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('countdown catch-up on reload', () => {
  it('returns null when nothing is stored', () => {
    expect(loadPomodoroState()).toBeNull();
  });

  it('survives a corrupt payload instead of throwing', () => {
    localStorage.setItem(POMODORO_KEY, 'not json at all');
    expect(loadPomodoroState()).toBeNull();
  });

  it('credits a short absence and keeps the timer running', () => {
    // 30s left, away 20s: the block is still going and must resume with 10s left.
    writePomodoro({ isRunning: true, timeLeft: 30, lastTimestamp: Date.now() - 20_000 });
    const state = loadPomodoroState();
    expect(state?.isRunning).toBe(true);
    expect(state?.timeLeft).toBe(10);
  });

  it('keeps isRunning when a block expires inside the catch-up window, so the session is logged', () => {
    // The regression this guards: capping the window once made an expired-while-away block come
    // back paused, and the completed session was silently discarded.
    writePomodoro({ isRunning: true, timeLeft: 30, lastTimestamp: Date.now() - 90_000 });
    const state = loadPomodoroState();
    expect(state?.timeLeft).toBe(0);
    expect(state?.isRunning).toBe(true);
  });

  it('pauses where the block stood after a long absence, crediting nothing', () => {
    // Not parked at 00:00 either — that left a frozen card whose Resume restarted a whole block.
    const away = (MAX_CATCHUP_SECONDS + 600) * 1000;
    writePomodoro({ isRunning: true, timeLeft: 900, lastTimestamp: Date.now() - away });
    const state = loadPomodoroState();
    expect(state?.isRunning).toBe(false);
    expect(state?.timeLeft).toBe(900);
  });

  it('never credits time when the clock moved backwards', () => {
    writePomodoro({ isRunning: true, timeLeft: 900, lastTimestamp: Date.now() + 10 * 60_000 });
    expect(loadPomodoroState()?.timeLeft).toBe(900);
  });

  it('leaves a paused timer completely alone', () => {
    writePomodoro({ isRunning: false, timeLeft: 900, lastTimestamp: Date.now() - 3_600_000 });
    const state = loadPomodoroState();
    expect(state?.timeLeft).toBe(900);
    expect(state?.isRunning).toBe(false);
  });
});

describe('flowtime catch-up', () => {
  function writeFlowtime(overrides: Record<string, unknown>) {
    localStorage.setItem(
      FLOWTIME_KEY,
      JSON.stringify({
        mode: 'flow',
        elapsedFlowSeconds: 1200,
        breakTimeLeft: 0,
        breakInitialSeconds: 0,
        isFlowing: true,
        isBreakRunning: false,
        taskSubject: '',
        sessionRecords: [],
        lastTimestamp: Date.now(),
        ...overrides,
      })
    );
  }

  it('credits a short absence to the stopwatch', () => {
    writeFlowtime({ lastTimestamp: Date.now() - 30_000 });
    expect(loadFlowtimeState()?.elapsedFlowSeconds).toBe(1230);
  });

  it('banks nothing and pauses after a long absence', () => {
    // The stopwatch counts up with no ceiling and its reading is logged verbatim as focus
    // minutes, so an uncapped credit once turned 20 minutes into 620.
    writeFlowtime({ lastTimestamp: Date.now() - 10 * 3_600_000 });
    const state = loadFlowtimeState();
    expect(state?.elapsedFlowSeconds).toBe(1200);
    expect(state?.isFlowing).toBe(false);
  });
});

describe('save/load round trip', () => {
  it('writes state that reads back unchanged', () => {
    savePomodoroState({
      workDuration: 50,
      shortBreakDuration: 10,
      longBreakDuration: 20,
      cyclesBeforeLongBreak: 4,
      phase: 'shortBreak',
      timeLeft: 600,
      isRunning: false,
      completedCycles: 3,
      taskSubject: 'Thermodynamics',
      autoStartNext: false,
    });
    const state = loadPomodoroState();
    expect(state?.workDuration).toBe(50);
    expect(state?.taskSubject).toBe('Thermodynamics');
    expect(state?.completedCycles).toBe(3);
    expect(state?.phase).toBe('shortBreak');
  });

  it('stamps an owner so other tabs can tell who is driving the timer', () => {
    savePomodoroState({
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      cyclesBeforeLongBreak: 4,
      phase: 'work',
      timeLeft: 1500,
      isRunning: true,
      completedCycles: 0,
      taskSubject: '',
      autoStartNext: true,
    });
    expect(JSON.parse(localStorage.getItem(POMODORO_KEY)!).ownerId).toBeTruthy();
  });

  it('does not throw when localStorage rejects the write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() =>
      saveFlowtimeState({
        mode: 'flow',
        elapsedFlowSeconds: 0,
        breakTimeLeft: 0,
        breakInitialSeconds: 0,
        isFlowing: false,
        isBreakRunning: false,
        taskSubject: '',
        sessionRecords: [],
      })
    ).not.toThrow();
    spy.mockRestore();
  });
});

describe('getTimerSummaries', () => {
  it('reports every method even with empty storage', () => {
    const summaries = getTimerSummaries();
    for (const id of [
      'pomodoro',
      'flowtime',
      'ninety-min',
      'time-boxing',
      'fifty-two-seventeen',
      'retrieval-practice',
      'interleaving',
      'feynman',
    ] as const) {
      expect(summaries[id]).toBeDefined();
      expect(summaries[id].isRunning).toBe(false);
    }
  });

  it('surfaces a running timer with its remaining time', () => {
    writePomodoro({ isRunning: true, timeLeft: 1234, lastTimestamp: Date.now() });
    const summaries = getTimerSummaries();
    expect(summaries.pomodoro.isRunning).toBe(true);
    expect(summaries.pomodoro.remainingSeconds).toBe(1234);
    expect(summaries.pomodoro.phase).toBe('Focus');
  });
});
