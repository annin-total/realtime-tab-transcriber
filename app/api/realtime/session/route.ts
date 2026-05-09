import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthValue } from "@/lib/auth";
import { OPENAI_REALTIME_CLIENT_SECRETS_URL } from "@/lib/constants";
import { buildRealtimeClientSecretBody } from "@/lib/openai-realtime-session";

export const runtime = "nodejs";

/** `POST /v1/realtime/client_secrets` の成功レスポンス（抜粋） */
type ClientSecretsCreateResponse = {
  value?: string;
  expires_at?: number;
};

/**
 * `POST /api/realtime/session`
 * OpenAI `/v1/realtime/client_secrets` を呼び出し、
 * ブラウザが WebRTC `calls` に使う短命トークンを返す。
 * APIキーはサーバー環境変数のみ使用し、ブラウザには渡さない。
 * @see https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create
 */
export async function POST() {
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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const orgId = process.env.OPENAI_ORGANIZATION?.trim();
  if (orgId) {
    headers["OpenAI-Organization"] = orgId;
  }

  const response = await fetch(OPENAI_REALTIME_CLIENT_SECRETS_URL, {
    method: "POST",
    headers,
    body: buildRealtimeClientSecretBody(),
  });

  if (!response.ok) {
    const raw = await response.text();
    let message: string;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      message =
        parsed.error?.message ??
        `OpenAI API エラー（HTTP ${response.status}）`;
    } catch {
      message = `OpenAI API エラー（HTTP ${response.status}）`;
    }
    return NextResponse.json(
      { error: message },
      { status: response.status },
    );
  }

  const data = (await response.json()) as ClientSecretsCreateResponse;

  if (!data.value) {
    return NextResponse.json(
      { error: "ephemeral token が取得できませんでした" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    client_secret: data.value,
    expires_at: data.expires_at,
  });
}
