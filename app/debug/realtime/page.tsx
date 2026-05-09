"use client";

import { useCallback, useState } from "react";
import { OPENAI_REALTIME_CALLS_URL } from "@/lib/constants";

type StepResult = {
  ok?: boolean;
  step?: string;
  elapsedMs?: number;
  error?: string;
  upstreamStatus?: number;
  bodyPreview?: string;
  body?: unknown;
  client_secret_present?: boolean;
  sdpLength?: number;
};

export default function DebugRealtimePage() {
  const [tokenLog, setTokenLog] = useState<string>("未実行");
  const [sdpLog, setSdpLog] = useState<string>("未実行");
  const [busy, setBusy] = useState(false);


  const runFull = useCallback(async () => {
    setBusy(true);
    setTokenLog("Step 1: ephemeral token 取得中…");
    setSdpLog("未実行");

    try {
      /* Step 1: サーバー経由で ephemeral token */
      const tokenRes = await fetch("/api/debug/realtime-proxy?step=token", {
        method: "POST",
      });
      const tokenData = (await tokenRes.json()) as StepResult & {
        client_secret_expires_at?: number;
      };
      setTokenLog(JSON.stringify(tokenData, null, 2));

      if (!tokenData.ok) {
        setSdpLog("Step 1 が失敗したため中断");
        return;
      }

      setSdpLog("Step 2: マイク Offer 生成 → OpenAI calls へ POST 中…（マイク許可が出ます）");

      /* Step 2: ブラウザ側 — マイクで SDP offer を作り直接 OpenAI へ */
      const pc = new RTCPeerConnection();
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => pc.addTrack(t, stream!));
        pc.createDataChannel("oai-events");

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        /* ephemeral token を Step 1 で取得済みのため、ここでは debug proxy の step=sdp で再現 */
        const sdpRes = await fetch("/api/debug/realtime-proxy?step=sdp&token=dummy", {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp ?? "",
        });

        /* 注意: このデバッグページでは token が dummy なので失敗するが、
                 実アプリは /api/realtime/session → ephemeral token → 直接 OpenAI へ POST する */
        const sdpData = (await sdpRes.json()) as StepResult;
        setSdpLog(
          "【補足】デバッグページでは ephemeral token をブラウザに渡せないため\n" +
          "実際の token=dummy で試しています。401/422 は正常（token 無効）。\n\n" +
          JSON.stringify(sdpData, null, 2),
        );
      } finally {
        stream?.getTracks().forEach((t) => t.stop());
        pc.close();
      }
    } catch (e) {
      setSdpLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const runTokenOnly = useCallback(async () => {
    setBusy(true);
    setTokenLog("Step 1: ephemeral token 取得中…");
    try {
      const res = await fetch("/api/debug/realtime-proxy?step=token", { method: "POST" });
      const data = await res.json() as StepResult;
      setTokenLog(JSON.stringify(data, null, 2));
    } catch (e) {
      setTokenLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">OpenAI Realtime 接続検証（2ステップ方式）</h1>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900">
        <p className="font-medium">正しい接続フロー（gpt-realtime-whisper）</p>
        <ol className="mt-2 list-decimal pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong>サーバー</strong>: <code>POST /v1/realtime/transcription_sessions</code> → ephemeral token（60秒有効）
          </li>
          <li>
            <strong>ブラウザ</strong>: マイク/タブ音声 → RTCPeerConnection → createOffer
          </li>
          <li>
            <strong>ブラウザ</strong>: <code>POST {OPENAI_REALTIME_CALLS_URL}</code> with <code>Authorization: Bearer &lt;ephemeral_token&gt;</code>
          </li>
          <li>SDP answer → setRemoteDescription → 接続完了</li>
        </ol>
        <p className="mt-2 text-amber-700 dark:text-amber-300">
          ⚠ Free プランは <code>gpt-realtime-whisper</code> 非対応。Tier 1 以上が必要。
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          onClick={runTokenOnly}
        >
          Step 1 のみ（token 取得）
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-zinc-400 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
          onClick={runFull}
        >
          Step 1 + Step 2（フル検証）
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium">Step 1: transcription_sessions → ephemeral token</p>
        <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-300 bg-white p-4 text-xs whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-900">
          {tokenLog}
        </pre>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium">Step 2: SDP → OpenAI calls → SDP answer</p>
        <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-300 bg-white p-4 text-xs whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-900">
          {sdpLog}
        </pre>
      </section>
    </main>
  );
}
