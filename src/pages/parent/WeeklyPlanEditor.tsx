import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { pictogramImageUrl } from "../../lib/arasaac";
import PictogramPicker from "../../components/PictogramPicker";
import AnalogClock from "../../components/AnalogClock";

interface Activity {
  id: string;
  day_of_week: number;
  pictogram_id: string;
  title: string;
  sort_order: number;
  time_of_day: string | null;
}

interface ActivityFormState {
  activityId: string | null; // null = ny aktivitet, ellers redigering af eksisterende
  day: number;
  pictogramId: string | null;
  title: string;
  time: string; // "HH:MM" eller ""
  pickingPictogram: boolean;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

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

export default function WeeklyPlanEditor() {
  const { childId } = useParams<{ childId: string }>();
  const [planId, setPlanId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityFormState | null>(null);

  async function loadWeek() {
    if (!childId) return;
    const weekStart = mondayOfCurrentWeek();

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
      .select("id, day_of_week, pictogram_id, title, sort_order, time_of_day")
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
    setForm({ activityId: null, day, pictogramId: null, title: "", time: "", pickingPictogram: true });
  }

  function startEditing(activity: Activity) {
    setForm({
      activityId: activity.id,
      day: activity.day_of_week,
      pictogramId: activity.pictogram_id,
      title: activity.title,
      time: activity.time_of_day?.slice(0, 5) ?? "",
      pickingPictogram: false
    });
  }

  function closeForm() {
    setForm(null);
  }

  async function saveActivity() {
    if (!form || !form.pictogramId || !form.title.trim() || !planId) return;

    const timeValue = form.time ? form.time : null;

    if (form.activityId) {
      // Redigér eksisterende aktivitet
      const { data, error } = await supabase
        .from("activities")
        .update({
          pictogram_id: form.pictogramId,
          title: form.title.trim(),
          time_of_day: timeValue
        })
        .eq("id", form.activityId)
        .select()
        .single();

      if (!error && data) {
        setActivities((prev) => prev.map((a) => (a.id === data.id ? data : a)));
      }
    } else {
      // Ny aktivitet
      const dayActivities = activities.filter((a) => a.day_of_week === form.day);
      const nextSortOrder = dayActivities.length
        ? Math.max(...dayActivities.map((a) => a.sort_order)) + 1
        : 0;

      const { data, error } = await supabase
        .from("activities")
        .insert({
          weekly_plan_id: planId,
          day_of_week: form.day,
          pictogram_id: form.pictogramId,
          title: form.title.trim(),
          sort_order: nextSortOrder,
          time_of_day: timeValue
        })
        .select()
        .single();

      if (!error && data) {
        setActivities((prev) => [...prev, data]);
      }
    }

    closeForm();
  }

  async function deleteActivity(activityId: string) {
    const { error } = await supabase.from("activities").delete().eq("id", activityId);
    if (!error) {
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
      if (form?.activityId === activityId) closeForm();
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
          const dayActivities = sortDayActivities(
            activities.filter((a) => a.day_of_week === dayIndex)
          );
          const isFormOpenHere = form && form.day === dayIndex;

          return (
            <section key={dayIndex} className={`editor-day-column day-${dayIndex}`}>
              <h2>{dayName}</h2>
              <ul>
                {dayActivities.map((activity) => (
                  <li key={activity.id} className="editor-activity">
                    <button
                      type="button"
                      className="editor-activity-edit"
                      onClick={() => startEditing(activity)}
                    >
                      {activity.time_of_day && (
                        <AnalogClock time={activity.time_of_day.slice(0, 5)} size={28} />
                      )}
                      <img
                        src={pictogramImageUrl(activity.pictogram_id, 300)}
                        alt=""
                        width={48}
                        height={48}
                      />
                      <span className="editor-activity-text">
                        {activity.time_of_day && (
                          <span className="editor-activity-time">
                            {activity.time_of_day.slice(0, 5)}
                          </span>
                        )}
                        {activity.title}
                      </span>
                    </button>
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

              {isFormOpenHere ? (
                <div className="add-activity-form">
                  {form.pickingPictogram ? (
                    <PictogramPicker
                      onSelect={(id) =>
                        setForm((prev) => (prev ? { ...prev, pictogramId: id, pickingPictogram: false } : prev))
                      }
                      onClose={closeForm}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className="editor-picto-preview"
                        onClick={() => setForm((prev) => (prev ? { ...prev, pickingPictogram: true } : prev))}
                      >
                        {form.pictogramId && (
                          <img src={pictogramImageUrl(form.pictogramId, 300)} alt="" width={48} height={48} />
                        )}
                        <span className="btn-icon">Skift piktogram</span>
                      </button>
                      <input
                        type="text"
                        placeholder="Titel"
                        value={form.title}
                        onChange={(e) => setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                        autoFocus
                      />
                      <label htmlFor={`time-${dayIndex}`}>Klokkeslæt (valgfrit)</label>
                      <div className="time-input-row">
                        <input
                          id={`time-${dayIndex}`}
                          type="time"
                          value={form.time}
                          onChange={(e) => setForm((prev) => (prev ? { ...prev, time: e.target.value } : prev))}
                        />
                        {form.time && <AnalogClock time={form.time} size={36} />}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={saveActivity}
                        disabled={!form.title.trim()}
                      >
                        Gem
                      </button>
                    </>
                  )}
                  <button type="button" className="btn btn-ghost btn-small" onClick={closeForm}>
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
