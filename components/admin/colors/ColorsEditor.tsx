"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Download, GripVertical, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { adminOp } from "@/lib/admin/api-client";
import type { ColorEditor, EditorColor } from "@/lib/admin/color-editor";
import { gradientCss } from "@/lib/color";
import type { ColorView } from "@/lib/view";
import { ColorCard } from "../../colors/ColorCard";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";
import { ConfirmDialog } from "../Dialog";
import { ColorPanel } from "./ColorPanel";

const op = (o: string, args: Record<string, unknown>) => adminOp("/api/admin/colors/", o, args);

export const swatchCss = (c: Pick<EditorColor, "kind" | "hex" | "gradient">) =>
  c.kind === "GRADIENT" && c.gradient ? gradientCss(c.gradient.angle, c.gradient.stops) : (c.hex ?? "#000000");

const toView = (c: EditorColor): ColorView =>
  c.kind === "GRADIENT" && c.gradient
    ? { name: c.name, role: c.role, kind: "gradient", css: gradientCss(c.gradient.angle, c.gradient.stops), stops: c.gradient.stops.map((s) => s.hex) }
    : { name: c.name, role: c.role, kind: "solid", hex: c.hex ?? "#000000" };

/** The Colors tab: drag to reorder, add or edit in a side panel, and a live preview of the cards. */
export function ColorsEditor({ editor }: { editor: ColorEditor }) {
  const [colors, setColors] = useState(editor.colors);
  const [editing, setEditing] = useState<EditorColor | "new" | null>(null);
  const [deleting, setDeleting] = useState<EditorColor | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  useEffect(() => setColors(editor.colors), [editor.colors]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const before = colors;
    const next = arrayMove(colors, colors.findIndex((c) => c.id === active.id), colors.findIndex((c) => c.id === over.id));
    setColors(next);
    start(async () => {
      const r = await op("reorder", { brandId: editor.brandId, ids: next.map((c) => c.id) });
      if (r.error) {
        setColors(before);
        toast(r.error, "error");
      } else {
        toast(r.ok!);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto text-small text-muted">Drag to reorder. RGB and HSL are calculated for you; colors.css and colors.json are generated from this list.</p>
        {editor.files && (
          <div className="flex gap-1.5">
            <a href={editor.files.css} className={buttonClass({ variant: "quiet", size: "sm" })}>
              <Download aria-hidden className="size-3.5" /> colors.css
            </a>
            <a href={editor.files.json} className={buttonClass({ variant: "quiet", size: "sm" })}>
              <Download aria-hidden className="size-3.5" /> colors.json
            </a>
          </div>
        )}
        <button type="button" onClick={() => setEditing("new")} className={buttonClass({ variant: "primary" })}>
          <Plus aria-hidden className="size-4" /> Add color
        </button>
      </div>

      <div className="rounded-card border border-hairline bg-surface">
        {colors.length ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
            <SortableContext items={colors.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul aria-label="Colors" className="divide-y divide-hairline">
                {colors.map((c) => (
                  <ColorRow key={c.id} color={c} disabled={pending} onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="px-6 py-10 text-center text-small text-muted">No colors yet. The public page shows &ldquo;Coming soon&rdquo; until you add one.</p>
        )}
      </div>

      {colors.length > 0 && (
        <section aria-labelledby="preview-h">
          <h2 id="preview-h" className="text-h3">
            Live preview
          </h2>
          <p className="mt-1 text-small text-muted">The same cards as the public page.</p>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {colors.map((c) => (
              <ColorCard key={c.id} color={toView(c)} />
            ))}
          </ul>
        </section>
      )}

      <ColorPanel
        open={editing !== null}
        color={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSave={async (color) => {
          const r = editing === "new" ? await op("add", { brandId: editor.brandId, color }) : await op("update", { colorId: (editing as EditorColor).id, color });
          if (!r.error) {
            toast(r.ok!);
            setEditing(null);
            router.refresh();
          }
          return r;
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? ""}?`}
        confirmLabel="Delete color"
        danger
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          start(async () => {
            const r = await op("remove", { colorId: deleting!.id });
            toast(r.ok ?? r.error!, r.error ? "error" : "success");
            setDeleting(null);
            router.refresh();
          })
        }
      >
        It disappears from the public page, colors.css, colors.json and the brand kit.
      </ConfirmDialog>
    </div>
  );
}

function ColorRow({ color, disabled, onEdit, onDelete }: { color: EditorColor; disabled: boolean; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: color.id });
  const value = color.kind === "GRADIENT" && color.gradient ? `${color.gradient.stops.length} stops · ${color.gradient.angle}°` : color.hex;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={`flex items-center gap-3 bg-surface px-3 py-2.5 ${isDragging ? "relative z-10 shadow-lift" : ""}`}>
      <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Reorder ${color.name}`} className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-[8px] text-muted hover:bg-hover hover:text-ink">
        <GripVertical aria-hidden className="size-4" />
      </button>
      <span aria-hidden className="size-10 shrink-0 rounded-[8px] shadow-[inset_0_0_0_1px_var(--swatch-edge)]" style={{ background: swatchCss(color) }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-small font-semibold">{color.name}</p>
        <p className="truncate text-caption text-muted">{color.role}</p>
      </div>
      <span className="text-small tabular-nums text-muted max-sm:hidden">{value}</span>
      <span className="w-20 text-caption text-muted max-md:hidden">{color.kind === "GRADIENT" ? "Gradient" : "Solid"}</span>
      <button type="button" disabled={disabled} onClick={onEdit} className={buttonClass({ variant: "quiet", size: "sm" })} aria-label={`Edit ${color.name}`}>
        Edit
      </button>
      <button type="button" disabled={disabled} onClick={onDelete} className={buttonClass({ variant: "quiet", size: "sm", className: "hover:text-error" })} aria-label={`Delete ${color.name}`}>
        Delete
      </button>
    </li>
  );
}
