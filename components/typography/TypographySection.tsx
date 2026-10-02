import { ArrowUpRight } from "lucide-react";
import { WEIGHT_NAMES } from "@/lib/typography";
import type { TypographyView } from "@/lib/view";
import { buttonClass } from "../ui/Button";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789";
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** Typeface cards (specimen, weights, where to get it), then the type scale set in those faces. */
export function TypographySection({ typography }: { typography: TypographyView }) {
  return (
    <>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {typography.typefaces.map((face) => (
          <li key={face.family} className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface">
            <div aria-hidden className="grid h-32 place-items-center border-b border-hairline bg-thumb" style={{ fontFamily: face.fontFamily }}>
              <span className="text-[64px] leading-none" style={{ fontWeight: Math.max(...face.weights) }}>
                Aa
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="text-caption uppercase tracking-[0.06em] text-muted">{face.role}</p>
              <h3 className="mt-1 text-h3">{face.family}</h3>
              <p className="mt-2 text-small text-pretty text-muted [overflow-wrap:anywhere]" style={{ fontFamily: face.fontFamily }}>
                {CHARSET}
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label={`${face.family} weights`}>
                {face.weights.map((w) => (
                  <li key={w} className="text-small tabular-nums" style={{ fontFamily: face.fontFamily, fontWeight: w }}>
                    {WEIGHT_NAMES[w]} {w}
                  </li>
                ))}
              </ul>
              <a
                href={face.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Get ${face.family} on ${hostOf(face.url)} (opens in a new tab)`}
                className={buttonClass({ variant: "ghost", size: "sm", className: "mt-4 self-start" })}
              >
                Get the font
                <span className="text-muted">· {hostOf(face.url)}</span>
                <ArrowUpRight aria-hidden className="size-4" />
              </a>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="mt-12 text-h3">Type scale</h3>
      <ol className="mt-4 divide-y divide-hairline rounded-card border border-hairline bg-surface">
        {typography.scale.map((step) => (
          <li key={step.name} className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-baseline">
            <div>
              <p className="text-small font-medium">{step.name}</p>
              <p className="text-caption tabular-nums text-muted">
                {step.size} / {step.lineHeight} · {WEIGHT_NAMES[step.weight]}
              </p>
              <p className="text-caption text-muted">{step.face.family}</p>
            </div>
            <p
              className="min-w-0 text-pretty [overflow-wrap:anywhere]"
              style={{
                fontFamily: step.face.fontFamily,
                fontSize: step.size,
                lineHeight: `${step.lineHeight}px`,
                fontWeight: step.weight,
                letterSpacing: step.tracking ? `${step.tracking}em` : undefined,
              }}
            >
              {step.sample}
            </p>
          </li>
        ))}
      </ol>
    </>
  );
}
