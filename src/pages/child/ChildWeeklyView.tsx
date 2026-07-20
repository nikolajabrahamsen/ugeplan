import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { pictogramImageUrl } from "../../lib/arasaac";

interface Activity {
  id: string;
  day_of_week: number;
  pictogram_id: string;
  title: string;
  sort_order: number;
  completed_at: string | null;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = søndag
  const diff = now.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

/**
 * Låst "kiosk"-visning for barnet: kun den aktuelle uge, piktogram + titel
 * pr. aktivitet, og mulighed for at markere en aktivitet som gennemført.
 * Denne visning skal IKKE indeholde navigation til forældre-delen.
 */
export default function ChildWeeklyView() {
  const { childId } = useParams<{ childId: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWeek() {
      const weekStart = mondayOfCurrentWeek();

      const { data: plan } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("child_id", childId)
        .eq("week_start_date", weekStart)
        .maybeSingle();

      if (!plan) {
        setActivities([]);
        setLoading(false);
        return;
      }

      const { data: acts, error } = await supabase
        .from("activities")
        .select("id, day_of_week, pictogram_id, title, sort_order, completed_at")
        .eq("weekly_plan_id", plan.id)
        .order("day_of_week")
        .order("sort_order");

      if (!error && acts) setActivities(acts);
      setLoading(false);
    }
    loadWeek();
  }, [childId]);

  async function toggleComplete(activity: Activity) {
    const newValue = activity.completed_at ? null : new Date().toISOString();
    const { error } = await supabase
      .from("activities")
      .update({ completed_at: newValue })
      .eq("id", activity.id);

    if (!error) {
      setActivities((prev) =>
        prev.map((a) => (a.id === activity.id ? { ...a, completed_at: newValue } : a))
      );
    }
  }

  if (loading) return <p>Henter ugeplan...</p>;

  return (
    <div className="child-week-view">
      {DAY_NAMES.map((dayName, dayIndex) => {
        const dayActivities = activities.filter((a) => a.day_of_week === dayIndex);
        if (dayActivities.length === 0) return null;

        return (
          <section key={dayIndex} className="day-column">
            <h2>{dayName}</h2>
            <div className="activity-list">
              {dayActivities.map((activity) => (
                <button
                  key={activity.id}
                  className={`activity-card ${activity.completed_at ? "completed" : ""}`}
                  onClick={() => toggleComplete(activity)}
                >
                  <img
                    src={pictogramImageUrl(activity.pictogram_id)}
                    alt=""
                    width={140}
                    height={140}
                  />
                  <span className="activity-title">{activity.title}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
