import {
  BTN_CLEAR,
  BTN_COPY,
  BTN_START,
  BTN_STOP,
} from "@/constants/transcription-ui";
import type { AppStatus } from "@/lib/types";

type ActionButtonsProps = {
  status: AppStatus;
  onStart: () => void;
  onStop: () => void;
  onCopy: () => void;
  onClear: () => void;
  hasTranscript: boolean;
};

/**
 * 開始・停止・コピー・クリア。PR-06 では音声取得は行わない
 */
export function ActionButtons({
  status,
  onStart,
  onStop,
  onCopy,
  onClear,
  hasTranscript,
}: ActionButtonsProps) {
  const canStart = status === "idle" || status === "stopped";
  const canStop =
    status === "requesting_display" ||
    status === "connecting" ||
    status === "transcribing";
  const canCopyOrClear = hasTranscript;

  const baseBtn =
    "rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className={`${baseBtn} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200`}
        onClick={onStart}
        disabled={!canStart}
      >
        {BTN_START}
      </button>
      <button
        type="button"
        className={`${baseBtn} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`}
        onClick={onStop}
        disabled={!canStop}
      >
        {BTN_STOP}
      </button>
      <button
        type="button"
        className={`${baseBtn} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`}
        onClick={onCopy}
        disabled={!canCopyOrClear}
      >
        {BTN_COPY}
      </button>
      <button
        type="button"
        className={`${baseBtn} border border-red-200 bg-white text-red-800 hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40`}
        onClick={onClear}
        disabled={!canCopyOrClear}
      >
        {BTN_CLEAR}
      </button>
    </div>
  );
}
