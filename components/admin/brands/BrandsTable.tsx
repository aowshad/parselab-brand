"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, Copy, GripVertical, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteBrand, duplicateBrand, reorderBrands, setStatus } from "@/app/admin/brands/actions";
import type { AdminBrandRow } from "@/lib/admin/brands";
import { useToast } from "../../ui/Toast";
import { ConfirmDialog } from "../Dialog";
import { inputClass } from "../Form";
import { Menu } from "../Menu";
import { STATUS_LABEL, StatusSelect, type Status } from "../StatusSelect";

const FILTERS = ["ALL", "LIVE", "SOON", "DRAFT"] as const;
type Filter = (typeof FILTERS)[number];

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

/** The Brands table: drag (or Space + arrows) to reorder the home page, change status inline. */
export function BrandsTable({ initial }: { initial: AdminBrandRow[] }) {
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [deleting, setDeleting] = useState<AdminBrandRow | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (filter === "ALL" || r.status === filter) && (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q)));
  }, [rows, query, filter]);
  // Reordering a filtered list would be ambiguous, so it's only on for the full list.
  const canSort = filter === "ALL" && !query.trim();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const nameOf = (id: string | number) => rows.find((r) => r.id === id)?.name ?? "Brand";
  const posOf = (id: string | number) => rows.findIndex((r) => r.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, position ${posOf(active.id)} of ${rows.length}. Use the arrow keys to move, Space to drop.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} moved to position ${posOf(over.id)} of ${rows.length}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped at position ${posOf(over.id)} of ${rows.length}. The home page uses this order.` : undefined),
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} cancelled.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const before = rows;
    const next = arrayMove(rows, rows.findIndex((r) => r.id === active.id), rows.findIndex((r) => r.id === over.id));
    setRows(next); // optimistic
    start(async () => {
      const r = await reorderBrands(next.map((x) => x.id));
      if (r.error) {
        setRows(before); // roll back
        toast(r.error, "error");
      } else toast(r.ok!);
    });
  }

  function changeStatus(row: AdminBrandRow, status: Status) {
    const before = rows;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status } : r)));
    start(async () => {
      const r = await setStatus(row.id, status);
      if (r.error) {
        setRows(before);
        toast(r.error, "error");
      } else toast(r.ok!);
    });
  }

  const duplicate = (row: AdminBrandRow) =>
    start(async () => {
      const r = await duplicateBrand(row.id);
      toast(r.ok ?? r.error!, r.error ? "error" : "success");
      router.refresh();
    });

  const remove = () =>
    deleting &&
    start(async () => {
      const r = await deleteBrand(deleting.id, deleting.name);
      toast(r.ok ?? r.error!, r.error ? "error" : "success");
      if (!r.error) {
        setRows((rs) => rs.filter((x) => x.id !== deleting.id));
        setDeleting(null);
      }
    });

  return (
    <>
      <div className="mb-3 mt-6 flex flex-wrap items-center gap-3">
        <label className="relative w-full max-w-[280px]">
          <span className="sr-only">Search brands</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brands" className={`${inputClass} pl-9`} />
        </label>
        <div role="radiogroup" aria-label="Show" className="inline-flex rounded-segment bg-track p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={`motion-colors h-7 rounded-segment-item px-3 text-caption font-medium ${filter === f ? "bg-pill text-ink shadow-pill" : "text-muted hover:text-ink"}`}
            >
              {f === "ALL" ? "All" : STATUS_LABEL[f]}
              <span className="ml-1 tabular-nums text-muted">{f === "ALL" ? rows.length : rows.filter((r) => r.status === f).length}</span>
            </button>
          ))}
        </div>
        {!canSort && <p className="text-caption text-muted">Clear the search and filter to reorder.</p>}
      </div>

      <div className="overflow-x-auto rounded-card border border-hairline bg-surface">
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: "To reorder, press Space, use the arrow keys, then press Space again." } }}>
          <table className="w-full min-w-[640px] text-left text-small max-sm:min-w-0">
            <thead>
              <tr className="border-b border-hairline text-caption uppercase tracking-[0.06em] text-muted">
                <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Order</span></th>
                <th scope="col" className="px-3 py-3 font-medium">Brand</th>
                <th scope="col" className="px-3 py-3 font-medium max-sm:hidden">URL</th>
                <th scope="col" className="px-3 py-3 font-medium">Status</th>
                <th scope="col" className="px-3 py-3 font-medium max-md:hidden">Content</th>
                <th scope="col" className="px-3 py-3 font-medium max-md:hidden">Updated</th>
                <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <SortableContext items={visible.map((r) => r.id)} strategy={verticalListSortingStrategy} disabled={!canSort}>
              <tbody className="divide-y divide-hairline">
                {visible.map((row) => (
                  <Row key={row.id} row={row} canSort={canSort} pending={pending} onStatus={changeStatus} onDuplicate={duplicate} onDelete={setDeleting} />
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted">
                      {rows.length ? "No brands match." : "No brands yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name ?? ""}?`}
        confirmLabel="Delete brand"
        danger
        requireText={deleting?.name}
        pending={pending}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        Every logo, color and file of this brand is removed, and its page stops working. This can&apos;t be undone.
      </ConfirmDialog>
    </>
  );
}

function Row({
  row,
  canSort,
  pending,
  onStatus,
  onDuplicate,
  onDelete,
}: {
  row: AdminBrandRow;
  canSort: boolean;
  pending: boolean;
  onStatus: (row: AdminBrandRow, s: Status) => void;
  onDuplicate: (row: AdminBrandRow) => void;
  onDelete: (row: AdminBrandRow) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled: !canSort });
  const href = `/admin/brands/${row.id}/`;
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={`bg-surface ${isDragging ? "relative z-10 shadow-lift" : ""}`}>
      <td className="px-2 py-3">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          disabled={!canSort}
          aria-label={`Reorder ${row.name}`}
          className="grid size-8 cursor-grab touch-none place-items-center rounded-[8px] text-muted hover:bg-hover hover:text-ink active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      </td>
      <td className="px-3 py-3">
        <Link href={href} className="flex items-center gap-3 rounded-[6px] font-medium hover:underline hover:underline-offset-4">
          {row.icon ? (
            <img src={row.icon} alt="" className="size-8 shrink-0 rounded-[8px] ring-1 ring-hairline" />
          ) : (
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-track text-caption text-muted ring-1 ring-hairline">
              {row.name.charAt(0)}
            </span>
          )}
          {row.name}
        </Link>
      </td>
      <td className="px-3 py-3 tabular-nums text-muted max-sm:hidden">/{row.slug}/</td>
      <td className="px-3 py-3">
        <StatusSelect value={row.status} disabled={pending} aria-label={`Status of ${row.name}`} onChange={(e) => onStatus(row, e.target.value as Status)} />
      </td>
      <td className="px-3 py-3 tabular-nums text-muted max-md:hidden">
        {row.logos} logos · {row.colors} colors
      </td>
      <td className="px-3 py-3 tabular-nums text-muted max-md:hidden" suppressHydrationWarning>
        {ago(row.updatedAt)}
      </td>
      <td className="px-2 py-3">
        <Menu
          label={`Actions for ${row.name}`}
          trigger={<MoreHorizontal aria-hidden className="size-4" />}
          items={[
            { label: "Edit", icon: <Pencil aria-hidden className="size-4 text-muted" />, href },
            row.status === "DRAFT"
              ? { label: "View page", icon: <ArrowUpRight aria-hidden className="size-4 text-muted" />, href: "#", disabled: true, hint: "Draft" }
              : { label: "View page", icon: <ArrowUpRight aria-hidden className="size-4 text-muted" />, href: `/${row.slug}/`, external: true },
            { label: "Duplicate", icon: <Copy aria-hidden className="size-4 text-muted" />, onSelect: () => onDuplicate(row) },
            { label: "Delete…", icon: <Trash2 aria-hidden className="size-4" />, danger: true, onSelect: () => onDelete(row) },
          ]}
        />
      </td>
    </tr>
  );
}
