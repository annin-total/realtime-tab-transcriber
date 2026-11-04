import {
  BTN_COPY,
  BTN_HISTORY_BACK,
  BTN_HISTORY_DELETE,
  LABEL_SOURCE_SELF,
  LABEL_SOURCE_TAB,
} from "@/constants/transcription-ui";
import { formatHistoryDate, formatHistoryDuration } from "@/lib/history-format";
import type { HistoryEntry } from "@/lib/types";

type HistoryDetailProps = {
  entry: HistoryEntry;
  onBack: () => void;
  onCopy: () => void;
  onDelete: () => void;
};

const subtleBtn =
  "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

/** 履歴 1 件の本文表示とコピー・削除 */
export function HistoryDetail({
  entry,
  onBack,
  onCopy,
  onDelete,
}: HistoryDetailProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={subtleBtn} onClick={onBack}>
          {BTN_HISTORY_BACK}
        </button>
        <button type="button" className={subtleBtn} onClick={onCopy}>
          {BTN_COPY}
        </button>
        <button
          type="button"
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40"
          onClick={onDelete}
        >
          {BTN_HISTORY_DELETE}
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {formatHistoryDate(entry.startedAt)}・
        {formatHistoryDuration(entry.updatedAt - entry.startedAt)}
      </p>
      <ul className="flex flex-col gap-4 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
        {entry.lines.map((line) => (
          <li
            key={line.id}
            className="border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800"
          >
            <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {line.source === "tab" ? LABEL_SOURCE_TAB : LABEL_SOURCE_SELF}
            </div>
            <div className="whitespace-pre-wrap">{line.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
