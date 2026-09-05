import { useState, useEffect } from 'react';
import { ArrowRight, Clock, Coffee } from 'lucide-react';
import { StudyMethodInfo, StudyMethodId } from '../types';
import { getTimerSummaries } from '../utils/timerPersistence';
import { formatTime } from '../utils/formatters';

interface MethodCardProps {
  key?: string;
  method: StudyMethodInfo;
  onSelect: (id: StudyMethodId) => void;
}

export function MethodCard({ method, onSelect }: MethodCardProps) {
  const [summary, setSummary] = useState(() => getTimerSummaries()[method.id]);

  useEffect(() => {
    const update = () => {
      const summaries = getTimerSummaries();
      setSummary(summaries[method.id]);
    };
    window.addEventListener('study_timers_changed', update);
    window.addEventListener('storage', update);
    const interval = setInterval(update, 1000);
    return () => {
      window.removeEventListener('study_timers_changed', update);
      window.removeEventListener('storage', update);
      clearInterval(interval);
    };
  }, [method.id]);

  const isRunning = summary?.isRunning;
  const remainingSec = summary?.remainingSeconds || 0;

  return (
    <div
      id={`method-card-${method.id}`}
      className={`group bg-[#FFFFFF] border rounded-2xl p-5 sm:p-6 transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-sm relative overflow-hidden ${
        isRunning ? 'border-[#3D7A52] ring-1 ring-[#3D7A52]/20' : 'border-[#E7E3DC] hover:border-[#D4CEBF]'
      }`}
    >
      <div>
        {/* Method Header & Badges */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-[#1C1917] tracking-tight group-hover:text-[#000000] transition-colors">
                {method.name}
              </h3>
              {isRunning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#E2EBE4] text-[#2D5A3C] font-semibold border border-[#C5D8C9]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3D7A52] animate-pulse" />
                  {formatTime(remainingSec)}
                </span>
              )}
            </div>
            <p className="text-xs text-[#78716C] mt-0.5">
              {method.subtitle}
            </p>
          </div>
          <span 
            className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
            style={{ backgroundColor: method.accentColor }}
          />
        </div>

        {/* Focus & Break Badges */}
        <div className="flex flex-wrap items-center gap-2 my-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#E7E3DC] text-xs text-[#44403C]">
            <Clock className="w-3.5 h-3.5 text-[#78716C]" />
            <span className="font-medium">{method.focusTimeDisplay}</span>
            <span className="text-[#A8A29E]">focus</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F5F7F5] border border-[#DCE4DC] text-xs text-[#44403C]">
            <Coffee className="w-3.5 h-3.5 text-[#58705C]" />
            <span className="font-medium">{method.breakTimeDisplay}</span>
            <span className="text-[#A8A29E]">break</span>
          </div>
        </div>

        {/* Short Description */}
        <p className="text-xs text-[#57534E] leading-relaxed mb-4">
          {method.description}
        </p>

        {/* Best For Tags */}
        <div className="space-y-1.5 mb-5">
          <div className="flex flex-wrap gap-1.5">
            {method.bestFor.map((item, idx) => (
              <span
                key={idx}
                className="inline-block px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#EAE5DC] text-[11px] text-[#57534E]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-[#F5F2EC] flex items-center justify-between">
        <span className="text-[11px] text-[#A8A29E]">
          {method.tagline}
        </span>
        <button
          id={`launch-method-${method.id}-btn`}
          onClick={() => onSelect(method.id)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shadow-xs group-hover:translate-x-0.5 ${
            isRunning 
              ? 'text-[#FFFFFF] bg-[#2D5A3C] hover:bg-[#23472F]' 
              : 'text-[#FAF8F5] bg-[#1C1917] hover:bg-[#2E2A27]'
          }`}
        >
          <span>{isRunning ? 'Resume' : 'Start'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
