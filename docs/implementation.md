以下の方針で実装手順書を作成します。

重要な更新点として、OpenAI Realtimeの接続は、MVPでは **一時トークン発行方式ではなく、WebRTC unified interface方式** を推奨します。ブラウザが作成したSDP offerをNext.js APIへ送り、Next.js側がOpenAIの `/v1/realtime/calls` に標準APIキーで中継し、SDP answerだけをブラウザへ返す構成です。OpenAI公式では、ブラウザ/モバイルで音声を直接扱う場合はWebRTCが推奨され、unified interfaceではブラウザのSDPを開発者サーバーがOpenAIへ中継する流れが説明されています。([OpenAI Developers][1])

---

# 実装手順書：Chromeタブ音声リアルタイム文字起こしMVP

## 0. MVPの最終構成

```txt
Next.js App Router
TypeScript
Tailwind CSS
Vercel
簡易パスコード認証
HttpOnly Cookie
getDisplayMedia()
WebRTC unified interface
OpenAI Realtime transcription
gpt-realtime-whisper
localStorage 24時間キャッシュ
DBなし
音声保存なし
```

Realtime transcriptionは「音声からテキストだけを得る」用途向けで、`gpt-realtime-whisper` はライブ音声・transcript delta・低遅延用途に設計されています。OpenAI公式でも、リアルタイム文字起こしでは `type: "transcription"` のセッションを使い、ブラウザ音声ではWebRTC接続できると説明されています。([OpenAI Developers][2])

---

# 1. 公式仕様に基づく実装前提

## 1.1 Chromeタブ音声取得

`getDisplayMedia()` はHTTPSなどのsecure contextで動作し、ユーザーが選択した画面・ウィンドウ・タブを `MediaStream` として返します。返されたストリームはWebRTC送信に使えます。`audio: true` を指定すると、選択された共有対象で音声が利用可能な場合に音声トラックが含まれます。([MDNウェブドキュメント][3])

ただし、`getDisplayMedia()` は映像トラックが必須なので、音声だけを取りたい場合でも `video: true` または `video: { displaySurface: "browser" }` を指定します。`video: false` は `TypeError` になります。([MDNウェブドキュメント][3])

また、共有許可は永続化できず、ユーザー操作が毎回必要です。これは仕様上の制約です。([MDNウェブドキュメント][3])

## 1.2 OpenAI Realtime接続

MVPでは以下の流れにします。

```txt
ブラウザ
  ↓ createOffer()
Next.js API /api/realtime/sdp
  ↓ FormData(sdp, session)
OpenAI /v1/realtime/calls
  ↓ SDP answer
ブラウザ
  ↓ setRemoteDescription()
WebRTC接続開始
```

OpenAI公式のWebRTC unified interfaceでは、ブラウザがSDPを開発者サーバーへ送り、サーバーが標準APIキーでOpenAIへ送信し、返ってきたSDP answerをブラウザへ返す形が説明されています。([OpenAI Developers][1])

## 1.3 transcriptイベント

Realtime transcriptionでは、差分イベントと確定イベントを受け取ります。

```txt
conversation.item.input_audio_transcription.delta
conversation.item.input_audio_transcription.completed
```

OpenAI公式でも、deltaイベントには逐次テキスト、completedイベントには確定テキストが含まれると説明されています。([OpenAI Developers][2])

## 1.4 Vercel環境変数

`OPENAI_API_KEY`、`APP_PASSCODE`、`AUTH_SECRET` はVercel環境変数に置きます。Vercel環境変数はプロジェクト外で管理され、Function実行時に参照できます。また、APIキーのような機密値はSensitive Environment Variablesとして非表示化できます。([Vercel][4])

---

# 2. PR分割方針

1PRの変更量を小さくし、レビュー観点が混ざらないようにします。

```txt
PR-01: プロジェクト初期化
PR-02: 型・定数・エラー方針
PR-03: 簡易パスコード認証API
PR-04: 認証ゲートUI
PR-05: localStorage 24時間キャッシュ
PR-06: 基本UIコンポーネント
PR-07: Chromeタブ音声取得
PR-08: OpenAI Realtime SDP API
PR-09: WebRTC接続クライアント
PR-10: transcriptイベント反映
PR-11: 停止・コピー・クリア・エラー整理
PR-12: Vercelデプロイ・動作確認
```

---

# 3. 推奨ディレクトリ構成

```txt
app/
  api/
    auth/
      route.ts
    auth/
      me/
        route.ts
    logout/
      route.ts
    realtime/
      sdp/
        route.ts
  globals.css
  layout.tsx
  page.tsx

components/
  ActionButtons.tsx
  PasscodeGate.tsx
  StatusBadge.tsx
  TranscriptViewer.tsx
  TranscriptionPanel.tsx

lib/
  auth.ts
  cache.ts
  constants.ts
  display-media.ts
  errors.ts
  realtime-client.ts
  transcript-events.ts
  types.ts

.env.example
```

1ファイルは原則100行程度に抑えます。
肥大化しやすい `TranscriptionPanel.tsx` は、状態管理が増えたら `useTranscriptionSession.ts` に切り出します。

---

# 4. PR-01：プロジェクト初期化

## 目的

Next.js App Router + TypeScript + Tailwind の最小土台を作る。

## 作業

```bash
npx create-next-app@latest realtime-tab-transcriber \
  --ts \
  --app \
  --tailwind \
  --eslint
```

必要なら `src/` は使わず、ルート直下 `app/`, `components/`, `lib/` で十分です。

## 受け入れ条件

```bash
npm run dev
npm run lint
npm run build
```

が通る。

## このPRでやらないこと

* 認証
* OpenAI連携
* 音声取得
* UI作り込み

---

# 5. PR-02：型・定数・エラー方針

## 目的

後続PRで責務が散らばらないよう、最初に共通型と定数だけ用意する。

## 追加ファイル

```txt
lib/constants.ts
lib/types.ts
lib/errors.ts
.env.example
```

## コア例

```ts
// lib/constants.ts
export const TRANSCRIPT_CACHE_KEY = "transcript-cache-v1";
export const TRANSCRIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const REALTIME_MODEL = "gpt-realtime-whisper";
export const TRANSCRIPTION_LANGUAGE = "ja";

export const AUTH_COOKIE_NAME = "transcriber_auth";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
```

```ts
// lib/types.ts
export type AppStatus =
  | "auth_required"
  | "idle"
  | "requesting_display"
  | "connecting"
  | "transcribing"
  | "stopped"
  | "error";

export type TranscriptCache = {
  text: string;
  savedAt: number;
};

export type TranscriptEvent =
  | { type: "delta"; text: string }
  | { type: "completed"; text: string };
```

```env
# .env.example
OPENAI_API_KEY=
APP_PASSCODE=
AUTH_SECRET=
```

## 受け入れ条件

* 型・定数がビルドで参照可能。
* `.env.local` はGit管理しない。
* `.env.example` のみGit管理する。

---

# 6. PR-03：簡易パスコード認証API

## 目的

Vercel公開時にURLを知っている人が自由に使えないようにする。
ログイン基盤は作らず、MVPとしてパスコード + HttpOnly Cookie に限定する。

Next.jsの `cookies()` はRoute Handlerで読み書きでき、`httpOnly`、`secure`、`sameSite` などのCookie属性を設定できます。([Next.js][5])

## 追加/変更ファイル

```txt
lib/auth.ts
app/api/auth/route.ts
app/api/auth/me/route.ts
app/api/logout/route.ts
```

## コア処理例

```ts
// lib/auth.ts
import crypto from "node:crypto";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE_SECONDS } from "./constants";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

export function signAuthValue(value: string): string {
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("hex");

  return `${value}.${sig}`;
}

export function verifyAuthValue(signedValue?: string): boolean {
  if (!signedValue) return false;

  const [value, sig] = signedValue.split(".");
  if (!value || !sig) return false;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
};

export { AUTH_COOKIE_NAME };
```

```ts
// app/api/auth/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, authCookieOptions, signAuthValue } from "@/lib/auth";

export async function POST(request: Request) {
  const { passcode } = await request.json();

  if (!process.env.APP_PASSCODE) {
    return NextResponse.json({ ok: false, error: "APP_PASSCODE is not set" }, { status: 500 });
  }

  if (passcode !== process.env.APP_PASSCODE) {
    return NextResponse.json({ ok: false, error: "Invalid passcode" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, signAuthValue("ok"), authCookieOptions);

  return NextResponse.json({ ok: true });
}
```

## 注意

`timingSafeEqual` は長さが違うと例外になるため、最終実装では長さチェックを入れるとより安全です。MVPではこの辺りも小さな関数に閉じ込めます。

## 受け入れ条件

* 正しいパスコードでCookieがセットされる。
* 誤ったパスコードでは401。
* `/api/auth/me` で認証状態を返す。
* `/api/logout` でCookieを削除する。

---

# 7. PR-04：認証ゲートUI

## 目的

未認証ならパスコード入力画面、認証済みなら文字起こし画面を表示する。

## 追加/変更ファイル

```txt
components/PasscodeGate.tsx
app/page.tsx
```

## コンポーネント責務

| ファイル               | 責務                              |
| ------------------ | ------------------------------- |
| `PasscodeGate.tsx` | 認証状態確認、パスコード送信、認証済み時にchildren表示 |
| `page.tsx`         | レイアウトと `PasscodeGate` の呼び出し     |

## 受け入れ条件

* 未認証時はパスコード画面のみ表示。
* 認証後にメイン画面へ切り替わる。
* リロード後もCookieが有効ならメイン画面が表示される。

---

# 8. PR-05：localStorage 24時間キャッシュ

## 目的

リロードしても文字起こしテキストが24時間以内なら復元されるようにする。
音声データは保存しない。

## 追加ファイル

```txt
lib/cache.ts
```

## コア処理例

```ts
// lib/cache.ts
import { TRANSCRIPT_CACHE_KEY, TRANSCRIPT_CACHE_TTL_MS } from "./constants";
import type { TranscriptCache } from "./types";

export function loadTranscriptCache(): string {
  if (typeof window === "undefined") return "";

  const raw = window.localStorage.getItem(TRANSCRIPT_CACHE_KEY);
  if (!raw) return "";

  try {
    const cache = JSON.parse(raw) as TranscriptCache;
    const expired = Date.now() - cache.savedAt > TRANSCRIPT_CACHE_TTL_MS;

    if (expired) {
      window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
      return "";
    }

    return cache.text;
  } catch {
    window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
    return "";
  }
}

export function saveTranscriptCache(text: string): void {
  const cache: TranscriptCache = { text, savedAt: Date.now() };
  window.localStorage.setItem(TRANSCRIPT_CACHE_KEY, JSON.stringify(cache));
}

export function clearTranscriptCache(): void {
  window.localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
}
```

## 受け入れ条件

* 確定テキストがlocalStorageに保存される。
* 24時間以内はリロード後に復元される。
* 24時間超過時は削除される。
* クリアボタン予定のために `clearTranscriptCache()` がある。

---

# 9. PR-06：基本UIコンポーネント

## 目的

OpenAI接続前に、画面の状態・ボタン・文字表示領域を整える。

## 追加ファイル

```txt
components/ActionButtons.tsx
components/StatusBadge.tsx
components/TranscriptViewer.tsx
components/TranscriptionPanel.tsx
```

## 責務

| コンポーネント              | 責務              |
| -------------------- | --------------- |
| `ActionButtons`      | 開始・停止・コピー・クリア   |
| `StatusBadge`        | 状態表示のみ          |
| `TranscriptViewer`   | 暫定テキスト・確定テキスト表示 |
| `TranscriptionPanel` | 状態管理の親コンポーネント   |

## 受け入れ条件

* 開始/停止/コピー/クリアボタンがある。
* 状態表示がある。
* 暫定テキストと確定テキスト欄が分かれている。
* このPRではまだ音声取得しない。

---

# 10. PR-07：Chromeタブ音声取得

## 目的

`getDisplayMedia()` でユーザーにChromeタブを共有してもらい、音声トラックを取得する。

`getDisplayMedia()` はユーザー選択を強制的に絞り込むAPIではなく、オプションは選択後に適用される性質があります。そのため、UI上で「Chromeタブを選び、音声を共有をONにしてください」と明示します。([MDNウェブドキュメント][3])

## 追加ファイル

```txt
lib/display-media.ts
```

## コア処理例

```ts
// lib/display-media.ts
type ExtendedDisplayMediaOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  monitorTypeSurfaces?: "include" | "exclude";
};

export async function requestTabAudioStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("このブラウザでは画面共有APIを利用できません");
  }

  const options: ExtendedDisplayMediaOptions = {
    video: { displaySurface: "browser" },
    audio: { suppressLocalAudioPlayback: false },
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    systemAudio: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  };

  const stream = await navigator.mediaDevices.getDisplayMedia(options);

  if (stream.getAudioTracks().length === 0) {
    stopMediaStream(stream);
    throw new Error("音声を取得できませんでした。タブ共有時に音声共有をONにしてください。");
  }

  return stream;
}

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
```

## 実装メモ

* `video` は必須。
* 実際にOpenAIへ渡すのは音声トラックのみ。
* 共有終了時は、音声トラックだけでなく映像トラックも `stop()` する。
* `monitorTypeSurfaces: "exclude"` は画面全体共有の誤選択を減らす意図。ただしブラウザ実装差があるため、UI案内も必須。

## 受け入れ条件

* 開始ボタンでChrome共有UIが出る。
* タブ共有 + 音声共有ONなら音声トラックが取得できる。
* 音声共有OFFならエラー表示される。
* 停止時に共有インジケータが消える。

---

# 11. PR-08：OpenAI Realtime SDP API

## 目的

ブラウザから受け取ったSDP offerをOpenAIへ中継し、SDP answerを返す。

## 追加ファイル

```txt
app/api/realtime/sdp/route.ts
```

## 採用するセッション設定

```json
{
  "type": "transcription",
  "audio": {
    "input": {
      "transcription": {
        "model": "gpt-realtime-whisper",
        "language": "ja",
        "delay": "low"
      },
      "turn_detection": {
        "type": "server_vad",
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "silence_duration_ms": 500
      }
    }
  }
}
```

`language` はISO-639-1形式の言語ヒントで、指定すると精度・遅延改善に役立つとされています。`delay` は `gpt-realtime-whisper` のGA Realtime sessionsで利用でき、値を上げると精度寄り、下げると低遅延寄りになります。([OpenAI Developers][6])

## コア処理例

```ts
// app/api/realtime/sdp/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthValue } from "@/lib/auth";
import { REALTIME_MODEL, TRANSCRIPTION_LANGUAGE } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!verifyAuthValue(authCookie)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
  }

  const sdp = await request.text();

  const sessionConfig = {
    type: "transcription",
    audio: {
      input: {
        transcription: {
          model: REALTIME_MODEL,
          language: TRANSCRIPTION_LANGUAGE,
          delay: "low",
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

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(sessionConfig));

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json({ error: message }, { status: response.status });
  }

  return new Response(await response.text(), {
    headers: { "Content-Type": "application/sdp" },
  });
}
```

## 受け入れ条件

* 未認証なら401。
* APIキー未設定なら500。
* SDP offerをPOSTするとSDP answerが返る。
* ブラウザにOpenAI APIキーが露出しない。

---

# 12. PR-09：WebRTC接続クライアント

## 目的

取得したChromeタブ音声トラックをWebRTCでOpenAI Realtimeへ送る。

## 追加ファイル

```txt
lib/realtime-client.ts
```

## コア処理例

```ts
// lib/realtime-client.ts
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

  const dataChannel = peer.createDataChannel("oai-events");

  dataChannel.onopen = () => handlers.onOpen?.();
  dataChannel.onerror = () => handlers.onError?.(new Error("DataChannel error"));
  dataChannel.onmessage = (message) => {
    try {
      handlers.onEvent(JSON.parse(message.data));
    } catch {
      handlers.onError?.(new Error("Realtimeイベントの解析に失敗しました"));
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

  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: await response.text(),
  };

  await peer.setRemoteDescription(answer);

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

## 受け入れ条件

* `MediaStream` を渡すとWebRTC接続できる。
* DataChannel経由でRealtimeイベントを受信できる。
* `close()` で接続が閉じる。

---

# 13. PR-10：transcriptイベント反映

## 目的

OpenAI RealtimeイベントをUI状態に変換する。

## 追加ファイル

```txt
lib/transcript-events.ts
```

## コア処理例

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

## `TranscriptionPanel` 側の状態イメージ

```ts
const [partialText, setPartialText] = useState("");
const [finalText, setFinalText] = useState("");

function handleRealtimeEvent(raw: unknown) {
  const event = parseTranscriptEvent(raw);
  if (!event) return;

  if (event.type === "delta") {
    setPartialText((prev) => prev + event.text);
    return;
  }

  setFinalText((prev) => {
    const next = `${prev}${prev ? "\n" : ""}${event.text}`;
    saveTranscriptCache(next);
    return next;
  });
  setPartialText("");
}
```

## 受け入れ条件

* deltaが暫定テキストに表示される。
* completedが確定テキストに追記される。
* completed後、暫定テキストがクリアされる。
* 確定テキストがlocalStorageに保存される。

---

# 14. PR-11：停止・コピー・クリア・エラー整理

## 目的

MVPとして実用できる操作を揃える。

## 実装内容

### 停止

```ts
function stopTranscription() {
  realtimeRef.current?.close();
  realtimeRef.current = null;

  stopMediaStream(mediaStreamRef.current);
  mediaStreamRef.current = null;

  setPartialText("");
  setStatus("stopped");
}
```

### コピー

```ts
await navigator.clipboard.writeText(finalText);
```

### クリア

```ts
setFinalText("");
setPartialText("");
clearTranscriptCache();
```

## エラー表示方針

| 状況           | 表示                      |
| ------------ | ----------------------- |
| 音声共有OFF      | タブ共有時に「音声を共有」をONにしてください |
| ユーザーが共有キャンセル | 共有がキャンセルされました           |
| APIキー未設定     | サーバー設定に問題があります          |
| OpenAI接続失敗   | 文字起こしサービスへの接続に失敗しました    |
| 非対応ブラウザ      | macOS版Chrome最新版をご利用ください |

## 受け入れ条件

* 停止するとChromeの共有状態が終了する。
* コピーできる。
* クリアすると画面とlocalStorageが消える。
* 主要な失敗ケースでユーザー向けメッセージが出る。

---

# 15. PR-12：Vercelデプロイ・動作確認

## 目的

Vercel HTTPS上でMVP要件を満たすことを確認する。

## Vercel環境変数

VercelのProject Settingsで以下を設定します。

```txt
OPENAI_API_KEY=sk-...
APP_PASSCODE=任意のパスコード
AUTH_SECRET=十分長いランダム文字列
```

Vercelの環境変数変更は既存デプロイには反映されず、反映には再デプロイが必要です。([Vercel][7])

## `AUTH_SECRET` 生成例

```bash
openssl rand -base64 32
```

## デプロイ

```bash
npm run build
vercel
vercel --prod
```

またはGitHub連携でmainブランチをProduction Deployにします。

## 本番動作確認チェックリスト

```txt
[ ] Vercel URLがHTTPSで開ける
[ ] パスコード未入力ではメイン画面に入れない
[ ] 正しいパスコードで入れる
[ ] 開始ボタンでChrome共有UIが開く
[ ] Chromeタブを選べる
[ ] 音声共有ONで音声トラックが取得される
[ ] 日本語音声が暫定表示される
[ ] 発話区切り後に確定テキストへ移る
[ ] 停止ボタンで共有が止まる
[ ] リロード後、24時間以内なら文字起こしが復元される
[ ] クリアでlocalStorageが消える
[ ] OpenAI APIキーがブラウザDevToolsに露出していない
```

---

# 16. 実装時の注意点

## 16.1 「Chromeタブ音声だけ」を完全強制できない

`getDisplayMedia()` の選択UIはブラウザ側が制御します。`displaySurface: "browser"` や `monitorTypeSurfaces: "exclude"` はヒントとして使えますが、選択肢を完全にアプリ側で強制するものではありません。MDNでも、指定オプションはユーザーの選択肢を制限するためではなく、選択後に適用される性質だと説明されています。([MDNウェブドキュメント][3])

そのため、UI文言は必須です。

```txt
Chromeタブを選択し、「音声を共有」をONにしてください。
画面全体やウィンドウ共有では、期待通り音声が取得できない場合があります。
```

## 16.2 映像トラックも取得される

音声文字起こし目的でも、`getDisplayMedia()` は映像トラックを必要とします。映像は画面に表示せず、停止時に必ず `stop()` します。([MDNウェブドキュメント][3])

## 16.3 音声は保存しない

今回のMVPでは、保存するのは文字起こしテキストだけです。音声トラックはWebRTCでOpenAIへ送信されますが、自前DB・Storage・ファイルには保存しません。

## 16.4 `gpt-realtime-whisper` の遅延設定

MVPでは `delay: "low"` 推奨です。

```txt
minimal: 低遅延寄り
low: MVPの初期値として無難
medium/high/xhigh: 精度寄り
```

公式にも、delayを低くすると早い部分結果、高くすると品質改善が期待できると説明されています。([OpenAI Developers][6])

---

# 17. 最終的なPR一覧

|    PR | 目的             | 主な変更                               |
| ----: | -------------- | ---------------------------------- |
| PR-01 | 土台作成           | Next.js初期化、Tailwind、lint/build確認   |
| PR-02 | 共通定義           | constants/types/errors/env example |
| PR-03 | 認証API          | パスコード、署名Cookie、me/logout           |
| PR-04 | 認証UI           | PasscodeGate、未認証制御                 |
| PR-05 | キャッシュ          | localStorage 24時間保存/復元/削除          |
| PR-06 | UI骨格           | ボタン、状態、表示欄                         |
| PR-07 | 音声取得           | getDisplayMedia、音声トラック検証           |
| PR-08 | OpenAI SDP API | `/api/realtime/sdp`、OpenAI中継       |
| PR-09 | WebRTC接続       | RTCPeerConnection、DataChannel      |
| PR-10 | transcript反映   | delta/completedイベントをUIへ反映          |
| PR-11 | UX仕上げ          | 停止、コピー、クリア、エラー                     |
| PR-12 | デプロイ           | Vercel環境変数、本番確認                    |

---

# 18. 実装完了時の定義

このMVPは、以下を満たしたら完了です。

```txt
Vercel HTTPS上で動く
簡易パスコードでアクセス制限できる
Chromeタブ音声を共有できる
日本語音声がリアルタイムに文字起こしされる
暫定テキストと確定テキストが表示される
停止できる
文字起こし結果が24時間だけ復元される
音声ファイルは保存されない
OpenAI APIキーはブラウザに露出しない
```

この手順で進めれば、MVPとしては過剰設計を避けつつ、DRY / YAGNI / KISS / SRP を守った形で実装できます。

[1]: https://developers.openai.com/api/docs/guides/realtime-webrtc "Realtime API with WebRTC | OpenAI API"
[2]: https://developers.openai.com/api/docs/guides/realtime-transcription "Realtime transcription | OpenAI API"
[3]: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia "MediaDevices: getDisplayMedia() method - Web APIs | MDN"
[4]: https://vercel.com/docs/environment-variables "Environment variables"
[5]: https://nextjs.org/docs/app/api-reference/functions/cookies "Functions: cookies | Next.js"
[6]: https://developers.openai.com/api/reference/resources/realtime/subresources/transcription_sessions/methods/create/ "Create transcription session | OpenAI API Reference"
[7]: https://vercel.com/docs/environment-variables/managing-environment-variables "Managing environment variables"
