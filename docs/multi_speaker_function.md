はい、**実現可能です。最小構成なら「タブ音声用Realtimeセッション」と「マイク音声用Realtimeセッション」を2本立てる方式**が一番堅いです。

今回やりたいのは、厳密には「話者分離」ではなく、**入力ソース分離**です。

```txt
タブ音声 = 相手・動画・会議音声
マイク音声 = 自分の発話
```

なので、1本の音声に混ぜてからAIに「誰が話したか」を推定させるより、**最初からタブ音声とマイク音声を別々のRealtime接続に送る**方が確実です。

---

# 結論

## 推奨構成

```txt
Chromeタブ音声
  ↓ getDisplayMedia()
  ↓ Realtime Session A
  ↓ transcript event
  ↓ 「タブ側」欄に表示

自分のマイク音声
  ↓ getUserMedia()
  ↓ Realtime Session B
  ↓ transcript event
  ↓ 「自分」欄に表示
```

OpenAI Realtime APIは、ブラウザ/モバイルで音声を直接扱う場合はWebRTCが推奨されており、unified interfaceではブラウザのSDPを自前サーバーに送り、サーバーが `/v1/realtime/calls` へ中継する構成が公式に説明されています。既存MVPの構成をそのまま2本に増やせます。([OpenAI 開発者][1])

マイク音声はWeb標準の `getUserMedia()` で取得できます。ブラウザからマイクにアクセスすること自体は可能で、ユーザー許可が必要です。([OpenAI 開発者][1])

---

# なぜ「2セッション方式」がよいか

## 1. 分離が確実

タブ音声とマイク音声を1本にミックスすると、OpenAI側から見ると「混ざった1本の音声」になります。
その場合、「これはタブ側」「これは自分」と確実には判定できません。

一方、2セッション方式なら、

```ts
tabSession から来た transcript → source: "tab"
micSession から来た transcript → source: "mic"
```

とアプリ側で機械的にラベルを付けられます。推定ではなく、入力経路に基づく分類なので安定します。

---

## 2. Realtimeの話者分離モデルに依存しない

OpenAIには `gpt-4o-transcribe-diarize` という話者ラベル付き文字起こしモデルがありますが、これは `/v1/audio/transcriptions` 用で、Realtime APIではまだサポートされていません。公式ドキュメントにも、`gpt-4o-transcribe-diarize` は `/v1/audio/transcriptions` のみで利用可能で、Realtime APIでは未対応と明記されています。([OpenAI 開発者][2])

つまり、**リアルタイムに「タブ側/自分」を分けたいなら、現時点ではAIの話者分離より、入力ソースを分ける設計が正攻法**です。

---

## 3. 既存MVPを大きく壊さない

既存の処理がすでに、

```txt
MediaStream
↓
connectRealtime()
↓
transcript event
↓
UI表示
```

になっているなら、これを2系統にするだけです。

---

# 最小変更の全体設計

## 追加する状態

```ts
type TranscriptSource = "tab" | "mic";

type TranscriptLine = {
  id: string;
  source: TranscriptSource;
  text: string;
  createdAt: number;
};
```

表示はまずシンプルにこれで十分です。

```txt
[ ] 自分のマイク音声も含める

タブ側:
...

自分:
...

時系列:
[タブ] こんにちは
[自分] はい、聞こえています
```

MVPでは、**2カラム表示 + 時系列表示**のどちらか片方でもよいです。
最小なら時系列表示だけでも成立します。

---

# 実装方針

## 変更前

```txt
tabStream
↓
connectRealtime(tabStream)
↓
finalText に追記
```

## 変更後

```txt
tabStream
↓
connectRealtime(tabStream, { source: "tab" })
↓
tab transcript として追記

micEnabled === true の場合:

micStream
↓
connectRealtime(micStream, { source: "mic" })
↓
mic transcript として追記
```

---

# 追加・変更するファイル

```txt
lib/microphone.ts
lib/realtime-client.ts
lib/transcript-events.ts
components/MicToggle.tsx
components/TranscriptTimeline.tsx
components/TranscriptionPanel.tsx
```

既存の `/api/realtime/sdp/route.ts` は基本的に使い回せます。
セッションを2本作る場合も、同じAPIを2回呼ぶだけでよいです。

---

# 1. マイク取得処理を追加

```ts
// lib/microphone.ts
export async function requestMicStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("このブラウザではマイクを利用できません");
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

export function stopMicStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
```

`getUserMedia()` は音声・映像の制約を指定してメディアストリームを取得でき、`echoCancellation` などの制約も指定できます。([MDN Web Docs][3])

---

# 2. Realtime接続に `source` を渡せるようにする

既存の `connectRealtime()` を少しだけ拡張します。

```ts
// lib/types.ts
export type TranscriptSource = "tab" | "mic";

export type SourceTranscriptEvent = {
  source: TranscriptSource;
  type: "delta" | "completed";
  text: string;
};
```

```ts
// lib/realtime-client.ts
import type { TranscriptSource } from "./types";

type RealtimeHandlers = {
  source: TranscriptSource;
  onEvent: (source: TranscriptSource, event: unknown) => void;
  onOpen?: (source: TranscriptSource) => void;
  onError?: (source: TranscriptSource, error: Error) => void;
};

export type RealtimeConnection = {
  peer: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  close: () => void;
};

export async function connectRealtime(
  stream: MediaStream,
  handlers: RealtimeHandlers
): Promise<RealtimeConnection> {
  const peer = new RTCPeerConnection();
  const audioTrack = stream.getAudioTracks()[0];

  if (!audioTrack) {
    throw new Error("音声トラックがありません");
  }

  peer.addTrack(audioTrack, stream);

  const dataChannel = peer.createDataChannel(`oai-events-${handlers.source}`);

  dataChannel.onopen = () => handlers.onOpen?.(handlers.source);
  dataChannel.onerror = () => {
    handlers.onError?.(handlers.source, new Error("DataChannel error"));
  };

  dataChannel.onmessage = (message) => {
    try {
      handlers.onEvent(handlers.source, JSON.parse(message.data));
    } catch {
      handlers.onError?.(
        handlers.source,
        new Error("Realtimeイベントの解析に失敗しました")
      );
    }
  };

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  const response = await fetch("/api/realtime/sdp", {
    method: "POST",
    body: offer.sdp,
    headers: { "Content-Type": "application/sdp" },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  await peer.setRemoteDescription({
    type: "answer",
    sdp: await response.text(),
  });

  return {
    peer,
    dataChannel,
    close: () => {
      dataChannel.close();
      peer.close();
    },
  };
}
```

OpenAIのWebRTC公式例でも、ブラウザ側では `RTCPeerConnection` を作成し、ローカル音声トラックを `addTrack()` し、DataChannelでイベントを送受信し、SDP offer/answerで接続を確立する流れになっています。([OpenAI 開発者][1])

---

# 3. transcriptイベントに source を付与する

既存の `parseTranscriptEvent()` はそのままでよいです。
`source` はパース時ではなく、呼び出し元で付けます。

```ts
// lib/transcript-events.ts
import type { TranscriptEvent } from "./types";

type RealtimeEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
};

export function parseTranscriptEvent(event: unknown): TranscriptEvent | null {
  const e = event as RealtimeEvent;

  if (e.type === "conversation.item.input_audio_transcription.delta" && e.delta) {
    return { type: "delta", text: e.delta };
  }

  if (
    e.type === "conversation.item.input_audio_transcription.completed" &&
    e.transcript
  ) {
    return { type: "completed", text: e.transcript };
  }

  return null;
}
```

Realtime transcriptionでは、ストリーミング中の差分と、発話単位の確定テキストイベントを受け取れます。公式ドキュメントでも、リアルタイム文字起こしは音声到着に応じて transcript delta をストリームし、完全な発話前にテキストを表示できると説明されています。([OpenAI 開発者][4])

---

# 4. 状態管理を2系統にする

最小なら、状態はこれで十分です。

```ts
type PartialBySource = {
  tab: string;
  mic: string;
};

type TranscriptLine = {
  id: string;
  source: "tab" | "mic";
  text: string;
  createdAt: number;
};
```

```ts
const [micEnabled, setMicEnabled] = useState(false);

const [partialBySource, setPartialBySource] = useState<PartialBySource>({
  tab: "",
  mic: "",
});

const [lines, setLines] = useState<TranscriptLine[]>([]);
```

イベント処理はこうします。

```ts
function handleRealtimeEvent(source: TranscriptSource, raw: unknown) {
  const event = parseTranscriptEvent(raw);
  if (!event) return;

  if (event.type === "delta") {
    setPartialBySource((prev) => ({
      ...prev,
      [source]: prev[source] + event.text,
    }));
    return;
  }

  const line: TranscriptLine = {
    id: crypto.randomUUID(),
    source,
    text: event.text,
    createdAt: Date.now(),
  };

  setLines((prev) => {
    const next = [...prev, line];
    saveTranscriptLinesCache(next);
    return next;
  });

  setPartialBySource((prev) => ({
    ...prev,
    [source]: "",
  }));
}
```

---

# 5. 開始処理を分岐する

ポイントは、**タブ音声は常に開始、マイク音声はONの場合だけ開始**です。

```ts
const tabStreamRef = useRef<MediaStream | null>(null);
const micStreamRef = useRef<MediaStream | null>(null);

const tabConnectionRef = useRef<RealtimeConnection | null>(null);
const micConnectionRef = useRef<RealtimeConnection | null>(null);

async function startTranscription() {
  setStatus("requesting_display");

  const tabStream = await requestTabAudioStream();
  tabStreamRef.current = tabStream;

  setStatus("connecting");

  tabConnectionRef.current = await connectRealtime(tabStream, {
    source: "tab",
    onEvent: handleRealtimeEvent,
    onError: handleRealtimeError,
  });

  if (micEnabled) {
    const micStream = await requestMicStream();
    micStreamRef.current = micStream;

    micConnectionRef.current = await connectRealtime(micStream, {
      source: "mic",
      onEvent: handleRealtimeEvent,
      onError: handleRealtimeError,
    });
  }

  setStatus("transcribing");
}
```

この構成では、マイクOFFなら既存MVPとほぼ同じ挙動です。
マイクONのときだけ、追加でマイク許可と2本目のRealtime接続が発生します。

---

# 6. 停止処理を2本分にする

```ts
function stopTranscription() {
  tabConnectionRef.current?.close();
  tabConnectionRef.current = null;

  micConnectionRef.current?.close();
  micConnectionRef.current = null;

  stopMediaStream(tabStreamRef.current);
  tabStreamRef.current = null;

  stopMicStream(micStreamRef.current);
  micStreamRef.current = null;

  setPartialBySource({ tab: "", mic: "" });
  setStatus("stopped");
}
```

---

# 7. UIを最小追加する

## マイクON/OFF

```tsx
// components/MicToggle.tsx
type Props = {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

export function MicToggle({ checked, disabled, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      自分のマイク音声も含める
    </label>
  );
}
```

開始後にON/OFFを変えると接続管理が複雑になるため、MVPでは **開始前のみ変更可能** にするのがおすすめです。

```tsx
<MicToggle
  checked={micEnabled}
  disabled={status === "connecting" || status === "transcribing"}
  onChange={setMicEnabled}
/>
```

---

## 時系列表示

```tsx
// components/TranscriptTimeline.tsx
import type { TranscriptLine } from "@/lib/types";

type Props = {
  lines: TranscriptLine[];
  partialBySource: {
    tab: string;
    mic: string;
  };
};

export function TranscriptTimeline({ lines, partialBySource }: Props) {
  return (
    <div className="space-y-3">
      {lines.map((line) => (
        <div key={line.id} className="rounded border p-3">
          <div className="mb-1 text-xs text-gray-500">
            {line.source === "tab" ? "タブ側" : "自分"}
          </div>
          <div className="whitespace-pre-wrap">{line.text}</div>
        </div>
      ))}

      {partialBySource.tab && (
        <div className="rounded border border-dashed p-3 opacity-70">
          <div className="mb-1 text-xs text-gray-500">タブ側 / 暫定</div>
          <div>{partialBySource.tab}</div>
        </div>
      )}

      {partialBySource.mic && (
        <div className="rounded border border-dashed p-3 opacity-70">
          <div className="mb-1 text-xs text-gray-500">自分 / 暫定</div>
          <div>{partialBySource.mic}</div>
        </div>
      )}
    </div>
  );
}
```

---

# 8. localStorageキャッシュも配列形式に変える

既存が単一文字列なら、次のように移行するとよいです。

```ts
type TranscriptLinesCache = {
  lines: TranscriptLine[];
  savedAt: number;
};
```

```ts
export function saveTranscriptLinesCache(lines: TranscriptLine[]): void {
  const cache = {
    lines,
    savedAt: Date.now(),
  };

  window.localStorage.setItem(
    "transcript-lines-cache-v1",
    JSON.stringify(cache)
  );
}
```

既存の `transcript-cache-v1` は残してもよいですが、MVPでは新キーにして移行処理は省略でよいです。

```txt
旧: transcript-cache-v1
新: transcript-lines-cache-v1
```

YAGNI的には、既存キャッシュ移行は後回しで問題ありません。

---

# 9. `/api/realtime/sdp` はほぼそのままでよい

既存のAPIを2回呼ぶだけで済みます。

セッション設定は、現在動いている `gpt-4o-transcribe` のままでよいです。

```ts
const sessionConfig = {
  type: "transcription",
  audio: {
    input: {
      transcription: {
        model: "gpt-4o-transcribe",
        language: "ja",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
    },
  },
};
```

ただし公式のRealtime transcriptionガイドでは、**低遅延でストリーミングdeltaを重視するなら `gpt-realtime-whisper`、ファイルやリクエスト/レスポンス型で高精度を重視するなら `gpt-4o-transcribe`** という整理がされています。今の実装で `gpt-4o-transcribe` が期待通り動いているなら維持でよいですが、リアルタイム性を最優先する場合は比較検証の余地があります。([OpenAI 開発者][4])

---

# 10. 追加PRの最小分割

既存MVPが完成済みなら、変更は以下の3PRに分けるとレビューしやすいです。

## PR-01：データ構造と表示の変更

目的：文字起こし結果を「単一テキスト」から「source付き行配列」に変える。

変更：

```txt
lib/types.ts
lib/cache.ts
components/TranscriptTimeline.tsx
TranscriptionPanel.tsx
```

受け入れ条件：

```txt
タブ側だけでも既存通り文字起こしできる
各行に「タブ側」ラベルが付く
リロード後にsource付き履歴が復元される
```

---

## PR-02：マイク取得とON/OFF UI

目的：開始前に「自分のマイク音声も含める」を選べるようにする。

変更：

```txt
lib/microphone.ts
components/MicToggle.tsx
TranscriptionPanel.tsx
```

受け入れ条件：

```txt
チェックON時のみマイク許可ダイアログが出る
チェックOFF時はマイク許可が出ない
開始中はチェックボックスを変更できない
停止時にマイク利用も止まる
```

---

## PR-03：2本目のRealtime接続

目的：マイク音声を別Realtimeセッションに送信し、「自分」として表示する。

変更：

```txt
lib/realtime-client.ts
TranscriptionPanel.tsx
```

受け入れ条件：

```txt
タブ音声は「タブ側」として表示される
マイク音声は「自分」として表示される
タブのみ利用もできる
マイクON時に2本のRealtime接続が張られる
停止時に2本とも閉じる
```

---

# 注意点

## 1. APIコストは増えます

マイクON時はRealtime接続が2本になるため、概ね **タブのみの約2倍の音声入力コスト** を見込んだ方がよいです。

---

## 2. ヘッドホン推奨です

スピーカーから出たタブ音声をマイクが物理的に拾うと、同じ発話が、

```txt
タブ側: こんにちは
自分: こんにちは
```

のように二重表示される可能性があります。

対策は、

```txt
ヘッドホン/イヤホンを使う
マイク側に echoCancellation を入れる
noiseSuppression を入れる
```

です。

---

## 3. 「開始後にマイクON/OFF」は後回しでよい

開始後にマイクON/OFFを切り替えるには、2本目のRealtime接続を途中作成/破棄する必要があります。
実装自体は可能ですが、MVPでは複雑です。

最小構成では、

```txt
開始前にマイクON/OFFを選ぶ
開始中は変更不可
変更したい場合は一度停止して再開始
```

がよいです。

---

# 最終推奨

今回の要件なら、**話者分離モデルではなく、入力ソース分離で実装**してください。

```txt
タブ音声 → Realtime Session A → タブ側として表示
マイク音声 → Realtime Session B → 自分として表示
```

これが、最小構成で、実装も安定し、レビューもしやすいです。
既存MVPからの変更も小さく済みます。

[1]: https://developers.openai.com/api/docs/guides/realtime-webrtc "Realtime API with WebRTC | OpenAI API"
[2]: https://developers.openai.com/api/docs/guides/speech-to-text "Speech to text | OpenAI API"
[3]: https://developer.mozilla.org/ja/docs/Web/API/Media_Capture_and_Streams_API/Constraints?utm_source=chatgpt.com "能力と制約と設定 - Web API - MDN Web Docs"
[4]: https://developers.openai.com/api/docs/guides/realtime-transcription "Realtime transcription | OpenAI API"
