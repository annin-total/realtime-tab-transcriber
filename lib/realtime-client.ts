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

/**
 * Step 1: 自サーバーから ephemeral token を取得する（gpt-realtime-whisper 用）
 * サーバーが `/v1/realtime/transcription_sessions` を呼び出し短命トークンを返す
 */
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
 * タブ共有で得た `MediaStream` の音声を OpenAI Realtime（WebRTC）へ送る接続を張る。
 *
 * フロー（公式 ephemeral token 方式 for gpt-realtime-whisper）:
 * 1. `/api/realtime/session` → サーバーが transcription_sessions を呼び出して短命トークンを返す
 * 2. ブラウザが SDP offer を直接 `https://api.openai.com/v1/realtime/calls` へ Bearer 認証で送る
 * 3. SDP answer を受け取り setRemoteDescription → WebRTC 接続完了
 *
 * @param assignTo 接続オブジェクトを同期的に格納する参照
 * @see https://developers.openai.com/api/docs/guides/realtime-webrtc
 * @see https://developers.openai.com/api/reference/resources/realtime/subresources/transcription_sessions
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
    throw new Error("音声トラックがありません");
  }

  peer.addTrack(audioTrack, stream);

  const dataChannel = peer.createDataChannel("oai-events");

  dataChannel.onopen = () => handlers.onOpen?.();
  dataChannel.onerror = () => {
    handlers.onError?.(new Error("DataChannel error"));
  };
  dataChannel.onmessage = (message) => {
    try {
      handlers.onEvent(JSON.parse(message.data as string));
    } catch {
      /* 解析不能メッセージは無視 */
    }
  };

  try {
    /* Step 1: 短命 ephemeral token を取得 */
    const ephemeralToken = await fetchEphemeralToken();

    /* Step 2: SDP offer を生成 */
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    /* Step 3: ブラウザから直接 OpenAI /v1/realtime/calls へ送る */
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

    /* Step 4: SDP answer を適用して接続確立 */
    const answer: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: await response.text(),
    };
    await peer.setRemoteDescription(answer);

    const connection: RealtimeConnection = {
      peer,
      dataChannel,
      close: () => {
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
