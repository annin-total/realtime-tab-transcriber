"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ERR_COPY_FAILED,
  ERR_HISTORY_DELETE,
  ERR_HISTORY_LOAD,
} from "@/constants/transcription-errors";
import {
  BTN_HISTORY,
  BTN_HISTORY_CLOSE,
  CONFIRM_HISTORY_DELETE,
  LABEL_HISTORY_EMPTY,
  LABEL_HISTORY_HEADING,
  LABEL_HISTORY_LOADING,
  NOTICE_HISTORY_COPIED,
} from "@/constants/transcription-ui";
import { deleteHistoryEntry, listHistoryEntries } from "@/lib/history-db";
import {
  buildHistoryPreview,
  formatHistoryDate,
  formatHistoryDuration,
} from "@/lib/history-format";
import { buildClipboardText } from "@/lib/transcript-text";
import type { HistoryEntry } from "@/lib/types";
import { HistoryDetail } from "./HistoryDetail";

/** 履歴ボタンと、左から開く履歴一覧・詳細のサイドメニュー */
export function HistoryDrawer() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = entries?.find((entry) => entry.id === selectedId) ?? null;

  const reload = useCallback(async () => {
    try {
      setEntries(await listHistoryEntries());
    } catch {
      setEntries([]);
      setMessage(ERR_HISTORY_LOAD);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setEntries(null);
    setSelectedId(null);
    setMessage(null);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleCopy = useCallback(async (entry: HistoryEntry) => {
    try {
      await navigator.clipboard.writeText(
        buildClipboardText(entry.lines, "", ""),
      );
      setMessage(NOTICE_HISTORY_COPIED);
    } catch {
      setMessage(ERR_COPY_FAILED);
    }
  }, []);

  const handleDelete = useCallback(
    async (entry: HistoryEntry) => {
      if (!window.confirm(CONFIRM_HISTORY_DELETE)) return;
      try {
        await deleteHistoryEntry(entry.id);
        setSelectedId(null);
        setMessage(null);
        await reload();
      } catch {
        setMessage(ERR_HISTORY_DELETE);
      }
    },
    [reload],
  );

  return (
    <>
      <button
        type="button"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        onClick={handleOpen}
      >
        {BTN_HISTORY}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex">
          <aside
            className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-4 shadow-xl dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-label={LABEL_HISTORY_HEADING}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {LABEL_HISTORY_HEADING}
              </h2>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => setOpen(false)}
              >
                {BTN_HISTORY_CLOSE}
              </button>
            </div>

            {message ? (
              <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
                {message}
              </p>
            ) : null}

            {selected ? (
              <HistoryDetail
                entry={selected}
                onBack={() => {
                  setSelectedId(null);
                  setMessage(null);
                }}
                onCopy={() => void handleCopy(selected)}
                onDelete={() => void handleDelete(selected)}
              />
            ) : entries === null ? (
              <p className="text-sm text-zinc-500">{LABEL_HISTORY_LOADING}</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-zinc-500">{LABEL_HISTORY_EMPTY}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setSelectedId(entry.id);
                        setMessage(null);
                      }}
                    >
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatHistoryDate(entry.startedAt)}・
                        {formatHistoryDuration(entry.updatedAt - entry.startedAt)}
                      </div>
                      <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                        {buildHistoryPreview(entry.lines[0]?.text ?? "")}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          <button
            type="button"
            className="flex-1 cursor-default bg-black/40"
            aria-label={BTN_HISTORY_CLOSE}
            onClick={() => setOpen(false)}
          />
        </div>
      ) : null}
    </>
  );
}
