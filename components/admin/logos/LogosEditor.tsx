"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { logoOp } from "@/lib/admin/logo-client";
import type { EditorLogoType, LogoEditor } from "@/lib/admin/logos";
import { isSlot, SLOTS, STANDARD_SLOTS, TILE_SLOTS, TYPE_PRESETS, type SlotKey } from "@/lib/admin/slots";
import { formatSize } from "@/lib/format";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { ConfirmDialog } from "../Dialog";
import { inputClass } from "../Form";
import { Menu } from "../Menu";
import { VariantCell } from "./VariantCell";

export function LogosEditor({ editor }: { editor: LogoEditor }) {
  const [types, setTypes] = useState(editor.types);
  const [rebuilding, setRebuilding] = useState(editor.rebuilding);
  useEffect(() => setRebuilding(editor.rebuilding), [editor.rebuilding]);
  const [selectedId, setSelectedId] = useState(() => editor.types[0]?.id ?? null);
  // ?type=<id> selects that logo type (it's kept in the URL as you switch).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    if (t) setSelectedId(t);
  }, []);
  const [custom, setCustom] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  useEffect(() => setTypes(editor.types), [editor.types]);
  // While the zips rebuild in the background, poll a tiny status URL and update just the ZIP
  // lines. Never a page refresh here: it would cancel a save that's still in flight.
  useEffect(() => {
    if (!rebuilding) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/admin/brands/${editor.brandId}/status/`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (!r || r.rebuilding) return;
      clearInterval(t);
      setTypes((ts) => ts.map((x) => (x.id in r.zips ? { ...x, zip: r.zips[x.id] } : x)));
      setRebuilding(false);
    }, 2000);
    return () => clearInterval(t);
  }, [rebuilding, editor.brandId]);

  const selected = types.find((t) => t.id === selectedId) ?? types[0];
  const select = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("type", id);
    window.history.replaceState(window.history.state, "", url);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const before = types;
    const next = arrayMove(types, types.findIndex((t) => t.id === active.id), types.findIndex((t) => t.id === over.id));
    setTypes(next);
    start(async () => {
      const r = await logoOp("reorderTypes", { brandId: editor.brandId, ids: next.map((t) => t.id) });
      if (r.error) {
        setTypes(before);
        toast(r.error, "error");
      } else {
        toast(r.ok!);
        router.refresh();
      }
    });
  }

  const add = (preset: string | null, label?: string) =>
    start(async () => {
      const r = await logoOp("addType", { brandId: editor.brandId, preset, label });
      toast(r.ok ?? r.error!, r.error ? "error" : "success");
      if (r.id) {
        setCustom(null);
        select(r.id);
        router.refresh();
      }
    });
  const missing = TYPE_PRESETS.filter((p) => !types.some((t) => t.key === p.key));

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <div className="rounded-card border border-hairline bg-surface p-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
            <SortableContext items={types.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul aria-label="Logo types" className="flex flex-col gap-0.5">
                {types.map((t) => (
                  <TypeRow key={t.id} type={t} selected={t.id === selected?.id} onSelect={() => select(t.id)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {!types.length && <p className="px-2 py-3 text-small text-muted">No logo types yet.</p>}
          {custom !== null ? (
            <form
              className="mt-1 flex gap-1.5 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                add(null, custom);
              }}
            >
              <input autoFocus aria-label="New logo type name" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Wordmark" maxLength={40} className={`${inputClass} h-8 text-caption`} />
              <button type="submit" disabled={pending || !custom.trim()} className={buttonClass({ variant: "primary", size: "sm" })}>
                Add
              </button>
            </form>
          ) : (
            <div className="mt-1 [&>div]:w-full">
              <Menu
                label="Add logo type"
                align="left"
                triggerClassName="motion-colors flex h-9 w-full items-center justify-center rounded-[8px] text-muted hover:bg-hover hover:text-ink"
                trigger={
                  <span className="flex w-full items-center justify-center gap-1.5 text-caption font-medium">
                    <Plus aria-hidden className="size-3.5" /> Add logo type
                  </span>
                }
                items={[
                  ...missing.map((p) => ({ label: p.label, hint: p.description.split(".")[0], onSelect: () => add(p.key) })),
                  { label: "Custom…", onSelect: () => setCustom("") },
                ]}
              />
            </div>
          )}
        </div>
        <p className="mt-3 px-1 text-caption text-muted">Drag to reorder the tabs on the public page. The count is variants uploaded.</p>
      </div>

      {selected ? (
        <TypePanel key={selected.id} brandId={editor.brandId} type={selected} rebuilding={rebuilding} />
      ) : (
        <div className="grid place-items-center rounded-card border border-dashed border-control p-10 text-center text-small text-muted">Add a logo type to start uploading.</div>
      )}
    </div>
  );
}

function TypeRow({ type, selected, onSelect }: { type: EditorLogoType; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: type.id });
  const filled = type.variants.filter((v) => (STANDARD_SLOTS as string[]).includes(v.key)).length;
  const extra = type.variants.length - filled;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={`flex items-center gap-1 rounded-[10px] ${selected ? "bg-hover" : ""} ${isDragging ? "relative z-10 bg-surface shadow-lift" : ""}`}>
      <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Reorder ${type.label}`} className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-[8px] text-muted hover:text-ink">
        <GripVertical aria-hidden className="size-4" />
      </button>
      <button type="button" onClick={onSelect} aria-current={selected || undefined} className={`flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[8px] pr-2 text-left text-small ${selected ? "font-semibold" : "text-ink"}`}>
        <span className="truncate">{type.label}</span>
        <span className="ml-auto shrink-0 text-caption tabular-nums text-muted">
          {filled}/4{extra ? ` +${extra}` : ""}
        </span>
      </button>
    </li>
  );
}

function TypePanel({ brandId, type, rebuilding }: { brandId: string; type: EditorLogoType; rebuilding: boolean }) {
  const [label, setLabel] = useState(type.label);
  const [description, setDescription] = useState(type.description);
  const [tiles, setTiles] = useState<SlotKey[]>(() => TILE_SLOTS.filter((s) => type.variants.some((v) => v.key === s)));
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const dirty = label !== type.label || description !== type.description;
  const variantFor = (slot: SlotKey) => type.variants.find((v) => v.key === slot);
  const others = type.variants.filter((v) => !isSlot(v.key));

  return (
    <section aria-label={type.label} className="flex flex-col gap-4">
      <form
        className="rounded-card border border-hairline bg-surface p-5 max-sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await logoOp("updateType", { typeId: type.id, label, description });
            toast(r.ok ?? r.error!, r.error ? "error" : "success");
            if (r.ok) router.refresh();
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1.5 block text-caption text-muted">Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-caption text-muted">Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} placeholder="One line under the heading on the public page" className={inputClass} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="mr-auto flex items-center gap-1.5 text-caption text-muted" aria-live="polite">
            {rebuilding ? (
              <>
                <Loader aria-hidden className="size-3.5 animate-spin" /> Rebuilding the {type.label} ZIP and the brand kit…
              </>
            ) : type.zip ? (
              `${type.zip.name} · ${formatSize(type.zip.sizeKb)}`
            ) : (
              "No ZIP until a variant is uploaded."
            )}
          </p>
          <button type="button" onClick={() => setConfirm(true)} className={buttonClass({ variant: "quiet", size: "sm", className: "hover:text-error" })}>
            Delete type
          </button>
          <button type="submit" disabled={!dirty || pending} className={buttonClass({ variant: "primary", size: "sm" })}>
            Save
          </button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {[...STANDARD_SLOTS, ...tiles].map((slot) => (
          <VariantCell key={slot} brandId={brandId} typeId={type.id} typeLabel={type.label} slot={slot} variant={variantFor(slot)} />
        ))}
      </div>
      {others.length > 0 && (
        <p className="text-caption text-muted">Also stored: {others.map((v) => v.name).join(", ")} (not editable here).</p>
      )}
      {TILE_SLOTS.some((s) => !tiles.includes(s)) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-muted">Tiles for icons and avatars:</span>
          {TILE_SLOTS.filter((s) => !tiles.includes(s)).map((s) => (
            <button key={s} type="button" onClick={() => setTiles((t) => [...t, s])} className={buttonClass({ variant: "ghost", size: "sm" })}>
              <Plus aria-hidden className="size-3.5" /> {SLOTS[s].name} tile
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`Delete the ${type.label} logo type?`}
        confirmLabel="Delete type"
        danger
        requireText={type.variants.length ? type.label : undefined}
        pending={pending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          start(async () => {
            const r = await logoOp("deleteType", { typeId: type.id });
            toast(r.ok ?? r.error!, r.error ? "error" : "success");
            setConfirm(false);
            router.replace(window.location.pathname);
            router.refresh();
          })
        }
      >
        {type.variants.length ? `Its ${type.variants.length} variant${type.variants.length === 1 ? "" : "s"} and every SVG and PNG are deleted.` : "It has no files yet."}
      </ConfirmDialog>
    </section>
  );
}
