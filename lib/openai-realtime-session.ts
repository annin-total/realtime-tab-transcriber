import { REALTIME_MODEL, TRANSCRIPTION_LANGUAGE } from "./constants";

/**
 * `OPENAI_REALTIME_TRANSCRIPTION_MODEL` があれば優先。
 * 未設定時は `REALTIME_MODEL`（既定 `gpt-4o-transcribe`）。
 */
function getTranscriptionSessionModel(): string {
  const fromEnv = process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim();
  return fromEnv || REALTIME_MODEL;
}

/**
 * `POST /v1/realtime/client_secrets` のリクエスト body。
 * WebRTC の `POST /v1/realtime/calls` と同じ GA API バージョンの secret を発行する。
 * @see https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create
 */
export function buildRealtimeClientSecretBody(): string {
  const model = getTranscriptionSessionModel();

  const transcription: Record<string, unknown> = {
    model,
    language: TRANSCRIPTION_LANGUAGE,
  };
  if (model === "gpt-realtime-whisper") {
    transcription.delay = "low";
  }

  const input: Record<string, unknown> = {
    format: { type: "audio/pcm", rate: 24000 },
    transcription,
  };

  /* GA: gpt-realtime-whisper の transcription では turn_detection は null（公式制約） */
  if (model === "gpt-realtime-whisper") {
    input.turn_detection = null;
  } else {
    input.turn_detection = {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    };
  }

  return JSON.stringify({
    expires_after: {
      anchor: "created_at",
      seconds: 600,
    },
    session: {
      type: "transcription",
      audio: {
        input,
      },
    },
  });
}
