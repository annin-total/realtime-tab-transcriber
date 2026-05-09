import {
  TRANSCRIPT_CACHE_KEY,
  TRANSCRIPT_CACHE_TTL_MS,
  TRANSCRIPT_LINES_CACHE_KEY,
} from "./constants";
import type {
  TranscriptCache,
  TranscriptLine,
  TranscriptLinesCache,
} from "./types";

/**
 * 旧形式のキャッシュ JSON が期待する形かどうかを検証する
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
 * 1 行の永続化データが期待する形かどうかを検証する
 */
function isTranscriptLine(value: unknown): value is TranscriptLine {
  if (!value || typeof value !== "object") {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    (o.source === "tab" || o.source === "mic") &&
    typeof o.id === "string" &&
    typeof o.text === "string" &&
    typeof o.createdAt === "number" &&
    Number.isFinite(o.createdAt)
  );
}

/**
 * 行配列キャッシュ JSON が期待する形かどうかを検証する
 */
function isTranscriptLinesCache(value: unknown): value is TranscriptLinesCache {
  if (!value || typeof value !== "object") {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (
    typeof o.savedAt !== "number" ||
    !Number.isFinite(o.savedAt) ||
    !Array.isArray(o.lines)
  ) {
    return false;
  }
  return o.lines.every((line) => isTranscriptLine(line));
}

/**
 * 旧 `transcript-cache-v1` の連結テキストをタブ由来の行へ変換する
 */
function migrateLegacyTextToLines(text: string): TranscriptLine[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const now = Date.now();
  return trimmed
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => ({
      id: crypto.randomUUID(),
      source: "tab" as const,
      text: line,
      createdAt: now,
    }));
}

/**
 * 有効期限内なら確定行配列を返す。旧キャッシュのみ存在する場合は一度だけ移行する。
 */
export function loadTranscriptLinesCache(): TranscriptLine[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawLines = window.localStorage.getItem(TRANSCRIPT_LINES_CACHE_KEY);
  if (rawLines) {
    try {
      const parsed: unknown = JSON.parse(rawLines);
      if (!isTranscriptLinesCache(parsed)) {
        window.localStorage.removeItem(TRANSCRIPT_LINES_CACHE_KEY);
        return [];
      }
      if (Date.now() - parsed.savedAt > TRANSCRIPT_CACHE_TTL_MS) {
        window.localStorage.removeItem(TRANSCRIPT_LINES_CACHE_KEY);
        return [];
      }
      return parsed.lines;
    } catch {
      window.localStorage.removeItem(TRANSCRIPT_LINES_CACHE_KEY);
      return [];
    }
  }

  const rawLegacy = window.localStorage.getItem(TRANSCRIPT_CACHE_KEY);
  if (!rawLegacy) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawLegacy);
    if (!isTranscriptCache(parsed)) {
      window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
      return [];
    }
    if (Date.now() - parsed.savedAt > TRANSCRIPT_CACHE_TTL_MS) {
      window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
      return [];
    }
    const lines = migrateLegacyTextToLines(parsed.text);
    window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
    if (lines.length > 0) {
      saveTranscriptLinesCache(lines);
    }
    return lines;
  } catch {
    window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
    return [];
  }
}

/** 確定行を localStorage に保存する（音声は保存しない） */
export function saveTranscriptLinesCache(lines: TranscriptLine[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const cache: TranscriptLinesCache = { lines, savedAt: Date.now() };
  window.localStorage.setItem(
    TRANSCRIPT_LINES_CACHE_KEY,
    JSON.stringify(cache),
  );
}

/**
 * 文字起こしキャッシュを削除する（旧キー・新キーとも）
 */
export function clearTranscriptCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TRANSCRIPT_LINES_CACHE_KEY);
  window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
}
