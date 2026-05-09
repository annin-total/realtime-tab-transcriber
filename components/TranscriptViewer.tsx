import {
  LABEL_FINAL,
  LABEL_TENTATIVE,
} from "@/constants/transcription-ui";

type TranscriptViewerProps = {
  tentativeText: string;
  finalText: string;
};

/**
 * 暫定（ストリーミング中）と確定の文字起こしを別領域で表示する
 */
export function TranscriptViewer({
  tentativeText,
  finalText,
}: TranscriptViewerProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2" aria-labelledby="tentative-heading">
        <h2
          id="tentative-heading"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {LABEL_TENTATIVE}
        </h2>
        <div
          className="min-h-18 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-900 whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {tentativeText || (
            <span className="text-zinc-400 dark:text-zinc-500">（なし）</span>
          )}
        </div>
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="final-heading">
        <h2
          id="final-heading"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {LABEL_FINAL}
        </h2>
        <div className="min-h-24 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-relaxed text-zinc-900 whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
          {finalText || (
            <span className="text-zinc-400 dark:text-zinc-500">（なし）</span>
          )}
        </div>
      </section>
    </div>
  );
}
