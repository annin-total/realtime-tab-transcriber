"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import {
  TRANSCRIPTION_INSTRUCTION,
  TRANSCRIPTION_PAGE_TITLE,
} from "@/constants/transcription-ui";
import {
  clearTranscriptCache,
  loadTranscriptCache,
  saveTranscriptCache,
} from "@/lib/cache";
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

/**
 * 文字起こし画面の状態と子コンポーネントを束ねる親（PR-06 では音声・接続は未実装）
 */
export function TranscriptionPanel() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [tentativeText, setTentativeText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [cacheHydrated, setCacheHydrated] = useState(false);

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

  const hasTranscript = Boolean(tentativeText.trim() || finalText.trim());

  const handleStart = useCallback(() => {
    setNotice(null);
    if (status !== "idle" && status !== "stopped") return;
    setStatus("requesting_display");
  }, [status]);

  const handleStop = useCallback(() => {
    setNotice(null);
    if (
      status !== "requesting_display" &&
      status !== "connecting" &&
      status !== "transcribing"
    ) {
      return;
    }
    setStatus("stopped");
  }, [status]);

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
    setNotice(null);
    setTentativeText("");
    setFinalText("");
    clearTranscriptCache();
    setStatus("idle");
  }, []);

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
        onStart={handleStart}
        onStop={handleStop}
        onCopy={handleCopy}
        onClear={handleClear}
        hasTranscript={hasTranscript}
      />

      {notice ? (
        <p
          className="text-sm text-amber-800 dark:text-amber-200"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <StatusBadge status={status} />

      <TranscriptViewer tentativeText={tentativeText} finalText={finalText} />
    </div>
  );
}
