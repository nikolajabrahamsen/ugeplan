import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { resolvePictogramImageUrl } from "../../lib/pictograms";
import { ensureEventsMaterialized, fetchEvents, toggleEventCompleted, type CalendarEvent } from "../../lib/events";
import { addDays, toDateStr, isSameDate } from "../../lib/calendarDates";
import AnalogClock from "../../components/AnalogClock";
import ReminderSetup from "../../components/ReminderSetup";

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

/** Sorterer så begivenheder med klokkeslæt kommer i tidsrækkefølge, resten efter. */
function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.time_of_day && b.time_of_day) return a.time_of_day.localeCompare(b.time_of_day);
    if (a.time_of_day) return -1;
    if (b.time_of_day) return 1;
    return 0;
  });
}

/**
 * Låst "kiosk"-visning for barnet: et rullende vindue på 7 dage fra i dag,
 * som henter begivenheder fra den fælles familiekalender - både dem der
 * gælder specifikt for barnet, og dem der gælder hele familien.
 */
export default function ChildWeeklyView() {
  const { childId } = useParams<{ childId: string }>();
  const [childName, setChildName] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWeek() {
      if (!childId) return;

      const { data: child, error: childError } = await supabase
        .from("children")
        .select("name, family_id")
        .eq("id", childId)
        .single();

      if (!child) {
        setLoadError(childError?.message ?? "Kunne ikke finde barnet på denne enhed.");
        setLoading(false);
        return;
      }
      setChildName(child.name);

      const today = new Date();
      const rangeEnd = addDays(today, 6);

      try {
        await ensureEventsMaterialized(child.family_id, today, rangeEnd);
        const fetched = await fetchEvents(child.family_id, today, rangeEnd);
        setEvents(fetched);
      } catch (err) {
        setEvents([]);
        setLoadError(err instanceof Error ? err.message : "Kunne ikke hente ugeplanen.");
      }
      setLoading(false);
    }
    loadWeek();
  }, [childId]);

  async function handleToggle(event: CalendarEvent) {
    try {
      const newCompletedAt = await toggleEventCompleted(event.id);
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, completed_at: newCompletedAt } : e))
      );
    } catch {
      // stille fejl
    }
  }

  if (loading) return <p className="loading-text">Henter ugeplan...</p>;

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const myEvents = events.filter(
    (e) => e.applies_to_family || (childId ? e.child_ids.includes(childId) : false)
  );

  return (
    <div>
      <Link to="/child" className="child-back-link">
        ← Skift barn
      </Link>
      {childName && <h1 className="child-week-heading">{childName}</h1>}
      <ReminderSetup />
      {loadError && <p className="error">Fejl: {loadError}</p>}
      {!loadError && myEvents.length === 0 && (
        <p className="loading-text">Der er ikke noget på planen de næste 7 dage.</p>
      )}
      <div className="child-week-view">
        {days.map((day) => {
          const dayEvents = sortDayEvents(myEvents.filter((e) => e.event_date === toDateStr(day)));
          if (dayEvents.length === 0) return null;

          const dayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1;
          const isToday = isSameDate(day, today);

          return (
            <section
              key={toDateStr(day)}
              className={`day-column day-${dayIndex} ${isToday ? "is-today" : ""}`}
            >
              <h2>
                {DAY_NAMES[dayIndex]}
                {isToday && <span className="today-badge">I dag</span>}
              </h2>
              <p className="day-column-date">
                {day.toLocaleDateString("da-DK", { day: "numeric", month: "long" })}
              </p>
              <div className="activity-list">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    className={`activity-card ${event.completed_at ? "completed" : ""}`}
                    onClick={() => handleToggle(event)}
                  >
                    {event.time_of_day && (
                      <AnalogClock time={event.time_of_day.slice(0, 5)} size={44} />
                    )}
                    <img
                      src={resolvePictogramImageUrl(event.pictogram_id)}
                      alt=""
                      width={140}
                      height={140}
                    />
                    {event.pictogram_id_2 && (
                      <img
                        src={resolvePictogramImageUrl(event.pictogram_id_2)}
                        alt=""
                        width={140}
                        height={140}
                      />
                    )}
                    <span className="activity-title">
                      {event.time_of_day && (
                        <span className="activity-time">{event.time_of_day.slice(0, 5)}</span>
                      )}
                      {event.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
