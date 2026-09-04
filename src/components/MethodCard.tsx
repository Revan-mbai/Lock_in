import { ArrowRight, Clock, Coffee, Sparkles } from 'lucide-react';
import { StudyMethodInfo, StudyMethodId } from '../types';

interface MethodCardProps {
  key?: string;
  method: StudyMethodInfo;
  onSelect: (id: StudyMethodId) => void;
}

export function MethodCard({ method, onSelect }: MethodCardProps) {
  return (
    <div
      id={`method-card-${method.id}`}
      className="group bg-[#FFFFFF] border border-[#E7E3DC] hover:border-[#D4CEBF] rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-sm relative overflow-hidden"
    >
      <div>
        {/* Method Header & Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-semibold text-[#1C1917] tracking-tight group-hover:text-[#000000] transition-colors">
              {method.name}
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5 font-serif italic">
              {method.subtitle}
            </p>
          </div>
          <span 
            className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
            style={{ backgroundColor: method.accentColor }}
          />
        </div>

        {/* Focus & Break Badges */}
        <div className="flex flex-wrap items-center gap-2 my-4">
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
        <div className="space-y-1.5 mb-6">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#78716C]">
            Ideal For:
          </div>
          <ul className="space-y-1">
            {method.bestFor.slice(0, 3).map((item, idx) => (
              <li key={idx} className="text-xs text-[#44403C] flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#A8A29E]" />
                <span className="line-clamp-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-[#F5F2EC] flex items-center justify-between">
        <span className="text-[11px] text-[#78716C]">
          Automatic break shift
        </span>
        <button
          id={`launch-method-${method.id}-btn`}
          onClick={() => onSelect(method.id)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-[#FAF8F5] bg-[#1C1917] hover:bg-[#2E2A27] transition-all shadow-xs group-hover:translate-x-0.5"
        >
          <span>Open Tool</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
