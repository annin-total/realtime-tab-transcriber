import { API_PATH_REALTIME_SDP } from "./constants";

/** DataChannel で受け取る生 JSON イベントを渡す */
type RealtimeHandlers = {
  onEvent: (event: unknown) => void;
  onOpen?: () => void;
  onError?: (error: Error) => void;
};

export type RealtimeConnection = {
  peer: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  close: () => void;
};

export type { RealtimeHandlers };

/**
 * タブ共有で得た `MediaStream` の音声を OpenAI Realtime（WebRTC）へ送る接続を張る。
 * SDP は同一オリジンの `/api/realtime/sdp` 経由で中継し、Cookie 認証が付く。
 */
export async function connectRealtime(
  stream: MediaStream,
  handlers: RealtimeHandlers,
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
      /* 解析不能メッセージは無視（PR-10 で型付き処理） */
    }
  };

  try {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const response = await fetch(API_PATH_REALTIME_SDP, {
      method: "POST",
      body: offer.sdp ?? "",
      headers: { "Content-Type": "application/sdp" },
      credentials: "same-origin",
    });

    if (!response.ok) {
      const raw = await response.text();
      let message = raw;
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        if (typeof parsed.error === "string") {
          message = parsed.error;
        }
      } catch {
        /* プレーンテキストのエラー本文 */
      }
      throw new Error(message);
    }

    const answerSdp = await response.text();
    const answer: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: answerSdp,
    };

    await peer.setRemoteDescription(answer);

    return {
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
