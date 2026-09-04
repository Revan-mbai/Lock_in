import { FocusSessionLog } from '../types';
import { Clock, CheckCircle, BarChart3, Trash2, X } from 'lucide-react';

interface StudyStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: FocusSessionLog[];
  onClearLogs: () => void;
}

export function StudyStatsModal({ isOpen, onClose, logs, onClearLogs }: StudyStatsModalProps) {
  if (!isOpen) return null;

  const totalFocusMinutes = logs.reduce((sum, log) => sum + log.durationMinutes, 0);
  const workSessionsCount = logs.filter(log => log.phase === 'work').length;

  // Breakdown by method
  const methodBreakdown = logs.reduce((acc, log) => {
    acc[log.methodName] = (acc[log.methodName] || 0) + log.durationMinutes;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
      <div 
        id="study-stats-modal"
        className="w-full max-w-lg bg-[#FFFFFF] border border-[#E7E3DC] rounded-2xl shadow-xl overflow-hidden text-[#1C1917]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#F0ECE4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#C86D51]" />
            <h3 className="font-semibold text-sm">Today's Focus & Study Log</h3>
          </div>
          <button
            id="close-stats-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-[#A8A29E] hover:text-[#292524] hover:bg-[#FAF8F5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs">
          {/* Top summary metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC]">
              <div className="text-[#78716C] mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Total Focus Time</span>
              </div>
              <div className="text-2xl font-mono font-semibold text-[#1C1917]">
                {totalFocusMinutes} <span className="text-xs font-sans font-normal text-[#78716C]">mins</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC]">
              <div className="text-[#78716C] mb-1 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#58705C]" />
                <span>Completed Sprints</span>
              </div>
              <div className="text-2xl font-mono font-semibold text-[#1C1917]">
                {workSessionsCount} <span className="text-xs font-sans font-normal text-[#78716C]">blocks</span>
              </div>
            </div>
          </div>

          {/* Breakdown by method */}
          {Object.keys(methodBreakdown).length > 0 && (
            <div className="space-y-2">
              <span className="font-semibold text-[#292524]">Study Method Distribution:</span>
              <div className="space-y-2">
                {Object.entries(methodBreakdown).map(([name, mins]) => {
                  const percent = Math.round((mins / (totalFocusMinutes || 1)) * 100);
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex justify-between text-[#57534E]">
                        <span>{name}</span>
                        <span className="font-mono">{mins}m ({percent}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#F0ECE4] overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-[#1C1917]" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity timeline list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#292524]">Completed Blocks Today:</span>
              {logs.length > 0 && (
                <button
                  id="clear-logs-btn"
                  onClick={onClearLogs}
                  className="text-[11px] text-[#A8A29E] hover:text-[#DC2626] flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center text-[#A8A29E] border border-dashed border-[#E7E3DC] rounded-xl">
                No focus sessions logged yet today. Pick a study method and hit Start!
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E3DC] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-[#1C1917]">{log.taskTitle}</div>
                      <div className="text-[11px] text-[#78716C]">{log.methodName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium text-[#1C1917]">+{log.durationMinutes} min</div>
                      <div className="text-[10px] text-[#A8A29E]">{new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#F0ECE4] bg-[#FAF8F5] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1C1917] text-[#FAF8F5] text-xs font-medium hover:bg-[#2E2A27]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
