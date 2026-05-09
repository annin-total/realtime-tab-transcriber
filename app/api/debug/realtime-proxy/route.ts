import { NextResponse } from "next/server";
import {
  OPENAI_REALTIME_CALLS_URL,
  OPENAI_REALTIME_CLIENT_SECRETS_URL,
} from "@/lib/constants";
import { buildRealtimeClientSecretBody } from "@/lib/openai-realtime-session";

export const runtime = "nodejs";

/**
 * 開発時のみ。本番（NODE_ENV=production）では常に 404。
 *
 * @example ステップ1: ephemeral token を取得（サーバー側呼び出し）
 * ```bash
 * curl -sS -X POST "http://localhost:3000/api/debug/realtime-proxy?step=token"
 * ```
 *
 * @example ステップ2: SDP answer を取得（ブラウザ側呼び出しの再現）
 * POST body に ephemeral token を `Authorization: Bearer` で付けてテスト
 * ```bash
 * curl -sS -X POST "http://localhost:3000/api/debug/realtime-proxy?step=sdp&token=EPH_TOKEN" \
 *   --data-binary $'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
 * ```
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not set" },
    );
  }

  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") ?? "token";

  const started = Date.now();

  if (step === "token") {
    /* Step 1: client_secrets → ephemeral token（calls と同じ GA） */
    const tokenHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    const orgId = process.env.OPENAI_ORGANIZATION?.trim();
    if (orgId) {
      tokenHeaders["OpenAI-Organization"] = orgId;
    }

    let res: Response;
    try {
      res = await fetch(OPENAI_REALTIME_CLIENT_SECRETS_URL, {
        method: "POST",
        headers: tokenHeaders,
        body: buildRealtimeClientSecretBody(),
      });
    } catch (e) {
      return NextResponse.json({
        ok: false,
        step,
        phase: "fetch",
        elapsedMs: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const elapsedMs = Date.now() - started;

    if (!res.ok) {
      const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
      return NextResponse.json({
        ok: false,
        step,
        phase: "openai",
        upstreamStatus: res.status,
        elapsedMs,
        body: raw,
      });
    }

    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      step,
      elapsedMs,
      client_secret_present:
        typeof data.value === "string" && data.value.length > 0,
      client_secret_expires_at: data.expires_at,
    });
  }

  if (step === "sdp") {
    /* Step 2: ブラウザ側操作の再現 — ephemeral token で calls に SDP POST */
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.json({ ok: false, error: "?token= が必要です" });
    }

    const sdp = await request.text();

    let res: Response;
    try {
      res = await fetch(OPENAI_REALTIME_CALLS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Authorization: `Bearer ${token}`,
        },
        body: sdp,
      });
    } catch (e) {
      return NextResponse.json({
        ok: false,
        step,
        phase: "fetch",
        elapsedMs: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const elapsedMs = Date.now() - started;

    if (!res.ok) {
      const raw = await res.text();
      const looksHtml = /^<!DOCTYPE/i.test(raw.trim());
      return NextResponse.json({
        ok: false,
        step,
        phase: "openai",
        upstreamStatus: res.status,
        elapsedMs,
        bodyPreview: looksHtml ? "(HTML エラー本文を省略)" : raw.slice(0, 800),
      });
    }

    const answerSdp = await res.text();
    return NextResponse.json({
      ok: true,
      step,
      elapsedMs,
      sdpLength: answerSdp.length,
    });
  }

  return NextResponse.json({ ok: false, error: "?step=token|sdp が必要です" });
}
