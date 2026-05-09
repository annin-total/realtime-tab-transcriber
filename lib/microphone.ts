import { ERR_MIC_UNSUPPORTED } from "@/constants/transcription-errors";

/**
 * マイクのみの `MediaStream` を取得する（映像なし）
 * @throws 非対応ブラウザ
 */
export async function requestMicStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(ERR_MIC_UNSUPPORTED);
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

/** マイクストリームの全トラックを停止する */
export function stopMicStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
