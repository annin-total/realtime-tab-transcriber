import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthValue } from "@/lib/auth";
import {
  OPENAI_REALTIME_CALLS_URL,
  REALTIME_MODEL,
  TRANSCRIPTION_LANGUAGE,
} from "@/lib/constants";

export const runtime = "nodejs";

/**
 * ブラウザの SDP offer を OpenAI `/v1/realtime/calls` へ中継し、SDP answer を返す。
 * API キーはサーバー環境変数のみで使用する。
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!verifyAuthValue(authCookie)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set" },
      { status: 500 },
    );
  }

  const sdp = await request.text();

  const sessionConfig = {
    type: "transcription",
    audio: {
      input: {
        transcription: {
          model: REALTIME_MODEL,
          language: TRANSCRIPTION_LANGUAGE,
          delay: "low" as const,
        },
        turn_detection: {
          type: "server_vad" as const,
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    },
  };

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(sessionConfig));

  const response = await fetch(OPENAI_REALTIME_CALLS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json({ error: message }, { status: response.status });
  }

  return new Response(await response.text(), {
    headers: { "Content-Type": "application/sdp" },
  });
}
