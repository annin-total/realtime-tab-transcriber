import { ERR_OPENAI_CONNECTION } from "@/constants/transcription-errors";
import {
  REALTIME_OPEN_TIMEOUT_MS,
  REALTIME_ROTATE_RETRY_MS,
  REALTIME_SESSION_ROTATE_MS,
} from "./constants";
import { connectRealtime } from "./realtime-client";
import type { RealtimeConnection, RealtimeHandlers } from "./realtime-client";

/** 張り替えを内包した Realtime 接続のハンドル */
export type RealtimeSession = {
  close: () => void;
};

function waitForOpen(channel: RTCDataChannel): Promise<void> {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(ERR_OPENAI_CONNECTION)),
      REALTIME_OPEN_TIMEOUT_MS,
    );
    channel.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Realtime セッションは OpenAI 側で最大60分に制限されるため、期限前に同じ `MediaStream` で
 * 新しい接続を張り、開通後に旧接続を閉じることで文字起こしを継続する。
 *
 * @param assignTo 初回接続確立後に同期的に代入する ref（省略可）
 */
export async function connectRotatingRealtime(
  stream: MediaStream,
  handlers: RealtimeHandlers,
  assignTo?: { current: RealtimeSession | null } | null,
): Promise<RealtimeSession> {
  let current: RealtimeConnection | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  /* エラーは現役の接続のものだけ通知する（張り替え中の新旧接続のエラーで全体を止めない） */
  const connect = async (onOpen?: () => void) => {
    let self: RealtimeConnection | null = null;
    self = await connectRealtime(stream, {
      onEvent: handlers.onEvent,
      onOpen,
      onError: (err) => {
        if (!closed && self === current) handlers.onError?.(err);
      },
    });
    return self;
  };

  const scheduleRotation = (delayMs: number) => {
    timer = setTimeout(() => void rotate(), delayMs);
  };

  const rotate = async () => {
    let next: RealtimeConnection | null = null;
    try {
      next = await connect();
      await waitForOpen(next.dataChannel);
    } catch {
      next?.close();
      /* 旧接続は期限まで生きているため再試行する。期限切れ時は旧接続の onError で通知される */
      if (!closed) scheduleRotation(REALTIME_ROTATE_RETRY_MS);
      return;
    }
    if (closed) {
      next.close();
      return;
    }
    const previous = current;
    current = next;
    previous?.close();
    scheduleRotation(REALTIME_SESSION_ROTATE_MS);
  };

  current = await connect(handlers.onOpen);
  scheduleRotation(REALTIME_SESSION_ROTATE_MS);

  const session: RealtimeSession = {
    close: () => {
      closed = true;
      clearTimeout(timer);
      current?.close();
      current = null;
    },
  };

  if (assignTo) {
    assignTo.current = session;
  }

  return session;
}
