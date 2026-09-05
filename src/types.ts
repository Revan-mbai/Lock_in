export type StudyMethodId = 'pomodoro' | 'flowtime' | 'ninety-min' | 'time-boxing' | 'fifty-two-seventeen';

export type ActiveTab = 'overview' | StudyMethodId;

export interface StudyMethodInfo {
  id: StudyMethodId;
  name: string;
  subtitle: string;
  tagline: string;
  focusTimeDisplay: string;
  breakTimeDisplay: string;
  origin: string;
  bestFor: string[];
  description: string;
  howItWorks: string[];
  scienceNote: string;
  /** Whether the timer advances into the break by itself; Flowtime waits for the user. */
  autoShifts: boolean;
  accentColor: string; // Tailwind color token or hex
}

export type TimerPhase = 'work' | 'shortBreak' | 'longBreak';

export interface TimeBoxItem {
  id: string;
  title: string;
  durationMinutes: number;
  isBreak: boolean;
  notes?: string;
  completed: boolean;
}

export interface FocusSessionLog {
  id: string;
  methodId: StudyMethodId;
  methodName: string;
  taskTitle: string;
  durationMinutes: number;
  completedAt: string; // ISO string
  phase: 'work' | 'break';
}

export type AmbientSoundType =
  | 'brown'
  | 'rain'
  | 'white'
  | 'pink'
  | 'binaural'
  | 'waves'
  | 'fireplace'
  | 'cafe';

export interface AmbientSoundState {
  isPlaying: boolean;
  type: AmbientSoundType;
  volume: number; // 0 to 1
}
