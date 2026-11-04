const PREVIEW_MAX_CHARS = 40;
const MINUTE_MS = 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** 例: `11/4(火) 14:05` */
export function formatHistoryDate(timestamp: number): string {
  return dateFormatter.format(timestamp);
}

/** 例: `1時間5分`。1分未満は `1分未満` */
export function formatHistoryDuration(durationMs: number): string {
  const totalMinutes = Math.floor(durationMs / MINUTE_MS);
  if (totalMinutes < 1) return "1分未満";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
}

/** 一覧表示用に本文の冒頭を 1 行で切り出す */
export function buildHistoryPreview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_MAX_CHARS
    ? `${flat.slice(0, PREVIEW_MAX_CHARS)}…`
    : flat;
}
