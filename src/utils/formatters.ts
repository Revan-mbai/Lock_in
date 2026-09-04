export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatTimeWithHours(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function calculateFlowtimeBreakMinutes(focusedSeconds: number): number {
  const focusedMins = Math.floor(focusedSeconds / 60);
  if (focusedMins < 20) return 5;
  if (focusedMins < 45) return 8;
  if (focusedMins < 75) return 10;
  if (focusedMins < 100) return 15;
  return 20;
}
