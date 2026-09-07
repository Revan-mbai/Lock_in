import { describe, it, expect } from 'vitest';
import { formatTime, formatTimeWithHours, calculateFlowtimeBreakMinutes } from './formatters';

describe('formatTime', () => {
  it('pads minutes and seconds', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(9)).toBe('00:09');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(25 * 60)).toBe('25:00');
  });

  it('rolls over past an hour instead of showing "180:00"', () => {
    // Time Boxing allows 180-minute boxes and the Flowtime stopwatch has no ceiling.
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(75 * 60 + 23)).toBe('1:15:23');
    expect(formatTime(180 * 60)).toBe('3:00:00');
  });

  it('never renders NaN or negative time from corrupt stored state', () => {
    expect(formatTime(Number.NaN)).toBe('00:00');
    expect(formatTime(-5)).toBe('00:00');
    expect(formatTime(undefined as unknown as number)).toBe('00:00');
  });
});

describe('formatTimeWithHours', () => {
  it('switches to an hour-and-minute form only past an hour', () => {
    expect(formatTimeWithHours(59 * 60 + 59)).toBe('59:59');
    expect(formatTimeWithHours(90 * 60)).toBe('1h 30m 00s');
  });

  it('is defensive about bad input', () => {
    expect(formatTimeWithHours(Number.NaN)).toBe('00:00');
    expect(formatTimeWithHours(-1)).toBe('00:00');
  });
});

describe('calculateFlowtimeBreakMinutes', () => {
  // These tiers are mirrored by the REST_TIERS table rendered in FlowtimeTimer. The table once
  // claimed a 15-minute break past 75 minutes while this function awarded 20 past 100.
  it('matches the published rest scale at every boundary', () => {
    expect(calculateFlowtimeBreakMinutes(0)).toBe(5);
    expect(calculateFlowtimeBreakMinutes(19 * 60 + 59)).toBe(5);
    expect(calculateFlowtimeBreakMinutes(20 * 60)).toBe(8);
    expect(calculateFlowtimeBreakMinutes(44 * 60)).toBe(8);
    expect(calculateFlowtimeBreakMinutes(45 * 60)).toBe(10);
    expect(calculateFlowtimeBreakMinutes(74 * 60)).toBe(10);
    expect(calculateFlowtimeBreakMinutes(75 * 60)).toBe(15);
    expect(calculateFlowtimeBreakMinutes(99 * 60)).toBe(15);
    expect(calculateFlowtimeBreakMinutes(100 * 60)).toBe(20);
    expect(calculateFlowtimeBreakMinutes(500 * 60)).toBe(20);
  });

  it('does not award a break tier for negative or NaN input', () => {
    expect(calculateFlowtimeBreakMinutes(-100)).toBe(5);
    expect(calculateFlowtimeBreakMinutes(Number.NaN)).toBe(5);
  });
});
