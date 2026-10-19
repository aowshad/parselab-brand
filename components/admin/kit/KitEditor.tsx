"use client";

import { Download, Loader, RefreshCw, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { adminOp } from "@/lib/admin/api-client";
import { uploadFile } from "@/lib/admin/upload-client";
import { formatSize } from "@/lib/format";
import { buttonClass } from "../../ui/Button";
import { useToast } from "../../ui/Toast";

export type KitInfo = {
  /** Whose kit: a brand's, or (null) the site-wide "Download all" zip. */
  brandId: string | null;
  mode: "AUTO" | "MANUAL";
  kit: { name: string; sizeKb: number; builtAt: string | null; url: string } | null;
  /** What the automatic kit holds ("3 logos · 2 colors"), or null when there's nothing to build from. */
  contains: string | null;
  rebuilding: boolean;
  maxMb: number;
};

const COPY = {
  brand: {
    auto: "Built from every logo (SVG, and PNGs from 512 to 4096 px, in folders), plus colors.css, colors.json and a README. It rebuilds by itself whenever a logo or color changes.",
    empty: "No kit yet: it's built once the brand has a logo.",
    button: "Download kit",
  },
  site: {
    auto: "Every public brand's logos and colors in one ZIP, a folder per brand. It rebuilds by itself whenever a public brand's logos or colors change, or a brand is published or hidden.",
    empty: "No kit yet: it's built once a public brand has a logo.",
    button: "Download all",
  },
};
const when = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** Brand kit tab: Auto (built from the logos and colors) or Manual (your own zip). */
export function KitEditor({ info }: { info: KitInfo }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const inputId = useId();
  const copy = info.brandId ? COPY.brand : COPY.site;
  const route = info.brandId ? "/api/admin/kit/" : "/api/admin/settings/";
  const statusUrl = info.brandId ? `/api/admin/brands/${info.brandId}/status/` : "/api/admin/settings/";

  // While a rebuild runs, poll the status URL and refresh once it's done.
  useEffect(() => {
    if (!info.rebuilding) return;
    const t = setInterval(async () => {
      const r = await fetch(statusUrl, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (r && !r.rebuilding) {
        clearInterval(t);
        router.refresh();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [info.rebuilding, statusUrl, router]);

  async function run(o: string, args: Record<string, unknown> = {}) {
    setBusy(true);
    const r = await adminOp(route, o, info.brandId ? { brandId: info.brandId, ...args } : args);
    setBusy(false);
    toast(r.ok ?? r.error!, r.error ? "error" : "success");
    if (!r.error) router.refresh();
  }

  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      const up = await uploadFile(file, info.brandId ? { purpose: "kit-zip", brandId: info.brandId } : { purpose: "site-kit-zip" }, setProgress);
      setProgress(null);
      await run("upload", { fileId: up.fileId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="how-h" className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-6 max-sm:p-4">
        <h2 id="how-h" className="text-h3">
          How the kit is made
        </h2>
        <div role="radiogroup" aria-label="Kit mode" className="inline-flex self-start rounded-segment bg-track p-1">
          {(["AUTO", "MANUAL"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={info.mode === m}
              disabled={busy}
              onClick={() => info.mode !== m && run("mode", { mode: m })}
              className={`motion-colors h-8 rounded-segment-item px-3 text-small font-medium ${info.mode === m ? "bg-pill text-ink shadow-pill" : "text-muted hover:text-ink"}`}
            >
              {m === "AUTO" ? "Auto" : "Manual upload"}
            </button>
          ))}
        </div>
        {info.mode === "AUTO" ? (
          <p className="text-small text-pretty text-muted">{copy.auto}</p>
        ) : (
          <>
            <p className="text-small text-pretty text-muted">Upload your own ZIP (up to {info.maxMb} MB). It replaces the automatic kit until you switch back to Auto.</p>
            <label
              htmlFor={inputId}
              className={`grid cursor-pointer place-items-center gap-1 rounded-[12px] border-[1.5px] border-dashed border-strong bg-track px-4 py-8 text-center text-small text-muted ${progress !== null ? "pointer-events-none" : ""}`}
            >
              {progress !== null ? (
                <span aria-live="polite" className="w-2/3">
                  Uploading… {Math.round(progress * 100)}%
                  <span className="mt-2 block h-1 overflow-hidden rounded-full bg-hairline">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${progress * 100}%` }} />
                  </span>
                </span>
              ) : (
                <>
                  <UploadCloud aria-hidden className="size-5" />
                  <span className="font-medium text-ink">Drop a ZIP or click to upload</span>
                  <span className="text-caption">Saved as the &ldquo;{copy.button}&rdquo; file</span>
                </>
              )}
              <input id={inputId} type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => (e.target.files?.[0] && upload(e.target.files[0]), (e.target.value = ""))} />
            </label>
            {error && (
              <p role="alert" className="text-small text-error">
                {error}
              </p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="kit-h" className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-6 max-sm:p-4">
        <h2 id="kit-h" className="text-h3">
          Current kit
        </h2>
        {info.rebuilding ? (
          <p className="flex items-center gap-2 text-small text-muted" aria-live="polite">
            <Loader aria-hidden className="size-4 animate-spin" /> Rebuilding the kit…
          </p>
        ) : info.kit ? (
          <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2 text-small">
            <dt className="text-muted">File</dt>
            <dd className="break-all">{info.kit.name}</dd>
            <dt className="text-muted">Size</dt>
            <dd className="tabular-nums">{formatSize(info.kit.sizeKb)}</dd>
            <dt className="text-muted">{info.mode === "AUTO" ? "Built" : "Uploaded"}</dt>
            <dd className="tabular-nums" suppressHydrationWarning>
              {info.kit.builtAt ? when(info.kit.builtAt) : "—"}
            </dd>
            {info.mode === "AUTO" && info.contains && (
              <>
                <dt className="text-muted">Contains</dt>
                <dd>{info.contains}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-small text-muted">{info.mode === "AUTO" ? copy.empty : "No kit yet: upload a ZIP."} The public &ldquo;{copy.button}&rdquo; button stays hidden until there is one.</p>
        )}
        <div className="mt-auto flex flex-wrap gap-2">
          {info.kit && !info.rebuilding && (
            <a href={info.kit.url} className={buttonClass({ variant: "ghost" })}>
              <Download aria-hidden className="size-4" /> Download
            </a>
          )}
          {info.mode === "AUTO" && (
            <button type="button" disabled={busy || info.rebuilding || !info.contains} onClick={() => run("rebuild")} className={buttonClass({ variant: "quiet" })}>
              <RefreshCw aria-hidden className="size-4" /> Rebuild now
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
