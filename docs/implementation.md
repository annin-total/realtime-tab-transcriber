以下の方針で実装手順書を作成します。

重要な更新点として、OpenAI Realtime のブラウザ接続は **ephemeral token 方式** とする。サーバーが `POST /v1/realtime/transcription_sessions` で短命クライアントシークレットを発行し、ブラウザが `Authorization: Bearer <ephemeral>` で `POST https://api.openai.com/v1/realtime/calls` に SDP offer を直接送る。標準 API キーはサーバーのみが保持する。([OpenAI Developers][1])

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
WebRTC（transcription_sessions → /v1/realtime/calls）
OpenAI Realtime transcription
gpt-4o-transcribe（精度優先・既定。環境変数で切替可）
localStorage 24時間キャッシュ
DBなし
音声保存なし
```

Realtime transcription は「音声からテキストだけを得る」用途向けで、**MVP 既定モデルは `gpt-4o-transcribe`**（語誤りを抑えたいタブ音声向き）。`conversation.item.input_audio_transcription.delta` / `completed` 等のイベントで暫定・確定を受け取る。低遅延特化の `gpt-realtime-whisper` は環境変数 `OPENAI_REALTIME_TRANSCRIPTION_MODEL` で任意指定とし、GA 経路未対応の組織では拒否され得る。([OpenAI Developers][2])

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
  ↓ POST /api/realtime/session（Cookie 認証）
Next.js API
  ↓ POST /v1/realtime/transcription_sessions（標準 API キー）
OpenAI
  ↓ client_secret（短命トークン）を JSON で返す
ブラウザ
  ↓ createOffer() → POST https://api.openai.com/v1/realtime/calls（Bearer = client_secret）
OpenAI
  ↓ SDP answer
ブラウザ
  ↓ setRemoteDescription()
WebRTC接続開始
```

公式の WebRTC 手順では、ephemeral キーをサーバーで発行し、ブラウザが `POST /v1/realtime/calls` に SDP を直接送る流れが説明されています。([OpenAI Developers][1])

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
PR-08: OpenAI Realtime 一時セッション API
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
      session/
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
  openai-realtime-session.ts
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

export const REALTIME_MODEL = "gpt-4o-transcribe";
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
# .env.example（抜粋）
OPENAI_API_KEY=
# OPENAI_ORGANIZATION=org_…
# OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-realtime-whisper
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

# 11. PR-08：OpenAI Realtime 一時セッション API

## 目的

認証済みクライアント向けに、`POST https://api.openai.com/v1/realtime/transcription_sessions` をサーバーから呼び出し、**短命の `client_secret`** を JSON で返す。リクエスト body は `lib/openai-realtime-session.ts` の `buildTranscriptionSessionBody()` に集約する。

## 追加ファイル

```txt
app/api/realtime/session/route.ts
lib/openai-realtime-session.ts
```

## 採用する transcription_sessions の body（既定：`gpt-4o-transcribe`）

```json
{
  "input_audio_format": "pcm16",
  "input_audio_transcription": {
    "model": "gpt-4o-transcribe",
    "language": "ja"
  },
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500
  }
}
```

`language` は ISO-639-1 の言語ヒント。`delay` は **`gpt-realtime-whisper` の GA Realtime セッションでのみ**意味があり、MVP 既定の `gpt-4o-transcribe` では送らない（実装でもモデルが whisper のときだけ付与する）。([OpenAI Developers][6])

複数 Organization がある場合は、環境変数 `OPENAI_ORGANIZATION=org_…` を設定し、リクエストヘッダ `OpenAI-Organization` に渡す（表示名は不可）。

## コア処理例（要点）

```ts
// app/api/realtime/session/route.ts（概念）
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthValue } from "@/lib/auth";
import { OPENAI_TRANSCRIPTION_SESSIONS_URL } from "@/lib/constants";
import { buildTranscriptionSessionBody } from "@/lib/openai-realtime-session";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  if (!verifyAuthValue(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const org = process.env.OPENAI_ORGANIZATION?.trim();
  if (org) headers["OpenAI-Organization"] = org;

  const upstream = await fetch(OPENAI_TRANSCRIPTION_SESSIONS_URL, {
    method: "POST",
    headers,
    body: buildTranscriptionSessionBody(),
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: await upstream.text() }, { status: upstream.status });
  }
  const data = await upstream.json();
  return NextResponse.json({
    client_secret: data.client_secret.value,
    expires_at: data.client_secret.expires_at,
  });
}
```

## 受け入れ条件

* 未認証なら 401。
* `OPENAI_API_KEY` 未設定なら 500。
* 成功時、JSON に `client_secret`（短命トークン）が含まれる。
* **標準 API キーはレスポンスに含めない**（ブラウザへ渡すのは ephemeral のみ）。

---

# 12. PR-09：WebRTC接続クライアント

## 目的

`POST /api/realtime/session` で ephemeral を取得し、ブラウザから **`POST https://api.openai.com/v1/realtime/calls`** に SDP offer を送って SDP answer を受け取り、`RTCPeerConnection` を確立する。

## 追加ファイル

```txt
lib/realtime-client.ts
```

## コア処理例（要点）

```ts
// lib/realtime-client.ts（概念）
const sessionRes = await fetch("/api/realtime/session", { method: "POST", credentials: "same-origin" });
const { client_secret } = await sessionRes.json();

const offer = await peer.createOffer();
await peer.setLocalDescription(offer);

const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
  method: "POST",
  body: offer.sdp ?? "",
  headers: {
    Authorization: `Bearer ${client_secret}`,
    "Content-Type": "application/sdp",
  },
});
await peer.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
```

`DataChannel` 名は `oai-events`。接続確立後は従来どおり `conversation.item.input_audio_transcription.*` を処理する。

## 受け入れ条件

* `MediaStream` を渡すと WebRTC 接続できる。
* DataChannel 経由で Realtime イベントを受信できる。
* `close()` で PeerConnection / DataChannel を閉じられる。
* **`OPENAI_API_KEY` はブラウザに渡さない**（calls には ephemeral のみ）。

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
OPENAI_ORGANIZATION=org_…（複数 org 時のみ）
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-realtime-whisper（既定を変える場合のみ）
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

## 16.4 文字起こしモデルと `delay`

* **MVP 既定は `gpt-4o-transcribe`**。語誤りを抑えたいタブ音声向き。`transcription_sessions` の body では **`delay` は付けない**（whisper 専用パラメータのため）。
* **`gpt-realtime-whisper` に切り替える場合のみ**（環境変数 `OPENAI_REALTIME_TRANSCRIPTION_MODEL`）、GA Realtime 経路で `delay`（`minimal` / `low` / …）が意味を持つ。公式の遅延チューニングは Realtime transcription ガイドを参照。([OpenAI Developers][2])

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
| PR-08 | Realtime 一時セッション | `/api/realtime/session`、`transcription_sessions` |
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
