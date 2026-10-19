import type { UsageView } from "@/lib/view";
import { DoDontPair } from "./DoDont";
import { Markdown } from "./Markdown";

/** The public Usage guidelines: written guidance, then the Do / Don't pairs. */
export function UsageSection({ usage }: { usage: UsageView }) {
  return (
    <>
      {usage.markdown && (
        <div className="max-w-[720px]">
          <Markdown>{usage.markdown}</Markdown>
        </div>
      )}
      {usage.pairs.length > 0 && (
        <ul aria-label="Do and don't" className={`flex flex-col gap-6 ${usage.markdown ? "mt-10" : ""}`}>
          {usage.pairs.map((p, i) => (
            <DoDontPair key={i} pair={p} />
          ))}
        </ul>
      )}
    </>
  );
}
