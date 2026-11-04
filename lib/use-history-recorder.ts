import { useCallback, useEffect, useRef } from "react";
import { ERR_HISTORY_SAVE } from "@/constants/transcription-errors";
import { saveHistoryEntry } from "./history-db";
import type { TranscriptLine } from "./types";

type RecordingSession = { id: string; startedAt: number };

/**
 * 開始〜停止の 1 回分を 1 件として、確定行が増えるたびに履歴へ上書き保存する。
 * 停止後もセッションを保持するのは、停止直前に確定した行の保存を取りこぼさないため。
 */
export function useHistoryRecorder(
  lines: TranscriptLine[],
  onError: (message: string) => void,
) {
  const sessionRef = useRef<RecordingSession | null>(null);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    const sessionLines = lines.filter(
      (line) => line.createdAt >= session.startedAt,
    );
    if (sessionLines.length === 0) return;
    saveHistoryEntry({
      id: session.id,
      startedAt: session.startedAt,
      updatedAt: Date.now(),
      lines: sessionLines,
    }).catch(() => onError(ERR_HISTORY_SAVE));
  }, [lines, onError]);

  const beginSession = useCallback(() => {
    sessionRef.current = { id: crypto.randomUUID(), startedAt: Date.now() };
  }, []);

  /** 現在の記録セッション開始時刻（未開始なら null） */
  const getSessionStartedAt = useCallback(
    () => sessionRef.current?.startedAt ?? null,
    [],
  );

  return { beginSession, getSessionStartedAt };
}
