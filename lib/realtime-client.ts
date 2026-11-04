import {
  ERR_AUDIO_SHARE_OFF,
  ERR_OPENAI_CONNECTION,
} from "@/constants/transcription-errors";
import {
  API_PATH_REALTIME_SESSION,
  OPENAI_REALTIME_CALLS_URL,
} from "./constants";

/** DataChannel で受け取る生 JSON イベントを渡す */
export type RealtimeHandlers = {
  onEvent: (event: unknown) => void;
  onOpen?: () => void;
  onError?: (error: Error) => void;
};

export type RealtimeConnection = {
  peer: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  close: () => void;
};

type SessionResponse = {
  client_secret?: string;
  error?: string;
};

/** 認証付き `/api/realtime/session` から短命トークンを取得する */
async function fetchEphemeralToken(): Promise<string> {
  const res = await fetch(API_PATH_REALTIME_SESSION, {
    method: "POST",
    credentials: "same-origin",
  });

  const data = (await res.json()) as SessionResponse;

  if (!res.ok || !data.client_secret) {
    throw new Error(
      data.error ??
        `セッション取得に失敗しました（HTTP ${res.status}）`,
    );
  }

  return data.client_secret;
}

/**
 * タブ共有の `MediaStream` 音声を OpenAI Realtime（WebRTC）へ送る。
 * サーバー発行の短命トークンで `calls` に SDP を POST し、DataChannel でイベントを受け取る。
 *
 * @param assignTo 接続確立後に同期的に代入する ref（省略可）
 * @see https://developers.openai.com/api/docs/guides/realtime-webrtc
 */
export async function connectRealtime(
  stream: MediaStream,
  handlers: RealtimeHandlers,
  assignTo?: { current: RealtimeConnection | null } | null,
): Promise<RealtimeConnection> {
  const peer = new RTCPeerConnection();

  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) {
    peer.close();
    throw new Error(ERR_AUDIO_SHARE_OFF);
  }

  peer.addTrack(audioTrack, stream);

  const dataChannel = peer.createDataChannel("oai-events");

  dataChannel.onopen = () => handlers.onOpen?.();
  dataChannel.onerror = () => {
    handlers.onError?.(new Error(ERR_OPENAI_CONNECTION));
  };
  dataChannel.onmessage = (message) => {
    try {
      handlers.onEvent(JSON.parse(message.data as string));
    } catch {
      /* 解析不能メッセージは無視 */
    }
  };

  try {
    const ephemeralToken = await fetchEphemeralToken();

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const response = await fetch(OPENAI_REALTIME_CALLS_URL, {
      method: "POST",
      body: offer.sdp ?? "",
      headers: {
        "Content-Type": "application/sdp",
        Authorization: `Bearer ${ephemeralToken}`,
      },
    });

    if (!response.ok) {
      const raw = await response.text();
      let message: string;
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        message =
          parsed.error?.message ??
          `WebRTC 接続に失敗しました（HTTP ${response.status}）`;
      } catch {
        message = `WebRTC 接続に失敗しました（HTTP ${response.status}）`;
      }
      throw new Error(message);
    }

    const answer: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: await response.text(),
    };
    await peer.setRemoteDescription(answer);

    const connection: RealtimeConnection = {
      peer,
      dataChannel,
      close: () => {
        /* 意図した切断で onError が発火し、張り替え後の利用側を止めないようにする */
        dataChannel.onerror = null;
        dataChannel.onmessage = null;
        try {
          dataChannel.close();
        } catch {
          /* 既に閉じている場合 */
        }
        peer.close();
      },
    };

    if (assignTo) {
      assignTo.current = connection;
    }

    return connection;
  } catch (err) {
    try {
      dataChannel.close();
    } catch {
      /* noop */
    }
    peer.close();
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(String(err));
  }
}
