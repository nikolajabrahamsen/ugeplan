import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { resolvePictogramImageUrl } from "../../lib/pictograms";
import PictogramPicker from "../../components/PictogramPicker";
import AnalogClock from "../../components/AnalogClock";

interface Activity {
  id: string;
  day_of_week: number;
  pictogram_id: string;
  title: string;
  sort_order: number;
  time_of_day: string | null;
  recurring_activity_id: string | null;
  reminder_enabled: boolean;
}

interface ActivityFormState {
  activityId: string | null; // null = ny aktivitet, ellers redigering af eksisterende
  day: number;
  pictogramId: string | null;
  title: string;
  time: string; // "HH:MM" eller ""
  pickingPictogram: boolean;
  isRecurring: boolean;
  recurDays: number[];
  alreadyRecurring: boolean; // true hvis den redigerede aktivitet allerede kommer fra en gentagelse
  recurringActivityId: string | null;
  reminderEnabled: boolean;
}

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const DAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

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

    // Finder/opretter ugeplanen OG materialiserer eventuelle gentagne
    // aktiviteter ind i den, i én RPC
    const { data: newPlanId, error: planError } = await supabase.rpc("ensure_week_materialized", {
      target_child_id: childId,
      week_start: weekStart
    });

    if (planError || !newPlanId) {
      setError(planError?.message ?? "Kunne ikke hente ugeplanen");
      setLoading(false);
      return;
    }

    setPlanId(newPlanId);

    const { data: acts, error: actsError } = await supabase
      .from("activities")
      .select("id, day_of_week, pictogram_id, title, sort_order, time_of_day, recurring_activity_id, reminder_enabled")
      .eq("weekly_plan_id", newPlanId)
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
    setForm({
      activityId: null,
      day,
      pictogramId: null,
      title: "",
      time: "",
      pickingPictogram: true,
      isRecurring: false,
      recurDays: [day],
      alreadyRecurring: false,
      recurringActivityId: null,
      reminderEnabled: false
    });
  }

  function startEditing(activity: Activity) {
    setForm({
      activityId: activity.id,
      day: activity.day_of_week,
      pictogramId: activity.pictogram_id,
      title: activity.title,
      time: activity.time_of_day?.slice(0, 5) ?? "",
      pickingPictogram: false,
      isRecurring: false,
      recurDays: [activity.day_of_week],
      alreadyRecurring: !!activity.recurring_activity_id,
      recurringActivityId: activity.recurring_activity_id,
      reminderEnabled: activity.reminder_enabled
    });
  }

  function closeForm() {
    setForm(null);
  }

  function toggleRecurDay(day: number) {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.recurDays.includes(day);
      const recurDays = has ? prev.recurDays.filter((d) => d !== day) : [...prev.recurDays, day];
      return { ...prev, recurDays };
    });
  }

  async function saveAllOccurrences() {
    if (!form || !form.pictogramId || !form.title.trim() || !form.recurringActivityId) return;

    const timeValue = form.time ? form.time : null;

    // Opdatér selve skabelonen, så fremtidige uger også får de nye værdier
    const { error: templateError } = await supabase
      .from("recurring_activities")
      .update({
        pictogram_id: form.pictogramId,
        title: form.title.trim(),
        time_of_day: timeValue,
        reminder_enabled: form.reminderEnabled
      })
      .eq("id", form.recurringActivityId);

    if (templateError) {
      setError(templateError.message);
      closeForm();
      return;
    }

    // Opdatér alle allerede-materialiserede forekomster (tidligere og
    // kommende uger der allerede har fået skabelonen lagt ind)
    const { error: instancesError } = await supabase
      .from("activities")
      .update({
        pictogram_id: form.pictogramId,
        title: form.title.trim(),
        time_of_day: timeValue,
        reminder_enabled: form.reminderEnabled
      })
      .eq("recurring_activity_id", form.recurringActivityId);

    if (!instancesError) {
      setActivities((prev) =>
        prev.map((a) =>
          a.recurring_activity_id === form.recurringActivityId
            ? {
                ...a,
                pictogram_id: form.pictogramId!,
                title: form.title.trim(),
                time_of_day: timeValue,
                reminder_enabled: form.reminderEnabled
              }
            : a
        )
      );
    }
    closeForm();
  }

  async function saveActivity() {
    if (!form || !form.pictogramId || !form.title.trim() || !planId || !childId) return;

    const timeValue = form.time ? form.time : null;

    if (form.isRecurring && form.recurDays.length > 0) {
      // Opret en ny gentagelses-skabelon. Hvis vi redigerer en allerede
      // eksisterende aktivitet, kobles DEN sammen med skabelonen, så den
      // ikke optræder dobbelt i den aktuelle uge.
      const { data: newRecurring, error: recurError } = await supabase
        .from("recurring_activities")
        .insert({
          child_id: childId,
          pictogram_id: form.pictogramId,
          title: form.title.trim(),
          time_of_day: timeValue,
          days_of_week: form.recurDays,
          reminder_enabled: form.reminderEnabled
        })
        .select()
        .single();

      if (recurError || !newRecurring) {
        setError(recurError?.message ?? "Kunne ikke oprette gentagelsen");
        closeForm();
        return;
      }

      if (form.activityId) {
        await supabase
          .from("activities")
          .update({
            pictogram_id: form.pictogramId,
            title: form.title.trim(),
            time_of_day: timeValue,
            recurring_activity_id: newRecurring.id,
            reminder_enabled: form.reminderEnabled
          })
          .eq("id", form.activityId);
      }

      closeForm();
      setLoading(true);
      await loadWeek();
      return;
    }

    if (form.activityId) {
      // Redigér eksisterende aktivitet (kun denne ene forekomst)
      const { data, error } = await supabase
        .from("activities")
        .update({
          pictogram_id: form.pictogramId,
          title: form.title.trim(),
          time_of_day: timeValue,
          reminder_enabled: form.reminderEnabled
        })
        .eq("id", form.activityId)
        .select()
        .single();

      if (!error && data) {
        setActivities((prev) => prev.map((a) => (a.id === data.id ? data : a)));
      }
      closeForm();
      return;
    }

    // Almindelig ny, enkeltstående aktivitet
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
        time_of_day: timeValue,
        reminder_enabled: form.reminderEnabled
      })
      .select()
      .single();

    if (!error && data) {
      setActivities((prev) => [...prev, data]);
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

  async function stopRecurring(recurringActivityId: string) {
    // Slår skabelonen fra, så den ikke længere dukker op i fremtidige uger.
    // Allerede-materialiserede forekomster (som denne uges) bliver stående.
    const { error } = await supabase
      .from("recurring_activities")
      .update({ active: false })
      .eq("id", recurringActivityId);
    if (!error) {
      setActivities((prev) =>
        prev.map((a) => (a.recurring_activity_id === recurringActivityId ? { ...a, recurring_activity_id: null } : a))
      );
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
                        src={resolvePictogramImageUrl(activity.pictogram_id, 300)}
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
                        {activity.recurring_activity_id && (
                          <span className="recurring-badge" title="Gentages">
                            🔁
                          </span>
                        )}
                        {activity.reminder_enabled && (
                          <span className="recurring-badge" title="Påmindelse slået til">
                            🔔
                          </span>
                        )}
                        {activity.title}
                      </span>
                    </button>
                    {activity.recurring_activity_id && (
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => stopRecurring(activity.recurring_activity_id!)}
                        title="Stop gentagelse fremover"
                      >
                        Stop gentagelse
                      </button>
                    )}
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
                          <img src={resolvePictogramImageUrl(form.pictogramId, 300)} alt="" width={48} height={48} />
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

                      {form.time && (
                        <label className="recur-checkbox">
                          <input
                            type="checkbox"
                            checked={form.reminderEnabled}
                            onChange={(e) =>
                              setForm((prev) => (prev ? { ...prev, reminderEnabled: e.target.checked } : prev))
                            }
                          />
                          🔔 Send en påmindelse på tidspunktet (fx til medicin)
                        </label>
                      )}

                      {!form.alreadyRecurring && (
                        <div className="recur-section">
                          <label className="recur-checkbox">
                            <input
                              type="checkbox"
                              checked={form.isRecurring}
                              onChange={(e) =>
                                setForm((prev) => (prev ? { ...prev, isRecurring: e.target.checked } : prev))
                              }
                            />
                            Gentag denne aktivitet
                          </label>

                          {form.isRecurring && (
                            <>
                              <div className="recur-day-picker">
                                {DAY_SHORT.map((label, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    className={`recur-day-toggle ${form.recurDays.includes(i) ? "active" : ""}`}
                                    onClick={() => toggleRecurDay(i)}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost btn-small"
                                onClick={() =>
                                  setForm((prev) => (prev ? { ...prev, recurDays: [0, 1, 2, 3, 4, 5, 6] } : prev))
                                }
                              >
                                Hver dag
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={saveActivity}
                        disabled={!form.title.trim() || (form.isRecurring && form.recurDays.length === 0)}
                      >
                        {form.alreadyRecurring ? "Gem (kun denne dag)" : "Gem"}
                      </button>
                      {form.alreadyRecurring && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={saveAllOccurrences}
                          disabled={!form.title.trim()}
                        >
                          Gem for alle gentagelser
                        </button>
                      )}
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
