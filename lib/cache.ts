import { TRANSCRIPT_CACHE_KEY, TRANSCRIPT_CACHE_TTL_MS } from "./constants";
import type { TranscriptCache } from "./types";

/**
 * localStorage の生 JSON が期待する形かどうかを検証する
 */
function isTranscriptCache(value: unknown): value is TranscriptCache {
  if (!value || typeof value !== "object") {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.text === "string" &&
    typeof o.savedAt === "number" &&
    Number.isFinite(o.savedAt)
  );
}

/**
 * 有効期限内ならキャッシュした確定テキストを返す。
 * 期限切れ・破損時はキーを削除して空文字を返す。
 */
export function loadTranscriptCache(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const raw = window.localStorage.getItem(TRANSCRIPT_CACHE_KEY);
  if (!raw) {
    return "";
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isTranscriptCache(parsed)) {
      window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
      return "";
    }

    const expired =
      Date.now() - parsed.savedAt > TRANSCRIPT_CACHE_TTL_MS;

    if (expired) {
      window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
      return "";
    }

    return parsed.text;
  } catch {
    window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
    return "";
  }
}

/**
 * 確定テキストを localStorage に保存する（音声は保存しない）
 */
export function saveTranscriptCache(text: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const cache: TranscriptCache = { text, savedAt: Date.now() };
  window.localStorage.setItem(
    TRANSCRIPT_CACHE_KEY,
    JSON.stringify(cache),
  );
}

/**
 * 文字起こしキャッシュを削除する（クリアボタン等から呼ぶ想定）
 */
export function clearTranscriptCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
}
