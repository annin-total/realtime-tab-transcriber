/** localStorage に保存する文字起こしキャッシュのキー */
export const TRANSCRIPT_CACHE_KEY = "transcript-cache-v1";

/** キャッシュの有効期限（24時間） */
export const TRANSCRIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** OpenAI Realtime transcription_sessions 既定モデル（精度優先。`OPENAI_REALTIME_TRANSCRIPTION_MODEL` で上書き可） */
export const REALTIME_MODEL = "gpt-4o-transcribe";

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
