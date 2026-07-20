import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { pictogramImageUrl } from "../../lib/arasaac";
import PictogramPicker from "../../components/PictogramPicker";

interface Activity {
  id: string;
  day_of_week: number;
  pictogram_id: string;
  title: string;
  sort_order: number;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = søndag
  const diff = now.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

export default function WeeklyPlanEditor() {
  const { childId } = useParams<{ childId: string }>();
  const [planId, setPlanId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State til "tilføj aktivitet"-flowet: hvilken dag er der ved at blive
  // tilføjet en aktivitet til, og er piktogram-vælgeren åben
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [pendingPictogramId, setPendingPictogramId] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");

  async function loadWeek() {
    if (!childId) return;
    const weekStart = mondayOfCurrentWeek();

    // Find eller opret ugeplanen for denne uge
    let { data: plan } = await supabase
      .from("weekly_plans")
      .select("id")
      .eq("child_id", childId)
      .eq("week_start_date", weekStart)
      .maybeSingle();

    if (!plan) {
      const { data: newPlan, error: createError } = await supabase
        .from("weekly_plans")
        .insert({ child_id: childId, week_start_date: weekStart })
        .select()
        .single();
      if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      }
      plan = newPlan;
    }

    setPlanId(plan!.id);

    const { data: acts, error: actsError } = await supabase
      .from("activities")
      .select("id, day_of_week, pictogram_id, title, sort_order")
      .eq("weekly_plan_id", plan!.id)
      .order("day_of_week")
      .order("sort_order");

    if (!actsError && acts) setActivities(acts);
    setLoading(false);
  }

  useEffect(() => {
    loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  function startAdding(day: number) {
    setAddingDay(day);
    setPendingPictogramId(null);
    setPendingTitle("");
  }

  function cancelAdding() {
    setAddingDay(null);
    setPendingPictogramId(null);
    setPendingTitle("");
  }

  async function saveActivity() {
    if (addingDay === null || !pendingPictogramId || !pendingTitle.trim() || !planId) return;

    const dayActivities = activities.filter((a) => a.day_of_week === addingDay);
    const nextSortOrder = dayActivities.length
      ? Math.max(...dayActivities.map((a) => a.sort_order)) + 1
      : 0;

    const { data, error } = await supabase
      .from("activities")
      .insert({
        weekly_plan_id: planId,
        day_of_week: addingDay,
        pictogram_id: pendingPictogramId,
        title: pendingTitle.trim(),
        sort_order: nextSortOrder
      })
      .select()
      .single();

    if (!error && data) {
      setActivities((prev) => [...prev, data]);
    }
    cancelAdding();
  }

  async function deleteActivity(activityId: string) {
    const { error } = await supabase.from("activities").delete().eq("id", activityId);
    if (!error) {
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
    }
  }

  if (loading) return <p className="loading-text">Henter ugeplan...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/parent" className="back-link">
          ← Oversigt
        </Link>
        <h1>Denne uges plan</h1>
      </header>

      <div className="editor-days">
        {DAY_NAMES.map((dayName, dayIndex) => {
          const dayActivities = activities.filter((a) => a.day_of_week === dayIndex);
          return (
            <section key={dayIndex} className={`editor-day-column day-${dayIndex}`}>
              <h2>{dayName}</h2>
              <ul>
                {dayActivities.map((activity) => (
                  <li key={activity.id} className="editor-activity">
                    <img
                      src={pictogramImageUrl(activity.pictogram_id, 300)}
                      alt=""
                      width={48}
                      height={48}
                    />
                    <span>{activity.title}</span>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => deleteActivity(activity.id)}
                      aria-label={`Slet ${activity.title}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>

              {addingDay === dayIndex ? (
                <div className="add-activity-form">
                  {pendingPictogramId ? (
                    <>
                      <img
                        src={pictogramImageUrl(pendingPictogramId, 300)}
                        alt=""
                        width={48}
                        height={48}
                      />
                      <input
                        type="text"
                        placeholder="Titel"
                        value={pendingTitle}
                        onChange={(e) => setPendingTitle(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={saveActivity}
                        disabled={!pendingTitle.trim()}
                      >
                        Gem
                      </button>
                    </>
                  ) : (
                    <PictogramPicker
                      onSelect={(id) => setPendingPictogramId(id)}
                      onClose={cancelAdding}
                    />
                  )}
                  <button type="button" className="btn btn-ghost btn-small" onClick={cancelAdding}>
                    Annullér
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-add-activity"
                  onClick={() => startAdding(dayIndex)}
                >
                  + Tilføj aktivitet
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
