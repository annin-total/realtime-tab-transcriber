import {
  LABEL_FINAL,
  LABEL_SOURCE_SELF,
  LABEL_SOURCE_TAB,
  LABEL_TENTATIVE,
} from "@/constants/transcription-ui";
import type { TranscriptLine, TranscriptSource } from "@/lib/types";

type TranscriptTimelineProps = {
  lines: TranscriptLine[];
  partialTab: string;
  partialMic: string;
};

function sourceLabel(source: TranscriptSource): string {
  return source === "tab" ? LABEL_SOURCE_TAB : LABEL_SOURCE_SELF;
}

/**
 * ソース別の暫定と、確定行の時系列を表示する
 */
export function TranscriptTimeline({
  lines,
  partialTab,
  partialMic,
}: TranscriptTimelineProps) {
  const tentativeBoxClass =
    "overflow-y-auto rounded-lg border border-dashed border-zinc-300 bg-white p-3 text-sm leading-relaxed text-zinc-900 whitespace-pre-wrap dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100";
  const finalBoxClass =
    "h-[300vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-900 whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <div className="flex flex-col gap-6">
      <section
        className="flex flex-col gap-2"
        aria-labelledby="tentative-heading"
      >
        <h2
          id="tentative-heading"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {LABEL_TENTATIVE}
        </h2>
        <div className="flex flex-col gap-3">
          <div className={tentativeBoxClass} aria-live="polite">
            <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
              {LABEL_SOURCE_TAB}
            </div>
            {partialTab ? (
              partialTab
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">（なし）</span>
            )}
          </div>
          <div className={tentativeBoxClass} aria-live="polite">
            <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
              {LABEL_SOURCE_SELF}
            </div>
            {partialMic ? (
              partialMic
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">（なし）</span>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="final-heading">
        <h2
          id="final-heading"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {LABEL_FINAL}
        </h2>
        <div className={finalBoxClass} aria-live="polite" aria-relevant="additions text">
          {lines.length === 0 ? (
            <span className="text-zinc-400 dark:text-zinc-500">（なし）</span>
          ) : (
            <ul className="flex flex-col gap-4">
              {lines.map((line) => (
                <li key={line.id} className="border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
                  <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {sourceLabel(line.source)}
                  </div>
                  <div className="whitespace-pre-wrap">{line.text}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
