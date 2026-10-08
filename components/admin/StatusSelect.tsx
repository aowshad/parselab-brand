"use client";

import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

import { STATUS_LABEL, type Status } from "@/lib/admin/status";

export { STATUS_HELP, STATUS_LABEL, type Status } from "@/lib/admin/status";

/** A status pill that is a native <select>: keyboard and screen-reader friendly for free. */
export function StatusSelect({ value, ...props }: { value: Status } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value">) {
  const tone = value === "LIVE" ? "border-ink text-ink" : value === "SOON" ? "border-strong text-ink" : "border-dashed border-strong text-muted";
  return (
    <span className="relative inline-flex">
      <select
        value={value}
        {...props}
        className={`motion-colors h-7 cursor-pointer appearance-none rounded-full border bg-surface pl-3 pr-7 text-caption font-medium hover:bg-hover disabled:cursor-default ${tone}`}
      >
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
    </span>
  );
}
