/**
 * `getDisplayMedia` の音声制約に、Chromium の `suppressLocalAudioPlayback` を含める
 */
type ChromiumDisplayAudioConstraints = MediaTrackConstraints & {
  suppressLocalAudioPlayback?: boolean;
};

/**
 * Chrome のタブ共有から映像・音声トラックを取得するためのオプション。
 * 標準の `DisplayMediaStreamOptions` に加え、Chromium 系で解釈される拡張キーを許容する。
 */
type ExtendedDisplayMediaOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  monitorTypeSurfaces?: "include" | "exclude";
};

/**
 * ブラウザタブを共有し、少なくとも 1 本の音声トラックを含む `MediaStream` を返す。
 * 映像トラックは API 要件のため付くが、停止時は `stopMediaStream` で映像・音声とも止める。
 * @throws 共有 API 非対応・ユーザーキャンセル・音声トラックなしなど
 */
export async function requestTabAudioStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("このブラウザでは画面共有APIを利用できません");
  }

  const audio: ChromiumDisplayAudioConstraints = {
    suppressLocalAudioPlayback: false,
  };

  const options: ExtendedDisplayMediaOptions = {
    video: { displaySurface: "browser" },
    audio,
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    systemAudio: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  };

  const stream = await navigator.mediaDevices.getDisplayMedia(
    options as DisplayMediaStreamOptions,
  );

  if (stream.getAudioTracks().length === 0) {
    stopMediaStream(stream);
    throw new Error(
      "音声を取得できませんでした。タブ共有時に音声共有をONにしてください。",
    );
  }

  return stream;
}

/**
 * 取得済みストリームの全トラックを停止する（共有インジケータを消す）
 */
export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
