import {
  ERR_AUDIO_SHARE_OFF,
  ERR_OPENAI_CONNECTION,
  ERR_SERVER_CONFIG,
  ERR_UNSUPPORTED_BROWSER,
} from "@/constants/transcription-errors";

/**
 * 例外や生メッセージを、PR-11 で定義したユーザー向け文言へ正規化する
 */
export function mapTranscriptionFlowError(input: unknown): string {
  const msg = input instanceof Error ? input.message : String(input);

  if (msg === ERR_UNSUPPORTED_BROWSER) return msg;
  if (msg === ERR_AUDIO_SHARE_OFF) return msg;

  if (/OPENAI_API_KEY|OPENAI_API_KEY is not set|is not set/i.test(msg)) {
    return ERR_SERVER_CONFIG;
  }

  if (
    msg.includes("セッション取得") ||
    msg.includes("WebRTC") ||
    msg.includes("DataChannel") ||
    msg.includes("realtime") ||
    /\bHTTP\s+\d{3}\b/.test(msg)
  ) {
    return ERR_OPENAI_CONNECTION;
  }

  return ERR_OPENAI_CONNECTION;
}
