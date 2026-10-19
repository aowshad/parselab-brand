import { Check, X } from "lucide-react";

export type DoDontSide = { src: string | null; caption: string };

/** One Do / Don't pair: two cards with an image, a verdict and a caption. */
export function DoDontPair({ pair }: { pair: { do: DoDontSide; dont: DoDontSide } }) {
  return (
    <li className="grid gap-4 sm:grid-cols-2">
      <Card side={pair.do} good />
      <Card side={pair.dont} good={false} />
    </li>
  );
}

function Card({ side, good }: { side: DoDontSide; good: boolean }) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface">
      {side.src ? (
        <div className="grid aspect-[16/10] place-items-center border-b border-hairline bg-thumb p-4">
          <img src={side.src} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
      <figcaption className="flex items-start gap-2 p-4 text-small">
        <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-btn-ink ${good ? "bg-success" : "bg-error"}`}>
          {good ? <Check aria-hidden className="size-3.5" /> : <X aria-hidden className="size-3.5" />}
        </span>
        <span>
          <span className="font-semibold">{good ? "Do" : "Don't"}</span>
          {side.caption && <span className="text-muted"> · {side.caption}</span>}
        </span>
      </figcaption>
    </figure>
  );
}
