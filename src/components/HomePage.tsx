import { useState } from 'react';
import { STUDY_METHODS } from '../data/studyMethods';
import { StudyMethodId } from '../types';
import { MethodCard } from './MethodCard';
import { BookOpen, Compass, Check, ArrowRight, Sparkles, SlidersHorizontal } from 'lucide-react';

interface HomePageProps {
  onSelectMethod: (id: StudyMethodId) => void;
}

export function HomePage({ onSelectMethod }: HomePageProps) {
  const [selectedGoalFilter, setSelectedGoalFilter] = useState<string>('all');

  const filterScenarios = [
    { id: 'all', label: 'All Methods' },
    { id: 'procrastination', label: 'Overcoming Inertia / Flashcards', recommendedId: 'pomodoro' as StudyMethodId },
    { id: 'deep-flow', label: 'Coding & Thesis Writing', recommendedId: 'flowtime' as StudyMethodId },
    { id: 'multi-subject', label: 'Multi-Task Daily Agenda', recommendedId: 'time-boxing' as StudyMethodId },
    { id: 'endurance', label: 'Long Exam Prep & High Output', recommendedId: 'ninety-min' as StudyMethodId },
    { id: 'burnout', label: 'Preventing Screen Fatigue', recommendedId: 'fifty-two-seventeen' as StudyMethodId },
  ];

  return (
    <div id="homepage-container" className="max-w-6xl mx-auto space-y-12 pb-16">
      {/* Warm Minimal Hero */}
      <section className="text-center pt-4 sm:pt-8 max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#EFECE6] text-[#44403C] border border-[#DDD7CD]">
          <Sparkles className="w-3.5 h-3.5 text-[#C86D51]" />
          <span>Distraction-Free Study Methods & Timers</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium text-[#1C1917] tracking-tight">
          Calm, Structured Focus for Deep Learning
        </h1>

        <p className="text-sm sm:text-base text-[#57534E] leading-relaxed font-sans max-w-2xl mx-auto">
          Explore proven cognitive study techniques designed for students and professionals. Each method features an interactive timer that counts down your deep work and shifts automatically into restorative breaks.
        </p>

        {/* Quick Goal Helper Filters */}
        <div className="pt-4">
          <div className="text-xs uppercase tracking-wider text-[#78716C] font-medium mb-3 flex items-center justify-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3" />
            <span>Select Your Study Objective</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {filterScenarios.map((filter) => {
              const isActive = selectedGoalFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  id={`filter-${filter.id}-btn`}
                  onClick={() => {
                    setSelectedGoalFilter(filter.id);
                    if (filter.recommendedId) {
                      onSelectMethod(filter.recommendedId);
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#1C1917] text-[#FAF8F5] shadow-xs'
                      : 'bg-[#FFFFFF] text-[#57534E] border border-[#E7E3DC] hover:border-[#D4CEBF] hover:text-[#1C1917]'
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
          <h2 className="text-lg font-medium text-[#1C1917]">
            Study Method Tooling
          </h2>
          <span className="text-xs text-[#78716C]">
            5 Evidence-Based Frameworks
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STUDY_METHODS.map((method) => (
            <MethodCard
              key={method.id}
              method={method}
              onSelect={onSelectMethod}
            />
          ))}
        </div>
      </section>

      {/* Comparison Reference Table */}
      <section className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-semibold text-[#1C1917] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#78716C]" />
            <span>Methods Comparison Cheat Sheet</span>
          </h3>
          <p className="text-xs text-[#78716C] mt-1">
            Compare structure, cognitive mechanism, and transition behavior across methods
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E7E3DC] text-[#78716C] font-medium">
                <th className="py-3 pr-4">Method</th>
                <th className="py-3 px-4">Focus Cadence</th>
                <th className="py-3 px-4">Break Protocol</th>
                <th className="py-3 px-4">Automatic Transition</th>
                <th className="py-3 pl-4">Prime Use Case</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F2EC] text-[#44403C]">
              {STUDY_METHODS.map((m) => (
                <tr key={m.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="py-3 pr-4 font-medium text-[#1C1917]">
                    <button
                      onClick={() => onSelectMethod(m.id)}
                      className="hover:underline text-left inline-flex items-center gap-1.5"
                    >
                      <span>{m.name}</span>
                      <ArrowRight className="w-3 h-3 text-[#78716C]" />
                    </button>
                  </td>
                  <td className="py-3 px-4 font-mono">{m.focusTimeDisplay}</td>
                  <td className="py-3 px-4">{m.breakTimeDisplay}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-[#58705C] font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Auto-shifts
                    </span>
                  </td>
                  <td className="py-3 pl-4 text-[#57534E]">{m.bestFor[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Restorative Break Advice Guide */}
      <section className="bg-[#FAF8F5] border border-[#E7E3DC] rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917]">
          <Compass className="w-4 h-4 text-[#C86D51]" />
          <span>The Science of Effective Rest Between Study Blocks</span>
        </div>
        <p className="text-xs text-[#57534E] leading-relaxed">
          The automatic break timers in this app are designed to protect your neurochemistry. When the timer shifts to break, follow these guidelines to maximize memory consolidation:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white border border-[#E7E3DC] space-y-1">
            <span className="font-semibold text-[#1C1917]">1. Eye & Ciliary Relief</span>
            <p className="text-[#57534E]">Look at an object at least 20 feet away for 20 seconds. This releases optic nerve tension from close-up screen or textbook scanning.</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#E7E3DC] space-y-1">
            <span className="font-semibold text-[#1C1917]">2. Physical Movement</span>
            <p className="text-[#57534E]">Stand up and stretch your hip flexors and shoulders. Even two minutes of movement elevates cerebral blood flow and oxygen delivery.</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-[#E7E3DC] space-y-1">
            <span className="font-semibold text-[#1C1917]">3. Disconnect From Input</span>
            <p className="text-[#57534E]">Avoid phone social media during short breaks. Rapid feeds flood working memory with novel stimuli, preventing synaptic encoding.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
