import { StudyMethodInfo } from '../types';

export const STUDY_METHODS: StudyMethodInfo[] = [
  {
    id: 'pomodoro',
    name: 'Pomodoro Technique',
    subtitle: 'Classic 25/5 rhythm',
    tagline: '25 min focus, 5 min break',
    focusTimeDisplay: '25 min',
    breakTimeDisplay: '5 min',
    origin: 'Developed by Francesco Cirillo in the late 1980s.',
    description: 'Work in 25-minute sprints separated by 5-minute recovery breaks. Take a 15-minute break after four cycles.',
    bestFor: [
      'Procrastination & inertia',
      'Flashcards & review',
      'Reading & problem sets',
    ],
    howItWorks: [
      'Choose one clear task.',
      'Focus for 25 minutes.',
      'Take a 5-minute break.',
      'Take a 15-minute break every 4 cycles.',
    ],
    autoShifts: true,
    scienceNote: 'Short, regular breaks stave off fatigue and sustain attention.',
    accentColor: 'var(--color-accent-focus)', // warm terracotta
  },
  {
    id: 'flowtime',
    name: 'Flowtime Technique',
    subtitle: 'Flexible deep work',
    tagline: 'Work freely, rest proportionally',
    focusTimeDisplay: 'Flexible',
    breakTimeDisplay: '5–20 min',
    origin: 'Created by productivity researcher Zoë Readhead.',
    description: 'Work uninterrupted until focus naturally slips, then take a scientifically scaled rest break.',
    bestFor: [
      'Coding & debugging',
      'Writing & research',
      'Complex problem-solving',
    ],
    howItWorks: [
      'Start the stopwatch and focus on your task.',
      'Work as long as your attention stays sharp.',
      'Click break when you notice fatigue.',
      'Take your earned, proportional rest.',
    ],
    autoShifts: false,
    scienceNote: 'Protects deep flow by avoiding arbitrary timer interruptions.',
    accentColor: 'var(--color-accent-break)', // warm sage green
  },
  {
    id: 'ninety-min',
    name: '90-Minute Work Cycle',
    subtitle: 'Ultradian rhythm',
    tagline: '90 min peak focus, 20 min rest',
    focusTimeDisplay: '90 min',
    breakTimeDisplay: '20 min',
    origin: 'Pioneered by sleep and rhythm researcher Nathan Kleitman.',
    description: 'Align study blocks with natural 90-minute biological energy waves followed by deep recovery.',
    bestFor: [
      'Practice exams & tests',
      'Thesis & report drafts',
      'Deep concept synthesis',
    ],
    howItWorks: [
      'Minutes 0–15: Warm up and settle in.',
      'Minutes 15–75: Peak output and analytical focus.',
      'Minutes 75–90: Wrap up and consolidate notes.',
      'Minutes 90–110: 20-minute genuine break away from screens.',
    ],
    autoShifts: true,
    scienceNote: 'Matches biological rest-activity cycles to replenish neural energy.',
    accentColor: 'var(--color-accent-deep)', // warm earthen bronze
  },
  {
    id: 'time-boxing',
    name: 'Time Boxing',
    subtitle: 'Scheduled blocks',
    tagline: 'Fixed time windows for each task',
    focusTimeDisplay: 'Custom Blocks',
    breakTimeDisplay: 'Built-in Buffers',
    origin: 'Endorsed by Harvard Business Review as a top productivity system.',
    description: 'Assign dedicated time blocks to each task on your agenda so work finishes within set boundaries.',
    bestFor: [
      'Multi-subject study days',
      'Tight daily schedules',
      'Open-ended projects',
    ],
    howItWorks: [
      'List tasks and allocate time for each.',
      'Add short rest buffers between blocks.',
      'Focus strictly on the active box.',
      'Auto-shift to the next block when time is up.',
    ],
    autoShifts: true,
    scienceNote: 'Leverages Parkinson’s Law: tasks shrink to fit allotted time boundaries.',
    accentColor: 'var(--color-accent-box)', // warm amber
  },
  {
    id: 'fifty-two-seventeen',
    name: 'The 52/17 Rule',
    subtitle: 'Empirical sprint ratio',
    tagline: '52 min sprint, 17 min offline rest',
    focusTimeDisplay: '52 min',
    breakTimeDisplay: '17 min',
    origin: 'Discovered in a DeskTime study tracking top performers.',
    description: 'Sprint with intense focus for 52 minutes, then completely unplug for 17 minutes.',
    bestFor: [
      'Intense study sprints',
      'Lab reports & essays',
      'Preventing screen fatigue',
    ],
    howItWorks: [
      'Focus on one task for 52 minutes.',
      'Step completely away when the timer rings.',
      'Spend 17 minutes offline (stretch, walk, hydrate).',
      'Return fully recharged for the next sprint.',
    ],
    autoShifts: true,
    scienceNote: '17 minutes offline resets executive attention without causing sluggishness.',
    accentColor: 'var(--color-accent-sprint)', // warm muted slate blue
  },
];
