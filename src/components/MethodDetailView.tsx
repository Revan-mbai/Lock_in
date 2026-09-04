import { StudyMethodId } from '../types';
import { STUDY_METHODS } from '../data/studyMethods';
import { PomodoroTimer } from './timers/PomodoroTimer';
import { FlowtimeTimer } from './timers/FlowtimeTimer';
import { NinetyMinTimer } from './timers/NinetyMinTimer';
import { TimeBoxingTimer } from './timers/TimeBoxingTimer';
import { FiftyTwoSeventeenTimer } from './timers/FiftyTwoSeventeenTimer';
import { ArrowLeft, BookOpen, Lightbulb, CheckCircle2, ChevronRight } from 'lucide-react';
import { FocusSessionLog } from '../types';

interface MethodDetailViewProps {
  methodId: StudyMethodId;
  onBackToOverview: () => void;
  onSelectMethod: (id: StudyMethodId) => void;
  onSessionComplete: (log: Omit<FocusSessionLog, 'id' | 'completedAt'>) => void;
  soundEnabled: boolean;
  isZenMode: boolean;
}

export function MethodDetailView({
  methodId,
  onBackToOverview,
  onSelectMethod,
  onSessionComplete,
  soundEnabled,
  isZenMode,
}: MethodDetailViewProps) {
  const method = STUDY_METHODS.find((m) => m.id === methodId) || STUDY_METHODS[0];

  const otherMethods = STUDY_METHODS.filter((m) => m.id !== methodId);

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Top Breadcrumb & Back button (hidden in Zen Mode) */}
      {!isZenMode && (
        <div className="flex items-center justify-between">
          <button
            id="back-to-overview-btn"
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Methods</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#A8A29E]">
            <span>Study Methods</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[#44403C] font-medium">{method.name}</span>
          </div>
        </div>
      )}

      {/* Method Intro Heading (hidden or minimized in Zen Mode) */}
      {!isZenMode && (
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#EFECE6] text-[#57534E]">
            <span>{method.focusTimeDisplay} Focus</span>
            <span>&bull;</span>
            <span>{method.breakTimeDisplay} Break</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1C1917]">
            {method.name}
          </h1>

          <p className="text-xs sm:text-sm text-[#57534E]">
            {method.subtitle} &mdash; {method.tagline}
          </p>
        </div>
      )}

      {/* The Interactive Timer Tool (Starts counting down, auto-shifts to break) */}
      <div id="interactive-timer-section">
        {methodId === 'pomodoro' && (
          <PomodoroTimer
            onSessionComplete={onSessionComplete}
            soundEnabled={soundEnabled}
          />
        )}
        {methodId === 'flowtime' && (
          <FlowtimeTimer
            onSessionComplete={onSessionComplete}
            soundEnabled={soundEnabled}
          />
        )}
        {methodId === 'ninety-min' && (
          <NinetyMinTimer
            onSessionComplete={onSessionComplete}
            soundEnabled={soundEnabled}
          />
        )}
        {methodId === 'time-boxing' && (
          <TimeBoxingTimer
            onSessionComplete={onSessionComplete}
            soundEnabled={soundEnabled}
          />
        )}
        {methodId === 'fifty-two-seventeen' && (
          <FiftyTwoSeventeenTimer
            onSessionComplete={onSessionComplete}
            soundEnabled={soundEnabled}
          />
        )}
      </div>

      {/* Educational Context & Methodology Rules (hidden in Zen Mode) */}
      {!isZenMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          {/* How to execute */}
          <div className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-[#1C1917] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#58705C]" />
              <span>Execution Protocol</span>
            </h3>
            <ul className="space-y-2 text-xs text-[#57534E]">
              {method.howItWorks.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-semibold text-[#1C1917] shrink-0">{idx + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cognitive Science Note */}
          <div className="bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-[#1C1917] flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#C86D51]" />
              <span>Cognitive Science & Why It Works</span>
            </h3>
            <p className="text-xs text-[#57534E] leading-relaxed">
              {method.scienceNote}
            </p>
            <div className="pt-2 text-[11px] text-[#78716C] border-t border-[#F5F2EC]">
              <strong className="text-[#44403C]">Origin: </strong>
              {method.origin}
            </div>
          </div>
        </div>
      )}

      {/* Switch to another study method (hidden in Zen Mode) */}
      {!isZenMode && (
        <div className="pt-8 border-t border-[#EAE5DC] space-y-4">
          <div className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">
            Explore Other Study Methods:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {otherMethods.map((om) => (
              <button
                key={om.id}
                id={`switch-to-${om.id}-btn`}
                onClick={() => onSelectMethod(om.id)}
                className="p-3 rounded-xl bg-white border border-[#E7E3DC] hover:border-[#D4CEBF] text-left transition-all hover:bg-[#FAF8F5] shadow-xs"
              >
                <div className="font-medium text-xs text-[#1C1917] truncate">{om.name}</div>
                <div className="text-[11px] text-[#78716C] mt-0.5">{om.focusTimeDisplay} focus</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
