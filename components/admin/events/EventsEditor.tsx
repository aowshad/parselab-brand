"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminOp } from "@/lib/admin/api-client";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { ConfirmDialog } from "../Dialog";
import { Field, TextInput, inputClass } from "../Form";

export type AdminEvent = { id: string; key: string; name: string; description: string; startsOn: string; endsOn: string; items: number; brands: number };
type Values = { name: string; description: string; startsOn: string; endsOn: string };

const op = (o: string, args: Record<string, unknown>) => adminOp("/api/admin/events/", o, args);
const card = "rounded-card border border-hairline bg-surface p-5 max-sm:p-4";

/** Create events and edit their name, dates and description; delete them with their items. */
export function EventsEditor({ events }: { events: AdminEvent[] }) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <section aria-labelledby="new-event-h" className={card}>
        <h2 id="new-event-h" className="mb-4 text-h3">
          New event
        </h2>
        <EventForm submitLabel="Create event" onSubmit={(v) => op("create", v)} resetOnSave />
      </section>
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  );
}

function EventCard({ event }: { event: AdminEvent }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  async function remove() {
    setPending(true);
    const r = await op("delete", { eventId: event.id, confirm: event.name });
    setPending(false);
    setConfirming(false);
    toast(r.ok ?? r.error!, r.error ? "error" : "success");
    router.refresh();
  }
  return (
    <section aria-label={event.name} className={card}>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-h3">{event.name}</h2>
        <span className="text-caption tabular-nums text-muted">
          {event.items ? `${event.items} item${event.items === 1 ? "" : "s"} from ${event.brands} brand${event.brands === 1 ? "" : "s"}` : "No items yet"}
        </span>
        <span className="ml-auto flex gap-1">
          <a href={`/events/${event.key}/`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "quiet", size: "sm" })}>
            /events/{event.key}/ <ExternalLink aria-hidden className="size-3.5" />
          </a>
          <button type="button" onClick={() => setConfirming(true)} className={buttonClass({ variant: "quiet", size: "sm", className: "hover:text-error" })}>
            <Trash2 aria-hidden className="size-3.5" /> Delete
          </button>
        </span>
      </div>
      <EventForm initial={event} submitLabel="Save" onSubmit={(v) => op("update", { eventId: event.id, ...v })} />
      <ConfirmDialog
        open={confirming}
        title={`Delete ${event.name}?`}
        confirmLabel="Delete event"
        danger
        pending={pending}
        requireText={event.items ? event.name : undefined}
        onConfirm={remove}
        onClose={() => setConfirming(false)}
      >
        {event.items ? `Every brand's items in it (${event.items}) are deleted too, files included.` : "It has no items yet."}
      </ConfirmDialog>
    </section>
  );
}

function EventForm({ initial, submitLabel, onSubmit, resetOnSave = false }: { initial?: Values; submitLabel: string; onSubmit: (v: Values) => Promise<{ ok?: string; error?: string }>; resetOnSave?: boolean }) {
  const blank: Values = { name: "", description: "", startsOn: "", endsOn: "" };
  const [values, setValues] = useState<Values>(initial ?? blank);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const dirty = !initial || (["name", "description", "startsOn", "endsOn"] as const).some((k) => values[k] !== initial[k]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await onSubmit(values);
    setSaving(false);
    if (r.error) return setError(r.error);
    setError(null);
    toast(r.ok!);
    if (resetOnSave) setValues(blank);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
      <Field label="Name">{({ id }) => <TextInput id={id} value={values.name} onChange={set("name")} required maxLength={60} placeholder="Halloween 2026" />}</Field>
      <Field label="Starts">{({ id }) => <TextInput id={id} type="date" value={values.startsOn} onChange={set("startsOn")} />}</Field>
      <Field label="Ends">{({ id }) => <TextInput id={id} type="date" value={values.endsOn} onChange={set("endsOn")} />}</Field>
      <div className="sm:col-span-3">
        <Field label="Description (optional)">
          {({ id }) => <input id={id} value={values.description} onChange={set("description")} maxLength={200} placeholder="Spooky versions for October posts and app listings." className={inputClass} />}
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-small text-error sm:col-span-3">
          {error}
        </p>
      )}
      <div className="flex justify-end sm:col-span-3">
        <button type="submit" disabled={saving || !dirty} className={buttonClass({ variant: initial ? "ghost" : "primary" })}>
          {!initial && <Plus aria-hidden className="size-4" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
