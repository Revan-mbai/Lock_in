import { useState } from 'react';
import { STUDY_METHODS } from '../data/studyMethods';
import { StudyMethodId } from '../types';
import { MethodCard } from './MethodCard';
import { BookOpen, Compass, Check, Hand, ArrowRight, Sparkles, SlidersHorizontal } from 'lucide-react';

interface HomePageProps {
  onSelectMethod: (id: StudyMethodId) => void;
}

export function HomePage({ onSelectMethod }: HomePageProps) {
  const [selectedGoalFilter, setSelectedGoalFilter] = useState<string>('all');

  const filterScenarios = [
    { id: 'all', label: 'All' },
    { id: 'procrastination', label: 'Quick Sprints', recommendedId: 'pomodoro' as StudyMethodId },
    { id: 'deep-flow', label: 'Deep Flow', recommendedId: 'flowtime' as StudyMethodId },
    { id: 'multi-subject', label: 'Multi-Task', recommendedId: 'time-boxing' as StudyMethodId },
    { id: 'endurance', label: 'Long Sessions', recommendedId: 'ninety-min' as StudyMethodId },
    { id: 'burnout', label: 'Paced 52/17', recommendedId: 'fifty-two-seventeen' as StudyMethodId },
    { id: 'memorising', label: 'Memorising', recommendedId: 'retrieval-practice' as StudyMethodId },
    { id: 'mixed-revision', label: 'Mixed Revision', recommendedId: 'interleaving' as StudyMethodId },
    { id: 'understanding', label: 'Hard Concepts', recommendedId: 'feynman' as StudyMethodId },
  ];

  const activeFilter = filterScenarios.find((f) => f.id === selectedGoalFilter);
  const visibleMethods = activeFilter?.recommendedId
    ? STUDY_METHODS.filter((m) => m.id === activeFilter.recommendedId)
    : STUDY_METHODS;

  return (
    <div id="homepage-container" className="max-w-6xl mx-auto space-y-12 pb-16">
      {/* Warm Minimal Hero */}
      <section className="text-center pt-4 sm:pt-8 max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-surface-muted text-ink-secondary border border-line-strong">
          <Sparkles className="w-3.5 h-3.5 text-accent-focus" />
          <span>Focus & Break Timers</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium text-ink tracking-tight">
          Calm, Structured Focus
        </h1>

        <p className="text-sm sm:text-base text-ink-secondary leading-relaxed font-sans max-w-xl mx-auto">
          Choose a technique, start your focus session, and shift into rest when the timer signals.
        </p>

        {/* Quick Goal Helper Filters */}
        <div className="pt-2">
          <div className="text-xs uppercase tracking-wider text-ink-muted font-medium mb-2.5 flex items-center justify-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3" />
            <span>Filter by Goal</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {filterScenarios.map((filter) => {
              const isActive = selectedGoalFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  id={`filter-${filter.id}-btn`}
                  // Selecting a goal narrows the grid below. It used to jump straight to the
                  // method's timer, so the filter it had just set was never visible and the
                  // grid never actually filtered.
                  onClick={() => setSelectedGoalFilter(isActive ? 'all' : filter.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-ink text-canvas shadow-xs'
                      : 'bg-surface text-ink-secondary border border-line hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Grid of Study Methods */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-ink">
            Study Methods
          </h2>
          <span className="text-xs text-ink-muted">
            {visibleMethods.length === STUDY_METHODS.length
              ? `${STUDY_METHODS.length} Timers`
              : `${visibleMethods.length} of ${STUDY_METHODS.length} Timers`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleMethods.map((method) => (
            <MethodCard
              key={method.id}
              method={method}
              onSelect={onSelectMethod}
            />
          ))}
        </div>
      </section>

      {/* Comparison Reference Table */}
      <section className="bg-surface border border-line rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-ink-muted" />
            <span>Methods Comparison</span>
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Focus cadences, break lengths, and transition behavior
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-ink-muted font-medium">
                <th className="py-2.5 pr-4">Method</th>
                <th className="py-2.5 px-4">Focus</th>
                <th className="py-2.5 px-4">Break</th>
                <th className="py-2.5 px-4">Transition</th>
                <th className="py-2.5 pl-4">Best For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle text-ink-secondary">
              {STUDY_METHODS.map((m) => (
                <tr key={m.id} className="hover:bg-canvas transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-ink">
                    <button
                      onClick={() => onSelectMethod(m.id)}
                      className="hover:underline text-left inline-flex items-center gap-1.5"
                    >
                      <span>{m.name}</span>
                      <ArrowRight className="w-3 h-3 text-ink-muted" />
                    </button>
                  </td>
                  <td className="py-2.5 px-4 font-mono">{m.focusTimeDisplay}</td>
                  <td className="py-2.5 px-4">{m.breakTimeDisplay}</td>
                  <td className="py-2.5 px-4">
                    {/* Read from the method rather than hard-coded: Flowtime deliberately waits
                        for you to decide the block is over, so it never auto-shifts. */}
                    {m.autoShifts ? (
                      <span className="inline-flex items-center gap-1 text-accent-break font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Auto-shifts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-ink-muted font-medium">
                        <Hand className="w-3.5 h-3.5" />
                        You choose
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-4 text-ink-secondary">{m.bestFor[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Restorative Break Advice Guide */}
      <section className="bg-canvas border border-line rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Compass className="w-4 h-4 text-accent-focus" />
          <span>Rest Guidelines</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-surface border border-line space-y-1">
            <span className="font-semibold text-ink">1. Rest Eyes</span>
            <p className="text-ink-secondary">Look 20 feet away to relax eye muscles from screen strain.</p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-line space-y-1">
            <span className="font-semibold text-ink">2. Move & Hydrate</span>
            <p className="text-ink-secondary">Stand up, stretch, and drink a glass of water.</p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-line space-y-1">
            <span className="font-semibold text-ink">3. Unplug</span>
            <p className="text-ink-secondary">Avoid feeds and notifications during short breaks.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
