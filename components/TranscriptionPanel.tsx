"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  TRANSCRIPTION_INSTRUCTION,
  TRANSCRIPTION_PAGE_TITLE,
} from "@/constants/transcription-ui";
import {
  clearTranscriptCache,
  loadTranscriptCache,
  saveTranscriptCache,
} from "@/lib/cache";
import {
  requestTabAudioStream,
  stopMediaStream,
} from "@/lib/display-media";
import { connectRealtime } from "@/lib/realtime-client";
import type { RealtimeConnection } from "@/lib/realtime-client";
import { parseTranscriptEvent } from "@/lib/transcript-events";
import type { AppStatus } from "@/lib/types";
import { ActionButtons } from "./ActionButtons";
import { StatusBadge } from "./StatusBadge";
import { TranscriptViewer } from "./TranscriptViewer";

function buildClipboardText(tentative: string, final: string): string {
  const parts: string[] = [];
  if (tentative.trim()) {
    parts.push(`【暫定】\n${tentative}`);
  }
  if (final.trim()) {
    parts.push(`【確定】\n${final}`);
  }
  return parts.join("\n\n");
}

/** 文字起こし画面の状態と子コンポーネントを束ねる親 */
export function TranscriptionPanel() {
  const streamRef = useRef<MediaStream | null>(null);
  const realtimeRef = useRef<RealtimeConnection | null>(null);
  /** 停止ボタン由来の解放か（トラック `ended` と二重通知を防ぐ） */
  const userInitiatedStopRef = useRef(false);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [tentativeText, setTentativeText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [hasDisplayStream, setHasDisplayStream] = useState(false);
  const [startBusy, setStartBusy] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setFinalText(loadTranscriptCache());
      setCacheHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!cacheHydrated) return;
    saveTranscriptCache(finalText);
  }, [finalText, cacheHydrated]);

  /** Realtime とタブ共有ストリームをまとめて解放する */
  const releaseDisplayStream = useCallback(() => {
    realtimeRef.current?.close();
    realtimeRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setHasDisplayStream(false);
  }, []);

  /** ブラウザ側で共有が切れたとき */
  useEffect(() => {
    if (!hasDisplayStream || !streamRef.current) return;

    const stream = streamRef.current;
    let ended = false;
    const onEnded = () => {
      if (ended) return;
      ended = true;
      if (userInitiatedStopRef.current) {
        userInitiatedStopRef.current = false;
        return;
      }
      releaseDisplayStream();
      setStatus((prev) =>
        prev === "transcribing" || prev === "connecting"
          ? "stopped"
          : prev,
      );
      setNotice("共有が終了しました。");
    };

    const tracks = stream.getTracks();
    tracks.forEach((t) => t.addEventListener("ended", onEnded));
    return () => {
      tracks.forEach((t) => t.removeEventListener("ended", onEnded));
    };
  }, [hasDisplayStream, releaseDisplayStream]);

  const hasTranscript = Boolean(tentativeText.trim() || finalText.trim());

  /** DataChannel の Realtime イベントを暫定・確定テキストへ反映する */
  const handleRealtimeEvent = useCallback((raw: unknown) => {
    const event = parseTranscriptEvent(raw);
    if (!event) return;

    if (event.type === "delta") {
      setTentativeText((prev) => prev + event.text);
      return;
    }

    setFinalText((prev) => {
      const next = `${prev}${prev ? "\n" : ""}${event.text}`;
      saveTranscriptCache(next);
      return next;
    });
    setTentativeText("");
  }, []);

  const handleStart = useCallback(async () => {
    if (status !== "idle" && status !== "stopped" && status !== "error") {
      return;
    }
    if (hasDisplayStream || startBusy) return;

    setNotice(null);
    setErrorDetail(null);
    setStartBusy(true);
    setStatus("requesting_display");

    try {
      const stream = await requestTabAudioStream();
      streamRef.current = stream;
      setHasDisplayStream(true);
      setStatus("connecting");

      await connectRealtime(
        stream,
        {
          onEvent: handleRealtimeEvent,
          onOpen: () => {
            setStatus("transcribing");
          },
          onError: (err) => {
            setErrorDetail(err.message);
            setStatus("error");
            releaseDisplayStream();
          },
        },
        realtimeRef,
      );
    } catch (e) {
      releaseDisplayStream();
      const domName = e instanceof DOMException ? e.name : "";
      if (domName === "NotAllowedError" || domName === "AbortError") {
        setStatus("idle");
        setNotice("共有がキャンセルされました。");
        return;
      }
      const message =
        e instanceof Error
          ? e.message
          : "画面共有または接続の開始に失敗しました。";
      setErrorDetail(message);
      setStatus("error");
    } finally {
      setStartBusy(false);
    }
  }, [handleRealtimeEvent, hasDisplayStream, releaseDisplayStream, startBusy, status]);

  const handleStop = useCallback(() => {
    userInitiatedStopRef.current = true;
    setNotice(null);
    setErrorDetail(null);
    releaseDisplayStream();

    setStatus((prev) => {
      if (prev === "error") return "idle";
      if (
        prev === "requesting_display" ||
        prev === "connecting" ||
        prev === "transcribing"
      ) {
        return "stopped";
      }
      return prev;
    });
  }, [releaseDisplayStream]);

  const handleCopy = useCallback(async () => {
    setNotice(null);
    const text = buildClipboardText(tentativeText, finalText);
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setNotice("コピーに失敗しました。ブラウザの権限を確認してください。");
    }
  }, [tentativeText, finalText]);

  const handleClear = useCallback(() => {
    userInitiatedStopRef.current = true;
    setNotice(null);
    setErrorDetail(null);
    releaseDisplayStream();
    setTentativeText("");
    setFinalText("");
    clearTranscriptCache();
    setStatus("idle");
  }, [releaseDisplayStream]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {TRANSCRIPTION_PAGE_TITLE}
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {TRANSCRIPTION_INSTRUCTION}
        </p>
      </header>

      <ActionButtons
        status={status}
        onStart={() => {
          void handleStart();
        }}
        onStop={handleStop}
        onCopy={handleCopy}
        onClear={handleClear}
        hasTranscript={hasTranscript}
        mediaCaptureActive={hasDisplayStream}
        startBusy={startBusy}
      />

      {notice ? (
        <p
          className="text-sm text-amber-800 dark:text-amber-200"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <StatusBadge status={status} errorDetail={errorDetail} />

      <TranscriptViewer tentativeText={tentativeText} finalText={finalText} />
    </div>
  );
}
