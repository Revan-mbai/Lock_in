import { StudyMethodId } from '../types';
import { STUDY_METHODS } from '../data/studyMethods';
import { PomodoroTimer } from './timers/PomodoroTimer';
import { FlowtimeTimer } from './timers/FlowtimeTimer';
import { NinetyMinTimer } from './timers/NinetyMinTimer';
import { TimeBoxingTimer } from './timers/TimeBoxingTimer';
import { FiftyTwoSeventeenTimer } from './timers/FiftyTwoSeventeenTimer';
import { RetrievalPracticeTimer } from './timers/RetrievalPracticeTimer';
import { InterleavingTimer } from './timers/InterleavingTimer';
import { FeynmanTimer } from './timers/FeynmanTimer';
import { ArrowLeft, Lightbulb, CheckCircle2, ChevronRight } from 'lucide-react';
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
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Top Breadcrumb & Back button (hidden in Zen Mode) */}
      {!isZenMode && (
        <div className="flex items-center justify-between">
          <button
            id={`back-to-overview-btn-${methodId}`}
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Methods</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-faint">
            <span>Methods</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-ink-secondary font-medium">{method.name}</span>
          </div>
        </div>
      )}

      {/* Method Intro Heading (hidden or minimized in Zen Mode) */}
      {!isZenMode && (
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-surface-muted text-ink-secondary">
            <span>{method.focusTimeDisplay} Focus</span>
            <span>&bull;</span>
            <span>{method.breakTimeDisplay} Break</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-ink">
            {method.name}
          </h1>

          <p className="text-xs sm:text-sm text-ink-secondary">
            {method.tagline}
          </p>
        </div>
      )}

      {/* The Interactive Timer Tool */}
      <div id={`interactive-timer-section-${methodId}`}>
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
        {methodId === 'retrieval-practice' && (
          <RetrievalPracticeTimer
            onSessionComplete={onSessionComplete}
            soundEnabled={soundEnabled}
          />
        )}
        {methodId === 'interleaving' && (
          <InterleavingTimer
            onSessionComplete={onSessionComplete}
            soundEnabled={soundEnabled}
          />
        )}
        {methodId === 'feynman' && (
          <FeynmanTimer
            onSessionComplete={onSessionComplete}
            soundEnabled={soundEnabled}
          />
        )}
      </div>

      {/* Educational Context & Methodology Rules (hidden in Zen Mode) */}
      {!isZenMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
          {/* How to execute */}
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-2.5">
            <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-break" />
              <span>How It Works</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-ink-secondary">
              {method.howItWorks.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-semibold text-ink shrink-0">{idx + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cognitive Science Note */}
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-2.5">
            <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5 uppercase tracking-wider">
              <Lightbulb className="w-3.5 h-3.5 text-accent-focus" />
              <span>Why It Works</span>
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              {method.scienceNote}
            </p>
            <div className="pt-2 text-[11px] text-ink-muted border-t border-line-subtle">
              {method.origin}
            </div>
          </div>
        </div>
      )}

      {/* Switch to another study method (hidden in Zen Mode) */}
      {!isZenMode && (
        <div className="pt-6 border-t border-line space-y-3">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Other Methods
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {otherMethods.map((om) => (
              <button
                key={om.id}
                id={`switch-to-${om.id}-btn`}
                onClick={() => onSelectMethod(om.id)}
                className="p-2.5 rounded-xl bg-surface border border-line hover:border-line-strong text-left transition-all hover:bg-canvas shadow-xs"
              >
                <div className="font-medium text-xs text-ink truncate">{om.name}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">{om.focusTimeDisplay} focus</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
