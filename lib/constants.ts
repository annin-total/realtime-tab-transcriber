/** localStorage に保存する文字起こしキャッシュのキー */
export const TRANSCRIPT_CACHE_KEY = "transcript-cache-v1";

/** キャッシュの有効期限（24時間） */
export const TRANSCRIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** OpenAI Realtime 文字起こし用モデル識別子 */
export const REALTIME_MODEL = "gpt-realtime-whisper";

/** 既定の文字起こし言語（BCP 47） */
export const TRANSCRIPTION_LANGUAGE = "ja";

/** 認証済みセッション用 HttpOnly Cookie 名 */
export const AUTH_COOKIE_NAME = "transcriber_auth";

/** Cookie の max-age（秒）。7日間 */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
