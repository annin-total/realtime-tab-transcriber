import {
  APP_STATUS_LABEL,
  LABEL_STATUS_HEADING,
} from "@/constants/transcription-ui";
import type { AppStatus } from "@/lib/types";

type StatusBadgeProps = {
  status: AppStatus;
  /** `error` 時に補足する短いメッセージ（任意） */
  errorDetail?: string | null;
};

/**
 * 現在の接続・文字起こしの粗い状態のみを表示する
 */
export function StatusBadge({ status, errorDetail }: StatusBadgeProps) {
  const base = APP_STATUS_LABEL[status];
  const text =
    status === "error" && errorDetail?.trim()
      ? `${base}（${errorDetail.trim()}）`
      : base;

  return (
    <p
      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
      aria-live="polite"
    >
      <span className="font-medium text-zinc-500 dark:text-zinc-400">
        {LABEL_STATUS_HEADING}{" "}
      </span>
      {text}
    </p>
  );
}
