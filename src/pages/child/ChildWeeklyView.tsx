import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { resolvePictogramImageUrl } from "../../lib/pictograms";
import AnalogClock from "../../components/AnalogClock";

interface Activity {
  id: string;
  day_of_week: number;
  pictogram_id: string;
  title: string;
  sort_order: number;
  time_of_day: string | null;
  completed_at: string | null;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function currentDayIndex(): number {
  const jsDay = new Date().getDay(); // 0 = søndag i JS
  return jsDay === 0 ? 6 : jsDay - 1; // omregnet til 0 = mandag, som resten af appen bruger
}

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = søndag
  const diff = now.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

/** Sorterer så aktiviteter med klokkeslæt kommer i tidsrækkefølge, og de uden i deres oprindelige rækkefølge til sidst. */
function sortDayActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    if (a.time_of_day && b.time_of_day) return a.time_of_day.localeCompare(b.time_of_day);
    if (a.time_of_day) return -1;
    if (b.time_of_day) return 1;
    return a.sort_order - b.sort_order;
  });
}

/**
 * Låst "kiosk"-visning for barnet: kun den aktuelle uge, piktogram + titel
 * pr. aktivitet, og mulighed for at markere en aktivitet som gennemført.
 * Har et lille "skift barn"-link tilbage til profilvalget, men INTET link
 * til forældre-delen af appen.
 */
export default function ChildWeeklyView() {
  const { childId } = useParams<{ childId: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWeek() {
      if (!childId) return;
      const weekStart = mondayOfCurrentWeek();

      const { data: planId, error: planError } = await supabase.rpc("ensure_week_materialized", {
        target_child_id: childId,
        week_start: weekStart
      });

      if (planError || !planId) {
        setActivities([]);
        setLoading(false);
        return;
      }

      const { data: acts, error } = await supabase
        .from("activities")
        .select("id, day_of_week, pictogram_id, title, sort_order, time_of_day, completed_at")
        .eq("weekly_plan_id", planId)
        .order("day_of_week")
        .order("sort_order");

      if (!error && acts) setActivities(acts);
      setLoading(false);
    }
    loadWeek();
  }, [childId]);

  async function toggleComplete(activity: Activity) {
    // Bruger RPC'en frem for en direkte .update(), fordi en parret
    // barne-enhed kun har rettighed til at kalde denne ene, snævre
    // funktion - ikke til at redigere activities-rækken direkte.
    const { data: newCompletedAt, error } = await supabase.rpc(
      "toggle_activity_completed",
      { target_activity_id: activity.id }
    );

    if (!error) {
      setActivities((prev) =>
        prev.map((a) => (a.id === activity.id ? { ...a, completed_at: newCompletedAt } : a))
      );
    }
  }

  if (loading) return <p className="loading-text">Henter ugeplan...</p>;

  const todayIndex = currentDayIndex();

  return (
    <div>
      <Link to="/child" className="child-back-link">
        ← Skift barn
      </Link>
      <div className="child-week-view">
        {DAY_NAMES.map((dayName, dayIndex) => {
          const dayActivities = sortDayActivities(
            activities.filter((a) => a.day_of_week === dayIndex)
          );
          if (dayActivities.length === 0) return null;

          return (
            <section
              key={dayIndex}
              className={`day-column day-${dayIndex} ${dayIndex === todayIndex ? "is-today" : ""}`}
            >
              <h2>
                {dayName}
                {dayIndex === todayIndex && <span className="today-badge">I dag</span>}
              </h2>
              <div className="activity-list">
                {dayActivities.map((activity) => (
                  <button
                    key={activity.id}
                    className={`activity-card ${activity.completed_at ? "completed" : ""}`}
                    onClick={() => toggleComplete(activity)}
                  >
                    {activity.time_of_day && (
                      <AnalogClock time={activity.time_of_day.slice(0, 5)} size={44} />
                    )}
                    <img
                      src={resolvePictogramImageUrl(activity.pictogram_id)}
                      alt=""
                      width={140}
                      height={140}
                    />
                    <span className="activity-title">
                      {activity.time_of_day && (
                        <span className="activity-time">{activity.time_of_day.slice(0, 5)}</span>
                      )}
                      {activity.title}
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
