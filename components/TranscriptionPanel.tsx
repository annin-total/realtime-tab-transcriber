"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ERR_COPY_FAILED,
  ERR_DISPLAY_CANCELLED,
  NOTICE_MIC_DENIED_TAB_CONTINUES,
  NOTICE_SHARE_ENDED,
} from "@/constants/transcription-errors";
import {
  TRANSCRIPTION_INSTRUCTION,
  TRANSCRIPTION_PAGE_TITLE,
} from "@/constants/transcription-ui";
import {
  clearTranscriptCache,
  loadTranscriptLinesCache,
  saveTranscriptLinesCache,
} from "@/lib/cache";
import {
  requestTabAudioStream,
  stopMediaStream,
} from "@/lib/display-media";
import { requestMicStream, stopMicStream } from "@/lib/microphone";
import { connectRotatingRealtime } from "@/lib/realtime-rotating";
import type { RealtimeSession } from "@/lib/realtime-rotating";
import { mapTranscriptionFlowError } from "@/lib/map-transcription-error";
import { parseTranscriptEvent } from "@/lib/transcript-events";
import { buildClipboardText } from "@/lib/transcript-text";
import { useHistoryRecorder } from "@/lib/use-history-recorder";
import type { AppStatus, TranscriptLine, TranscriptSource } from "@/lib/types";
import { ActionButtons } from "./ActionButtons";
import { HistoryDrawer } from "./HistoryDrawer";
import { MicToggle } from "./MicToggle";
import { StatusBadge } from "./StatusBadge";
import { TranscriptTimeline } from "./TranscriptTimeline";

/** 文字起こし画面の状態と子コンポーネントを束ねる親 */
export function TranscriptionPanel() {
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const realtimeTabRef = useRef<RealtimeSession | null>(null);
  const realtimeMicRef = useRef<RealtimeSession | null>(null);
  /** 停止ボタン由来の解放か（トラック `ended` と二重通知を防ぐ） */
  const userInitiatedStopRef = useRef(false);

  const [status, setStatus] = useState<AppStatus>("idle");
  const [micEnabled, setMicEnabled] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [partialTab, setPartialTab] = useState("");
  const [partialMic, setPartialMic] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [hasDisplayStream, setHasDisplayStream] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const { beginSession, getSessionStartedAt } = useHistoryRecorder(
    lines,
    setNotice,
  );

  useEffect(() => {
    startTransition(() => {
      setLines(loadTranscriptLinesCache());
      setCacheHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!cacheHydrated) return;
    saveTranscriptLinesCache(lines);
  }, [lines, cacheHydrated]);

  /** マイク側の Realtime とストリームのみ解放する（タブは維持） */
  const releaseMicOnly = useCallback(() => {
    realtimeMicRef.current?.close();
    realtimeMicRef.current = null;
    stopMicStream(micStreamRef.current);
    micStreamRef.current = null;
  }, []);

  /** タブ・マイクの Realtime と MediaStream をまとめて解放する */
  const releaseAllCapture = useCallback(() => {
    realtimeMicRef.current?.close();
    realtimeMicRef.current = null;
    realtimeTabRef.current?.close();
    realtimeTabRef.current = null;
    stopMicStream(micStreamRef.current);
    micStreamRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setHasDisplayStream(false);
  }, []);

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
      releaseAllCapture();
      setStatus((prev) =>
        prev === "transcribing" || prev === "connecting"
          ? "stopped"
          : prev,
      );
      setNotice(NOTICE_SHARE_ENDED);
    };

    const tracks = stream.getTracks();
    tracks.forEach((t) => t.addEventListener("ended", onEnded));
    return () => {
      tracks.forEach((t) => t.removeEventListener("ended", onEnded));
    };
  }, [hasDisplayStream, releaseAllCapture]);

  const appendRealtimeEvent = useCallback(
    (source: TranscriptSource, raw: unknown) => {
      const event = parseTranscriptEvent(raw);
      if (!event) return;

      if (event.type === "delta") {
        if (source === "tab") {
          setPartialTab((prev) => prev + event.text);
        } else {
          setPartialMic((prev) => prev + event.text);
        }
        return;
      }

      /* 直前の確定行と同一ソースならラベル繰り返しを避け、本文を連続表示する。
         履歴を開始〜停止の 1 回分で区切るため、前回セッションの行には連結しない */
      setLines((prev) => {
        const last = prev[prev.length - 1];
        const sessionStartedAt = getSessionStartedAt();
        if (
          last?.source === source &&
          sessionStartedAt !== null &&
          last.createdAt >= sessionStartedAt
        ) {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              text: `${last.text}\n${event.text}`,
            },
          ];
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            source,
            text: event.text,
            createdAt: Date.now(),
          },
        ];
      });
      if (source === "tab") {
        setPartialTab("");
      } else {
        setPartialMic("");
      }
    },
    [getSessionStartedAt],
  );

  const hasTranscript = Boolean(
    partialTab.trim() || partialMic.trim() || lines.length > 0,
  );

  const micToggleDisabled =
    startBusy ||
    status === "requesting_display" ||
    status === "connecting" ||
    status === "transcribing";

  const handleStart = useCallback(async () => {
    if (status !== "idle" && status !== "stopped" && status !== "error") {
      return;
    }
    if (hasDisplayStream || startBusy) return;

    setNotice(null);
    setErrorDetail(null);
    setStartBusy(true);
    setStatus("requesting_display");
    beginSession();

    try {
      const stream = await requestTabAudioStream();
      streamRef.current = stream;
      setHasDisplayStream(true);
      setStatus("connecting");

      await connectRotatingRealtime(
        stream,
        {
          onEvent: (raw) => appendRealtimeEvent("tab", raw),
          onOpen: () => {
            setStatus("transcribing");
          },
          onError: (err) => {
            setErrorDetail(mapTranscriptionFlowError(err));
            setStatus("error");
            releaseAllCapture();
          },
        },
        realtimeTabRef,
      );

      if (micEnabled) {
        try {
          const micStream = await requestMicStream();
          micStreamRef.current = micStream;
          await connectRotatingRealtime(
            micStream,
            {
              onEvent: (raw) => appendRealtimeEvent("mic", raw),
              onError: (err) => {
                setNotice(mapTranscriptionFlowError(err));
                releaseMicOnly();
              },
            },
            realtimeMicRef,
          );
        } catch (micErr) {
          releaseMicOnly();
          const domName =
            micErr instanceof DOMException ? micErr.name : "";
          if (
            domName === "NotAllowedError" ||
            domName === "AbortError"
          ) {
            setNotice(NOTICE_MIC_DENIED_TAB_CONTINUES);
          } else {
            setNotice(mapTranscriptionFlowError(micErr));
          }
        }
      }
    } catch (e) {
      releaseAllCapture();
      const domName = e instanceof DOMException ? e.name : "";
      if (domName === "NotAllowedError" || domName === "AbortError") {
        setStatus("idle");
        setNotice(ERR_DISPLAY_CANCELLED);
        return;
      }
      setErrorDetail(mapTranscriptionFlowError(e));
      setStatus("error");
    } finally {
      setStartBusy(false);
    }
  }, [
    appendRealtimeEvent,
    beginSession,
    hasDisplayStream,
    micEnabled,
    releaseAllCapture,
    releaseMicOnly,
    startBusy,
    status,
  ]);

  const handleStop = useCallback(() => {
    userInitiatedStopRef.current = true;
    setNotice(null);
    setErrorDetail(null);
    setPartialTab("");
    setPartialMic("");
    releaseAllCapture();

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
  }, [releaseAllCapture]);

  const handleCopy = useCallback(async () => {
    setNotice(null);
    const text = buildClipboardText(lines, partialTab, partialMic);
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setNotice(ERR_COPY_FAILED);
    }
  }, [lines, partialTab, partialMic]);

  const handleClear = useCallback(() => {
    userInitiatedStopRef.current = true;
    setNotice(null);
    setErrorDetail(null);
    releaseAllCapture();
    setPartialTab("");
    setPartialMic("");
    setLines([]);
    clearTranscriptCache();
    setStatus("idle");
  }, [releaseAllCapture]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {TRANSCRIPTION_PAGE_TITLE}
          </h1>
          <HistoryDrawer />
        </div>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {TRANSCRIPTION_INSTRUCTION}
        </p>
      </header>

      <MicToggle
        checked={micEnabled}
        disabled={micToggleDisabled}
        onChange={setMicEnabled}
      />

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

      <TranscriptTimeline
        lines={lines}
        partialTab={partialTab}
        partialMic={partialMic}
      />
    </div>
  );
}
