import { useState } from "react";
import PictogramPicker from "./PictogramPicker";
import AnalogClock from "./AnalogClock";
import { resolvePictogramImageUrl } from "../lib/pictograms";
import {
  createEvent,
  createRecurringEvent,
  updateEvent,
  updateAllOccurrences,
  setEventChildren,
  promoteEventToRecurring,
  deleteEvent,
  stopRecurringEvent,
  type CalendarChild,
  type CalendarEvent
} from "../lib/events";

const DAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

interface Props {
  familyId: string;
  date: Date;
  children: CalendarChild[];
  editingEvent: CalendarEvent | null;
  onSaved: () => void;
  onClose: () => void;
}

export default function EventForm({ familyId, date, children, editingEvent, onSaved, onClose }: Props) {
  const isEditing = !!editingEvent;
  const alreadyRecurring = !!editingEvent?.recurring_event_id;

  const [pictogramId, setPictogramId] = useState<string | null>(editingEvent?.pictogram_id ?? null);
  const [pickingPictogram, setPickingPictogram] = useState(!isEditing);
  const [title, setTitle] = useState(editingEvent?.title ?? "");
  const [time, setTime] = useState(editingEvent?.time_of_day?.slice(0, 5) ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(editingEvent?.reminder_enabled ?? false);
  const [appliesToFamily, setAppliesToFamily] = useState(editingEvent?.applies_to_family ?? false);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>(editingEvent?.child_ids ?? []);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurDays, setRecurDays] = useState<number[]>([
    date.getDay() === 0 ? 6 : date.getDay() - 1
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChild(childId: string) {
    setSelectedChildIds((prev) =>
      prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId]
    );
  }

  function toggleRecurDay(day: number) {
    setRecurDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  const canSave = !!pictogramId && title.trim().length > 0 && (appliesToFamily || selectedChildIds.length > 0);

  async function handleSaveThisOccurrence() {
    if (!canSave || !pictogramId) return;
    setSaving(true);
    setError(null);
    try {
      const timeValue = time || null;

      if (isEditing && editingEvent) {
        if (isRecurring && recurDays.length > 0 && !alreadyRecurring) {
          await promoteEventToRecurring(editingEvent.id, {
            familyId,
            pictogramId,
            title: title.trim(),
            timeOfDay: timeValue,
            reminderEnabled,
            appliesToFamily,
            childIds: selectedChildIds,
            daysOfWeek: recurDays
          });
        } else {
          await updateEvent(editingEvent.id, {
            pictogramId,
            title: title.trim(),
            timeOfDay: timeValue,
            reminderEnabled
          });
          await setEventChildren(editingEvent.id, appliesToFamily, selectedChildIds);
        }
      } else if (isRecurring && recurDays.length > 0) {
        await createRecurringEvent({
          familyId,
          pictogramId,
          title: title.trim(),
          timeOfDay: timeValue,
          reminderEnabled,
          appliesToFamily,
          childIds: selectedChildIds,
          daysOfWeek: recurDays
        });
      } else {
        await createEvent({
          familyId,
          pictogramId,
          title: title.trim(),
          timeOfDay: timeValue,
          reminderEnabled,
          appliesToFamily,
          childIds: selectedChildIds,
          eventDate: date
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAllOccurrences() {
    if (!canSave || !pictogramId || !editingEvent?.recurring_event_id) return;
    setSaving(true);
    setError(null);
    try {
      await updateAllOccurrences(editingEvent.recurring_event_id, {
        pictogramId,
        title: title.trim(),
        timeOfDay: time || null,
        reminderEnabled
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setSaving(true);
    setError(null);
    try {
      await deleteEvent(editingEvent.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke slette.");
      setSaving(false);
    }
  }

  async function handleStopRecurring() {
    if (!editingEvent?.recurring_event_id) return;
    setSaving(true);
    setError(null);
    try {
      await stopRecurringEvent(editingEvent.recurring_event_id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke stoppe gentagelsen.");
      setSaving(false);
    }
  }

  if (pickingPictogram) {
    return (
      <PictogramPicker
        onSelect={(id) => {
          setPictogramId(id);
          setPickingPictogram(false);
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="pictogram-picker-overlay" onClick={onClose}>
      <div className="pictogram-picker event-form" onClick={(e) => e.stopPropagation()}>
        <div className="pictogram-picker-header">
          <h2>{isEditing ? "Redigér begivenhed" : "Ny begivenhed"}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Luk">
            ✕
          </button>
        </div>

        <button
          type="button"
          className="editor-picto-preview"
          onClick={() => setPickingPictogram(true)}
        >
          {pictogramId && (
            <img src={resolvePictogramImageUrl(pictogramId, 300)} alt="" width={48} height={48} />
          )}
          <span className="btn-icon">Skift piktogram</span>
        </button>

        <label htmlFor="event-title">Titel</label>
        <input
          id="event-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <label htmlFor="event-time">Klokkeslæt (valgfrit)</label>
        <div className="time-input-row">
          <input
            id="event-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          {time && <AnalogClock time={time} size={36} />}
        </div>

        {time && (
          <label className="recur-checkbox">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
            />
            🔔 Send en påmindelse på tidspunktet
          </label>
        )}

        <div className="child-assignment">
          <p className="child-assignment-label">Gælder for:</p>
          <label className="recur-checkbox">
            <input
              type="checkbox"
              checked={appliesToFamily}
              onChange={(e) => {
                setAppliesToFamily(e.target.checked);
                if (e.target.checked) setSelectedChildIds([]);
              }}
            />
            Hele familien
          </label>
          {!appliesToFamily && (
            <div className="child-assignment-list">
              {children.map((child) => (
                <label key={child.id} className="recur-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedChildIds.includes(child.id)}
                    onChange={() => toggleChild(child.id)}
                  />
                  {child.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {!alreadyRecurring && (
          <div className="recur-section">
            <label className="recur-checkbox">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Gentag denne begivenhed
            </label>
            {isRecurring && (
              <>
                <div className="recur-day-picker">
                  {DAY_SHORT.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`recur-day-toggle ${recurDays.includes(i) ? "active" : ""}`}
                      onClick={() => toggleRecurDay(i)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => setRecurDays([0, 1, 2, 3, 4, 5, 6])}
                >
                  Hver dag
                </button>
              </>
            )}
          </div>
        )}

        <div className="edit-child-actions">
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={handleSaveThisOccurrence}
            disabled={saving || !canSave || (isRecurring && recurDays.length === 0)}
          >
            {saving ? "Gemmer..." : alreadyRecurring ? "Gem (kun denne dag)" : "Gem"}
          </button>
          {alreadyRecurring && (
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleSaveAllOccurrences}
              disabled={saving || !canSave}
            >
              Gem for alle gentagelser
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
            Annullér
          </button>
        </div>

        {isEditing && (
          <div className="delete-child-section">
            {alreadyRecurring && (
              <button type="button" className="btn-icon" onClick={handleStopRecurring} disabled={saving}>
                Stop gentagelse fremover
              </button>
            )}
            <button type="button" className="btn-icon delete-child-link" onClick={handleDelete} disabled={saving}>
              Slet {alreadyRecurring ? "denne dag" : "begivenheden"}
            </button>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

