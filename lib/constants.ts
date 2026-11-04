/** localStorage に保存する文字起こしキャッシュのキー（旧・移行元） */
export const TRANSCRIPT_CACHE_KEY = "transcript-cache-v1";

/** 確定行＋ソース付きキャッシュのキー */
export const TRANSCRIPT_LINES_CACHE_KEY = "transcript-lines-cache-v1";

/** キャッシュの有効期限（24時間） */
export const TRANSCRIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 文字起こし履歴を保存する IndexedDB の DB 名・バージョン・ストア名 */
export const HISTORY_DB_NAME = "transcript-history";
export const HISTORY_DB_VERSION = 1;
export const HISTORY_STORE = "entries";

/** 履歴の保持期間（7日間） */
export const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Realtime transcription 既定モデル（`OPENAI_REALTIME_TRANSCRIPTION_MODEL` で上書き可） */
export const REALTIME_MODEL = "gpt-4o-transcribe";

/** Realtime 接続を張り替える間隔。OpenAI のセッション上限（60分）より前に設定する */
export const REALTIME_SESSION_ROTATE_MS = 55 * 60 * 1000;

/** 張り替え失敗時の再試行間隔 */
export const REALTIME_ROTATE_RETRY_MS = 30 * 1000;

/** 張り替え用の新接続で DataChannel の開通を待つ上限 */
export const REALTIME_OPEN_TIMEOUT_MS = 15 * 1000;

/** 既定の文字起こし言語（BCP 47） */
export const TRANSCRIPTION_LANGUAGE = "ja";

/** 認証済みセッション用 HttpOnly Cookie 名 */
export const AUTH_COOKIE_NAME = "transcriber_auth";

/** Cookie の max-age（秒）。7日間 */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** パスコード認証 POST（相対パス） */
export const API_PATH_AUTH = "/api/auth";

/** 認証状態 GET（相対パス） */
export const API_PATH_AUTH_ME = "/api/auth/me";

/** ログアウト POST（相対パス） */
export const API_PATH_LOGOUT = "/api/logout";

/**
 * 文字起こし用 GA client secret 発行 POST（相対パス・認証必須）
 * サーバーが OpenAI `client_secrets` を呼び出し、短命トークンを返す
 */
export const API_PATH_REALTIME_SESSION = "/api/realtime/session";

/**
 * GA Realtime 用 client secret 発行（サーバーからのみ呼び出す）
 * @see https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create
 */
export const OPENAI_REALTIME_CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/client_secrets";

/**
 * ブラウザが ephemeral token を使って SDP を直接送るエンドポイント
 */
export const OPENAI_REALTIME_CALLS_URL =
  "https://api.openai.com/v1/realtime/calls";
