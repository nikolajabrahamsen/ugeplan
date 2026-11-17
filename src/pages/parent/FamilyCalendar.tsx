import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrCreateFamily } from "../../lib/family";
import {
  listChildren,
  ensureEventsMaterialized,
  fetchEvents,
  toggleEventCompleted,
  clearFamilyCalendar,
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
  addDays,
  isoWeekday,
  MONTH_NAMES,
  DAY_NAMES_SHORT
} from "../../lib/calendarDates";
import EventForm from "../../components/EventForm";

export default function FamilyCalendar() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<CalendarChild[]>([]);
  const [view, setView] = useState<"month" | "week">(() => {
    try {
      return localStorage.getItem("calendarView") === "week" ? "week" : "month";
    } catch {
      return "month";
    }
  });
  const [anchor, setAnchor] = useState(new Date());
  const year = anchor.getFullYear();
  const month = anchor.getMonth(); // 0-11
  const weekStart = addDays(anchor, -isoWeekday(anchor));
  const weekEnd = addDays(weekStart, 6);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [clearStep, setClearStep] = useState<0 | 1>(0);
  const [clearText, setClearText] = useState("");
  const [clearing, setClearing] = useState(false);

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
      const rangeStart = view === "week" ? weekStart : startOfMonth(year, month);
      const rangeEnd = view === "week" ? weekEnd : endOfMonth(year, month);
      await ensureEventsMaterialized(fid, rangeStart, rangeEnd);
      setEvents(await fetchEvents(fid, rangeStart, rangeEnd));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente kalenderen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (familyId) loadMonth(familyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, view, toDateStr(anchor)]);

  function goToPrevious() {
    if (view === "week") {
      setAnchor((d) => addDays(d, -7));
    } else {
      setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }
  }

  function goToNext() {
    if (view === "week") {
      setAnchor((d) => addDays(d, 7));
    } else {
      setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }
  }

  function goToToday() {
    setAnchor(new Date());
  }

  function changeView(next: "month" | "week") {
    setView(next);
    try {
      localStorage.setItem("calendarView", next);
    } catch {
      // ikke kritisk
    }
  }

  function setYear(y: number) {
    setAnchor((d) => new Date(y, d.getMonth(), 1));
  }

  function isoWeekNumber(d: Date): number {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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

  async function handleClearCalendar() {
    if (!familyId || clearText.trim().toUpperCase() !== "SLET") return;
    setClearing(true);
    setError(null);
    try {
      await clearFamilyCalendar(familyId);
      setClearStep(0);
      setClearText("");
      setSelectedDate(null);
      await loadMonth(familyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke rydde kalenderen");
    } finally {
      setClearing(false);
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
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/parent" className="back-link">
          ← Oversigt
        </Link>
        <h1>Familiekalender</h1>
      </header>

      <div className="calendar-view-toggle">
        <button
          type="button"
          className={`btn btn-small ${view === "month" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => changeView("month")}
        >
          Måned
        </button>
        <button
          type="button"
          className={`btn btn-small ${view === "week" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => changeView("week")}
        >
          Uge
        </button>
      </div>

      <div className="calendar-nav">
        <button type="button" className="btn-icon" onClick={goToPrevious}>
          ← Forrige
        </button>
        <div className="calendar-nav-center">
          <span className="calendar-month-label">
            {view === "week"
              ? `Uge ${isoWeekNumber(weekStart)} · ${weekStart.getDate()}. ${MONTH_NAMES[weekStart.getMonth()].toLowerCase()}${
                  weekEnd.getMonth() !== weekStart.getMonth()
                    ? ` – ${weekEnd.getDate()}. ${MONTH_NAMES[weekEnd.getMonth()].toLowerCase()}`
                    : ` – ${weekEnd.getDate()}.`
                } ${weekEnd.getFullYear()}`
              : `${MONTH_NAMES[month]} ${year}`}
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
        <button type="button" className="btn-icon" onClick={goToNext}>
          Næste →
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading-text">Henter...</p>}

      {view === "month" && (
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

      )}

      {view === "week" && (
        <div className="week-grid">
          {weekDays.map((day) => {
            const dayEvents = events
              .filter((e) => e.event_date === toDateStr(day))
              .sort((x, y) => (x.time_of_day ?? "99").localeCompare(y.time_of_day ?? "99"));
            const isToday = isSameDate(day, today);
            return (
              <div key={toDateStr(day)} className={`week-day ${isToday ? "is-today" : ""}`}>
                <button
                  type="button"
                  className="week-day-header"
                  onClick={() => {
                    setSelectedDate(day);
                    setEditingEvent(null);
                  }}
                >
                  <strong>{DAY_NAMES_SHORT[isoWeekday(day)]}</strong>
                  <span>{day.getDate()}. {MONTH_NAMES[day.getMonth()].toLowerCase().slice(0, 3)}</span>
                </button>
                <div className="week-day-events">
                  {dayEvents.map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className={`week-event ${event.completed_at ? "completed" : ""}`}
                      onClick={() => {
                        setSelectedDate(day);
                        setEditingEvent(event);
                      }}
                    >
                      <span className="week-event-pictos">
                        <img src={resolvePictogramImageUrl(event.pictogram_id, 300)} alt="" />
                        {event.pictogram_id_2 && (
                          <img src={resolvePictogramImageUrl(event.pictogram_id_2, 300)} alt="" />
                        )}
                      </span>
                      <span className="week-event-title">
                        {event.time_of_day && (
                          <span className="week-event-time">{event.time_of_day.slice(0, 5)} </span>
                        )}
                        {event.title}
                      </span>
                      <span className="week-event-who">{childNames(event)}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="week-add"
                    onClick={() => {
                      setSelectedDate(day);
                      setEditingEvent({} as CalendarEvent);
                    }}
                  >
                    + Tilføj
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="danger-zone">
        {clearStep === 0 ? (
          <button type="button" className="btn btn-danger btn-small" onClick={() => setClearStep(1)}>
            Ryd hele kalenderen
          </button>
        ) : (
          <div className="danger-confirm">
            <p>
              <strong>Det sletter alle begivenheder og gentagelser for hele familien, for alle børn og alle datoer.</strong>{" "}
              Det kan ikke fortrydes. Skriv <strong>SLET</strong> for at bekræfte.
            </p>
            <input
              type="text"
              value={clearText}
              onChange={(e) => setClearText(e.target.value)}
              placeholder="SLET"
              autoComplete="off"
            />
            <div className="danger-confirm-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={clearing || clearText.trim().toUpperCase() !== "SLET"}
                onClick={handleClearCalendar}
              >
                {clearing ? "Rydder..." : "Ryd kalenderen for altid"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={clearing}
                onClick={() => {
                  setClearStep(0);
                  setClearText("");
                }}
              >
                Annuller
              </button>
            </div>
          </div>
        )}
      </section>

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
