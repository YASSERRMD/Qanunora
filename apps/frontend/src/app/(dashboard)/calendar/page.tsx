'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  isCompleted: boolean;
  remindAt: string | null;
  legislativeItem?: { id: string; title: string; referenceNumber: string } | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'ALL',
  'REVIEW_DEADLINE',
  'CONSULTATION_DEADLINE',
  'COMMITTEE_MEETING',
  'APPROVAL_DUE',
  'SUBMISSION_DEADLINE',
  'OTHER',
] as const;

const TYPE_COLORS: Record<string, string> = {
  REVIEW_DEADLINE: 'bg-blue-100 text-blue-700 border-blue-200',
  CONSULTATION_DEADLINE: 'bg-amber-100 text-amber-700 border-amber-200',
  COMMITTEE_MEETING: 'bg-purple-100 text-purple-700 border-purple-200',
  APPROVAL_DUE: 'bg-green-100 text-green-700 border-green-200',
  SUBMISSION_DEADLINE: 'bg-red-100 text-red-700 border-red-200',
  OTHER: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_DOT: Record<string, string> = {
  REVIEW_DEADLINE: 'bg-blue-500',
  CONSULTATION_DEADLINE: 'bg-amber-500',
  COMMITTEE_MEETING: 'bg-purple-500',
  APPROVAL_DUE: 'bg-green-500',
  SUBMISSION_DEADLINE: 'bg-red-500',
  OTHER: 'bg-gray-400',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Month Grid ──────────────────────────────────────────────────────────────

function MonthGrid({
  year, month, events,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1),
  );
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = new Map<number, CalendarEvent[]>();
  events.forEach((e) => {
    const d = new Date(e.startDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay.has(day)) eventsByDay.set(day, []);
      eventsByDay.get(day)!.push(e);
    }
  });

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-gray-50">
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Week rows */}
      <div className="grid grid-cols-7 divide-x divide-border">
        {cells.map((day, idx) => (
          <div
            key={idx}
            className={`min-h-[80px] p-1.5 border-b border-border ${day ? '' : 'bg-gray-50/50'}`}
          >
            {day && (
              <>
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${
                    isToday(day)
                      ? 'bg-primary-navy text-white'
                      : 'text-primary-navy'
                  }`}
                >
                  {day}
                </span>
                <div className="space-y-0.5">
                  {(eventsByDay.get(day) ?? []).slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className={`truncate rounded px-1 py-0.5 text-xs font-medium border ${
                        TYPE_COLORS[e.eventType] ?? TYPE_COLORS.OTHER
                      } ${e.isCompleted ? 'opacity-40 line-through' : ''}`}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {(eventsByDay.get(day)?.length ?? 0) > 2 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{(eventsByDay.get(day)?.length ?? 0) - 2} more
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Upcoming Panel ───────────────────────────────────────────────────────────

function UpcomingPanel({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm p-4">
      <h3 className="mb-3 font-semibold text-primary-navy text-sm">Upcoming (7 days)</h3>
      {events.length === 0 && (
        <p className="text-xs text-muted-foreground">No upcoming deadlines.</p>
      )}
      <div className="space-y-3">
        {events.map((e) => (
          <div key={e.id} className="flex gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[e.eventType] ?? 'bg-gray-400'}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary-navy truncate">{e.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.startDate).toLocaleDateString()} ·{' '}
                {e.eventType.replace(/_/g, ' ')}
              </p>
              {e.assignedTo && (
                <p className="text-xs text-muted-foreground">
                  {e.assignedTo.firstName} {e.assignedTo.lastName}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events', year, month, filterType],
    queryFn: async () => {
      const params: Record<string, string> = { startDate, endDate };
      if (filterType !== 'ALL') params.eventType = filterType;
      const res = await apiClient.get('/calendar', { params });
      return res.data;
    },
    staleTime: 30_000,
  });

  const { data: upcoming = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-upcoming'],
    queryFn: async () => (await apiClient.get('/calendar/upcoming')).data,
    staleTime: 30_000,
  });

  const filtered = events.filter((e) => {
    if (filterStatus === 'PENDING') return !e.isCompleted;
    if (filterStatus === 'COMPLETED') return e.isCompleted;
    return true;
  });

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  return (
    <main className="flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-navy">Calendar & Deadlines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track legislative deadlines, meetings, and submission dates
          </p>
        </div>

        <div className="flex gap-6">
          {/* Left: Calendar + Filters */}
          <div className="flex-1 min-w-0">
            {/* Month nav + type filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  ‹
                </button>
                <span className="min-w-[140px] text-center font-semibold text-primary-navy">
                  {MONTHS[month]} {year}
                </span>
                <button
                  onClick={nextMonth}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  ›
                </button>
              </div>

              <div className="flex flex-wrap gap-1">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      filterType === t
                        ? 'bg-primary-navy text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 ml-auto">
                {(['ALL', 'PENDING', 'COMPLETED'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      filterStatus === s
                        ? 'bg-primary-navy text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <MonthGrid year={year} month={month} events={filtered} />

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3">
              {Object.entries(TYPE_COLORS).map(([type]) => (
                <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${TYPE_DOT[type] ?? 'bg-gray-400'}`} />
                  {type.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Upcoming panel */}
          <div className="w-72 shrink-0">
            <UpcomingPanel events={upcoming} />
          </div>
        </div>
      </div>
    </main>
  );
}
