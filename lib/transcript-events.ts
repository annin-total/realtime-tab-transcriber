import type { TranscriptEvent } from "./types";

/** DataChannel 経由の生 JSON を最低限の形に読む */
type RealtimeEvent = {
  type?: unknown;
  delta?: unknown;
  transcript?: unknown;
};

/**
 * Realtime の文字起こし関連イベントだけを {@link TranscriptEvent} に変換する
 */
export function parseTranscriptEvent(event: unknown): TranscriptEvent | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const e = event as RealtimeEvent;
  const type = e.type;

  if (
    type === "conversation.item.input_audio_transcription.delta" &&
    typeof e.delta === "string" &&
    e.delta.length > 0
  ) {
    return { type: "delta", text: e.delta };
  }

  if (
    type === "conversation.item.input_audio_transcription.completed" &&
    typeof e.transcript === "string" &&
    e.transcript.length > 0
  ) {
    return { type: "completed", text: e.transcript };
  }

  return null;
}
