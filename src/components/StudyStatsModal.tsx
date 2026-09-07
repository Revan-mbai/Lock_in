import { useEffect, useRef, useState } from 'react';
import { FocusSessionLog } from '../types';
import { Clock, CheckCircle, BarChart3, Trash2, X, CalendarDays } from 'lucide-react';

interface StudyStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: FocusSessionLog[];
  /** Removes exactly these entries. The modal decides the scope; see handleDeleteEntries. */
  onDeleteEntries: (ids: string[]) => void;
}

type Range = 'today' | 'week' | 'all';

const RANGES: { id: Range; label: string; days: number | null }[] = [
  { id: 'today', label: 'Today', days: 1 },
  { id: 'week', label: 'Last 7 days', days: 7 },
  { id: 'all', label: 'All time', days: null },
];

/** Start of the day `daysAgo` days back, so ranges land on day boundaries rather than -24h. */
function startOfDaysAgo(daysAgo: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}

export function StudyStatsModal({ isOpen, onClose, logs, onDeleteEntries }: StudyStatsModalProps) {
  const [range, setRange] = useState<Range>('today');
  // Deleting is unrecoverable, so the bulk action asks once.
  const [confirmingClear, setConfirmingClear] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmingClear(false);
      setRange('today');
    }
  }, [isOpen]);

  // Changing range while a delete is pending would apply the confirmation to a different set.
  useEffect(() => {
    setConfirmingClear(false);
  }, [range]);

  // Keep focus inside the dialog and give it back to whatever opened it. Without this, tabbing
  // walks straight out into the page behind, which for a keyboard or screen-reader user means
  // the dialog is not really modal.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null || el.offsetHeight > 0)
        : [];

    focusables()[0]?.focus();

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      opener?.focus?.();
    };
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

  const activeRange = RANGES.find((r) => r.id === range) ?? RANGES[0];
  const cutoff = activeRange.days === null ? null : startOfDaysAgo(activeRange.days - 1);
  const visibleLogs = logs.filter((log) => {
    if (cutoff === null) return true;
    const at = new Date(log.completedAt).getTime();
    return Number.isFinite(at) && at >= cutoff;
  });

  const workLogs = visibleLogs.filter((log) => log.phase === 'work');
  const totalFocusMinutes = workLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
  const workSessionsCount = workLogs.length;

  const methodBreakdown = workLogs.reduce((acc, log) => {
    acc[log.methodName] = (acc[log.methodName] || 0) + log.durationMinutes;
    return acc;
  }, {} as Record<string, number>);

  // Minutes per day, oldest first — a small trend read that "today only" could never show.
  const dailyTotals = (() => {
    if (range === 'today') return [];
    const days = activeRange.days ?? 30;
    const buckets: { label: string; minutes: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = startOfDaysAgo(i);
      const end = start + 24 * 60 * 60 * 1000;
      const minutes = workLogs
        .filter((log) => {
          const at = new Date(log.completedAt).getTime();
          return at >= start && at < end;
        })
        .reduce((sum, log) => sum + log.durationMinutes, 0);
      buckets.push({
        label: new Date(start).toLocaleDateString([], { weekday: 'short' }),
        minutes,
      });
    }
    return buckets;
  })();
  const peakDay = Math.max(1, ...dailyTotals.map((d) => d.minutes));

  const rangeNoun = range === 'today' ? 'today' : range === 'week' ? 'this week' : 'in total';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="study-stats-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Focus log"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-xl overflow-hidden text-ink"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-track flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent-focus" />
            <h3 className="font-semibold text-sm">Focus Log</h3>
          </div>
          <button
            id="close-stats-modal-btn"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-ink-faint hover:text-ink-body hover:bg-canvas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Range selector */}
        <div className="px-6 pt-4 flex items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              id={`stats-range-${r.id}-btn`}
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                range === r.id
                  ? 'bg-ink text-canvas'
                  : 'bg-surface-subtle text-ink-secondary hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto text-xs">
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

          {/* Per-day trend, for the ranges where it means something */}
          {dailyTotals.length > 1 && (
            <div className="space-y-2">
              <span className="font-semibold text-ink-body flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-ink-muted" />
                Daily focus
              </span>
              <div className="flex items-end gap-1.5 h-24">
                {dailyTotals.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10px] font-mono text-ink-muted">
                      {day.minutes > 0 ? day.minutes : ''}
                    </span>
                    <div
                      className={`w-full rounded-t ${day.minutes > 0 ? 'bg-accent-focus' : 'bg-track'}`}
                      style={{ height: `${Math.max(day.minutes > 0 ? 6 : 2, (day.minutes / peakDay) * 100)}%` }}
                      title={`${day.label}: ${day.minutes} min`}
                    />
                    <span className="text-[10px] text-ink-muted truncate w-full text-center">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(methodBreakdown).length > 0 && (
            <div className="space-y-2">
              <span className="font-semibold text-ink-body">Distribution:</span>
              <div className="space-y-2">
                {Object.entries(methodBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, mins]) => {
                    const percent = Math.round((mins / (totalFocusMinutes || 1)) * 100);
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex justify-between text-ink-secondary">
                          <span>{name}</span>
                          <span className="font-mono">
                            {mins}m ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-track overflow-hidden">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Activity list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-ink-body">
                Activity {range === 'today' ? 'today' : range === 'week' ? 'this week' : ''}:
              </span>
              {visibleLogs.length > 0 &&
                (confirmingClear ? (
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="text-ink-muted">Delete these {visibleLogs.length}?</span>
                    <button
                      id="clear-logs-confirm-btn"
                      onClick={() => {
                        onDeleteEntries(visibleLogs.map((l) => l.id));
                        setConfirmingClear(false);
                      }}
                      className="font-semibold text-accent-danger hover:underline"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmingClear(false)}
                      className="text-ink-muted hover:text-ink-body"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    id="clear-logs-btn"
                    onClick={() => setConfirmingClear(true)}
                    className="text-[11px] text-ink-muted hover:text-accent-danger flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear shown</span>
                  </button>
                ))}
            </div>

            {visibleLogs.length === 0 ? (
              <div className="p-8 text-center text-ink-muted border border-dashed border-line rounded-xl">
                No sessions recorded {rangeNoun}.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleLogs.map((log) => (
                  <div
                    key={log.id}
                    className="group p-3 rounded-xl bg-canvas border border-line flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{log.taskTitle}</div>
                      <div className="text-[11px] text-ink-muted">{log.methodName}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-mono font-medium text-ink">+{log.durationMinutes} min</div>
                        <div className="text-[10px] text-ink-muted">
                          {new Date(log.completedAt).toLocaleString([], {
                            weekday: range === 'today' ? undefined : 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      {/* A single mis-logged session used to be uncorrectable without wiping
                          the whole day. */}
                      <button
                        onClick={() => onDeleteEntries([log.id])}
                        title={`Delete "${log.taskTitle}"`}
                        aria-label={`Delete ${log.taskTitle}, ${log.durationMinutes} minutes`}
                        className="p-1.5 rounded-lg text-ink-faint hover:text-accent-danger hover:bg-surface-hover transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
