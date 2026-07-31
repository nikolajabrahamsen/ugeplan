import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrCreateFamily } from "../../lib/family";
import {
  listChildren,
  ensureEventsMaterialized,
  fetchEvents,
  toggleEventCompleted,
  type CalendarChild,
  type CalendarEvent
} from "../../lib/events";
import { resolvePictogramImageUrl } from "../../lib/pictograms";
import {
  buildMonthGrid,
  startOfMonth,
  endOfMonth,
  toDateStr,
  isSameDate,
  MONTH_NAMES,
  DAY_NAMES_SHORT
} from "../../lib/calendarDates";
import EventForm from "../../components/EventForm";

export default function FamilyCalendar() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<CalendarChild[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()); // 0-11
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const family = await getOrCreateFamily();
        setFamilyId(family.id);
        setChildren(await listChildren(family.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Der skete en fejl");
      }
    }
    init();
  }, []);

  async function loadMonth(fid: string) {
    setLoading(true);
    setError(null);
    try {
      const monthStart = startOfMonth(year, month);
      const monthEnd = endOfMonth(year, month);
      await ensureEventsMaterialized(fid, monthStart, monthEnd);
      setEvents(await fetchEvents(fid, monthStart, monthEnd));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente kalenderen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (familyId) loadMonth(familyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, year, month]);

  function goToPreviousMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  async function handleToggleComplete(event: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const newCompletedAt = await toggleEventCompleted(event.id);
      setEvents((prev) =>
        prev.map((ev) => (ev.id === event.id ? { ...ev, completed_at: newCompletedAt } : ev))
      );
    } catch {
      // stille fejl - ikke kritisk nok til at afbryde resten af kalenderen
    }
  }

  function childNames(event: CalendarEvent): string {
    if (event.applies_to_family) return "Hele familien";
    return event.child_ids
      .map((id) => children.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  const grid = buildMonthGrid(year, month);
  const today = new Date();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/parent" className="back-link">
          ← Oversigt
        </Link>
        <h1>Familiekalender</h1>
      </header>

      <div className="calendar-nav">
        <button type="button" className="btn-icon" onClick={goToPreviousMonth}>
          ← Forrige
        </button>
        <div className="calendar-nav-center">
          <span className="calendar-month-label">
            {MONTH_NAMES[month]} {year}
          </span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="calendar-year-select">
            {Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-small" onClick={goToToday}>
            I dag
          </button>
        </div>
        <button type="button" className="btn-icon" onClick={goToNextMonth}>
          Næste →
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading-text">Henter...</p>}

      <div className="month-grid">
        {DAY_NAMES_SHORT.map((label) => (
          <div key={label} className="month-grid-weekday">
            {label}
          </div>
        ))}

        {grid.map((day) => {
          const inMonth = day.getMonth() === month;
          const dayEvents = events.filter((e) => e.event_date === toDateStr(day));
          const isToday = isSameDate(day, today);

          return (
            <button
              type="button"
              key={toDateStr(day)}
              className={`month-day-cell ${inMonth ? "" : "outside-month"} ${isToday ? "is-today" : ""}`}
              onClick={() => {
                setSelectedDate(day);
                setEditingEvent(null);
              }}
            >
              <span className="month-day-number">{day.getDate()}</span>
              <div className="month-day-events">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    className={`month-event-chip ${event.completed_at ? "completed" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate(day);
                      setEditingEvent(event);
                    }}
                  >
                    <img src={resolvePictogramImageUrl(event.pictogram_id, 100)} alt="" />
                    {event.pictogram_id_2 && (
                      <img src={resolvePictogramImageUrl(event.pictogram_id_2, 100)} alt="" />
                    )}
                    {event.title}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="month-event-more">+{dayEvents.length - 3} mere</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDate && !editingEvent && (
        <div className="day-panel-overlay" onClick={() => setSelectedDate(null)}>
          <div className="day-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pictogram-picker-header">
              <h2>
                {selectedDate.toLocaleDateString("da-DK", {
                  weekday: "long",
                  day: "numeric",
                  month: "long"
                })}
              </h2>
              <button type="button" className="btn-icon" onClick={() => setSelectedDate(null)}>
                ✕
              </button>
            </div>
            <ul className="day-panel-list">
              {events
                .filter((e) => e.event_date === toDateStr(selectedDate))
                .map((event) => (
                  <li key={event.id} className="editor-activity">
                    <button
                      type="button"
                      className="editor-activity-edit"
                      onClick={() => setEditingEvent(event)}
                    >
                      <img
                        src={resolvePictogramImageUrl(event.pictogram_id, 300)}
                        alt=""
                        width={48}
                        height={48}
                      />
                      {event.pictogram_id_2 && (
                        <img
                          src={resolvePictogramImageUrl(event.pictogram_id_2, 300)}
                          alt=""
                          width={48}
                          height={48}
                        />
                      )}
                      <span className="editor-activity-text">
                        {event.time_of_day && (
                          <span className="editor-activity-time">{event.time_of_day.slice(0, 5)}</span>
                        )}
                        {event.title}
                        <span className="event-children-label"> · {childNames(event)}</span>
                      </span>
                    </button>
                    <button type="button" className="btn-icon" onClick={(e) => handleToggleComplete(event, e)}>
                      {event.completed_at ? "Fortryd" : "Gjort"}
                    </button>
                  </li>
                ))}
            </ul>
            <button
              type="button"
              className="btn btn-add-activity"
              onClick={() => setEditingEvent({} as CalendarEvent)}
            >
              + Tilføj begivenhed
            </button>
          </div>
        </div>
      )}

      {selectedDate && editingEvent && familyId && (
        <EventForm
          familyId={familyId}
          date={selectedDate}
          children={children}
          editingEvent={editingEvent.id ? editingEvent : null}
          onSaved={() => {
            setEditingEvent(null);
            loadMonth(familyId);
          }}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
