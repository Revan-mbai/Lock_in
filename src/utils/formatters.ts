export function formatTime(seconds: number): string {
  // Callers pass values straight out of localStorage, so guard against NaN/undefined and
  // negatives rather than rendering "NaN:NaN" or "-1:-5".
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  // Roll over past an hour. Time Boxing allows 180-minute boxes and the Flowtime stopwatch has
  // no ceiling at all, so without this they read "180:00" and "75:23".
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatTimeWithHours(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function calculateFlowtimeBreakMinutes(focusedSeconds: number): number {
  const focusedMins = Number.isFinite(focusedSeconds) ? Math.floor(Math.max(0, focusedSeconds) / 60) : 0;
  if (focusedMins < 20) return 5;
  if (focusedMins < 45) return 8;
  if (focusedMins < 75) return 10;
  if (focusedMins < 100) return 15;
  return 20;
}
