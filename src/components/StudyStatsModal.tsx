import { useEffect, useState } from 'react';
import { FocusSessionLog } from '../types';
import { Clock, CheckCircle, BarChart3, Trash2, X } from 'lucide-react';

interface StudyStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: FocusSessionLog[];
  onClearLogs: () => void;
}

export function StudyStatsModal({ isOpen, onClose, logs, onClearLogs }: StudyStatsModalProps) {
  // "Clear" is unrecoverable, so it asks once before wiping the history.
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!isOpen) setConfirmingClear(false);
  }, [isOpen]);

  // Close on Escape and stop the page behind the dialog from scrolling while it is open.
  // Declared before the early return so the hook order stays stable.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Every heading in this modal says "Today", and the header's focus counter is today-only,
  // so scope the figures to today instead of reporting the whole stored history.
  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(
    (log) => new Date(log.completedAt).toDateString() === todayStr
  );

  const workLogs = todayLogs.filter((log) => log.phase === 'work');
  const totalFocusMinutes = workLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
  const workSessionsCount = workLogs.length;

  // Breakdown by method
  const methodBreakdown = workLogs.reduce((acc, log) => {
    acc[log.methodName] = (acc[log.methodName] || 0) + log.durationMinutes;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="study-stats-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Today's focus log"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-xl overflow-hidden text-ink"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-track flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent-focus" />
            <h3 className="font-semibold text-sm">Today's Focus Log</h3>
          </div>
          <button
            id="close-stats-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-faint hover:text-ink-body hover:bg-canvas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs">
          {/* Top summary metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-ink-muted mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Focus Time</span>
              </div>
              <div className="text-2xl font-mono font-semibold text-ink">
                {totalFocusMinutes} <span className="text-xs font-sans font-normal text-ink-muted">mins</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-line">
              <div className="text-ink-muted mb-1 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-accent-break" />
                <span>Sessions</span>
              </div>
              <div className="text-2xl font-mono font-semibold text-ink">
                {workSessionsCount} <span className="text-xs font-sans font-normal text-ink-muted">completed</span>
              </div>
            </div>
          </div>

          {/* Breakdown by method */}
          {Object.keys(methodBreakdown).length > 0 && (
            <div className="space-y-2">
              <span className="font-semibold text-ink-body">Distribution:</span>
              <div className="space-y-2">
                {Object.entries(methodBreakdown).map(([name, mins]) => {
                  const percent = Math.round((mins / (totalFocusMinutes || 1)) * 100);
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex justify-between text-ink-secondary">
                        <span>{name}</span>
                        <span className="font-mono">{mins}m ({percent}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-track overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-ink" 
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
              <span className="font-semibold text-ink-body">Today's Activity:</span>
              {todayLogs.length > 0 &&
                (confirmingClear ? (
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="text-ink-muted">Delete today's {todayLogs.length} entries?</span>
                    <button
                      id="clear-logs-confirm-btn"
                      onClick={() => {
                        onClearLogs();
                        setConfirmingClear(false);
                      }}
                      className="font-semibold text-accent-danger hover:underline"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmingClear(false)}
                      className="text-ink-faint hover:text-ink-body"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    id="clear-logs-btn"
                    onClick={() => setConfirmingClear(true)}
                    className="text-[11px] text-ink-faint hover:text-accent-danger flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                ))}
            </div>

            {todayLogs.length === 0 ? (
              <div className="p-8 text-center text-ink-faint border border-dashed border-line rounded-xl">
                No sessions recorded today.
              </div>
            ) : (
              <div className="space-y-2">
                {todayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-ink">{log.taskTitle}</div>
                      <div className="text-[11px] text-ink-muted">{log.methodName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium text-ink">+{log.durationMinutes} min</div>
                      <div className="text-[10px] text-ink-faint">{new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-track bg-canvas flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-ink text-canvas text-xs font-medium hover:bg-ink-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
