以下は **MVP最小構成** に絞った要件定義・設計です。
方針は **DRY / YAGNI / KISS / SRP** を優先し、不要なDB・ログイン基盤・録音保存・多ブラウザ対応は入れません。

---

# 1. 技術的実現性

このMVPは、以下の条件下で **技術的に実現可能**です。

対象は、

```txt
macOS
Chrome最新版
Vercel HTTPS
Chromeタブ音声
日本語リアルタイム文字起こし
```

です。

`getDisplayMedia()` は、ユーザーに画面・ウィンドウ・タブの共有対象を選ばせ、許可された内容を `MediaStream` として取得できるWeb APIです。HTTPSなどの安全なコンテキストで利用され、ユーザー操作と毎回の許可が必要です。今回の「開始ボタン → Chromeタブ共有 → 音声共有ON → 文字起こし開始」というUXと合います。([MDNウェブドキュメント][1])

OpenAI Realtime API は、ブラウザ・モバイルのリアルタイム音声用途では WebRTC が推奨されており、`gpt-realtime-whisper` はライブ音声から低遅延で transcript delta を返すストリーミング音声認識モデルとして公式に提供されています。([OpenAI Developers][2])

OpenAI APIキーはブラウザに出さず、Next.jsのサーバー側Route Handlerで一時的なクライアントシークレットを発行する構成にします。Next.jsの環境変数はデフォルトではサーバー側のみで利用され、ブラウザに公開するには `NEXT_PUBLIC_` 接頭辞が必要です。Vercelの環境変数はトークンなどの機密値管理に使えます。([Next.js][3])

---

# 2. MVP要件定義

## 2.1 アプリ概要

**Chromeタブから出る日本語音声を、Webアプリ上でリアルタイム文字起こしする。**

ユーザーはVercel上のWebアプリにアクセスし、簡易パスコードで利用許可後、開始ボタンを押します。Chromeの共有UIで対象タブを選び、「音声を共有」をONにすると、文字起こしが開始されます。

---

## 2.2 対象ユーザー

MVPでは **自分または限られた利用者** を想定します。

そのため、

* 本格的なユーザー認証
* ユーザー別履歴管理
* 課金管理
* DB保存
* 管理画面

は実装しません。

---

## 2.3 対象環境

| 項目   | 内容                                       |
| ---- | ---------------------------------------- |
| OS   | macOS                                    |
| ブラウザ | Chrome最新版                                |
| 実行環境 | Vercel HTTPS                             |
| 音声対象 | Chromeタブ音声                               |
| 言語   | 日本語固定                                    |
| 認証   | 簡易パスコード                                  |
| 保存   | 音声保存なし、文字起こしテキストのみlocalStorageに24時間キャッシュ |

---

# 3. 機能要件

## 3.1 必須機能

| ID   | 機能                | 内容                                    |
| ---- | ----------------- | ------------------------------------- |
| F-01 | 簡易パスコード認証         | パスコード入力後にアプリを利用可能にする                  |
| F-02 | 文字起こし開始           | 開始ボタンでChromeの共有UIを起動する                |
| F-03 | タブ音声取得            | `getDisplayMedia()` で共有タブの音声トラックを取得する |
| F-04 | OpenAI Realtime接続 | サーバーから一時トークンを取得し、WebRTCで接続する          |
| F-05 | 日本語文字起こし          | 日本語前提でリアルタイム文字起こしする                   |
| F-06 | 暫定テキスト表示          | 発話中の途中結果を表示する                         |
| F-07 | 確定テキスト表示          | 確定した文字起こし結果を本文に追加する                   |
| F-08 | 停止                | 停止ボタンで共有・WebRTC・音声トラックを停止する           |
| F-09 | 24時間キャッシュ         | 文字起こし結果をlocalStorageに保存し、24時間後に破棄する   |
| F-10 | コピー               | 文字起こし全文をクリップボードにコピーする                 |
| F-11 | クリア               | 画面上の文字起こし結果とキャッシュを削除する                |
| F-12 | エラー表示             | 音声未共有、接続失敗、認証失敗などをユーザーに表示する           |

---

## 3.2 MVPではやらないこと

YAGNIの観点で、以下は実装しません。

| 対象               | 理由                     |
| ---------------- | ---------------------- |
| DB保存             | MVPではlocalStorageで十分   |
| 音声ファイル保存         | プライバシー・実装量・コストを増やすため不要 |
| 本格ログイン           | 個人利用MVPでは過剰            |
| ユーザー管理           | MVP範囲外                 |
| Safari/Firefox対応 | 仕様差分が増えるため対象外          |
| macOS全体音声取得      | Webアプリ単体では制約が強く、今回の対象外 |
| 文字起こし履歴一覧        | DBが必要になるため対象外          |
| 要約機能             | 初期MVPでは文字起こしに集中        |
| 話者分離             | 精度・実装負荷が上がるため対象外       |
| 翻訳               | 日本語固定のため不要             |

---

# 4. 非機能要件

## 4.1 セキュリティ

| 項目           | 方針                                        |
| ------------ | ----------------------------------------- |
| OpenAI APIキー | フロントに出さない。Vercel環境変数 `OPENAI_API_KEY` に保存 |
| 簡易パスコード      | Vercel環境変数 `APP_PASSCODE` に保存             |
| 認証状態         | HttpOnly Cookieで保持                        |
| 音声データ        | 保存しない                                     |
| 文字起こしデータ     | ユーザーのブラウザlocalStorageにのみ保存                |
| 外部送信         | 音声ストリームはOpenAI Realtime APIへ送信            |
| HTTPS        | VercelデプロイによりHTTPS利用                      |

---

## 4.2 パフォーマンス

MVPでは、1ユーザー・1セッション前提です。

| 項目     | 方針                              |
| ------ | ------------------------------- |
| 遅延     | Realtime APIのdeltaを逐次表示         |
| 画面更新   | transcript deltaをReact stateに反映 |
| 保存     | 確定テキスト更新時のみlocalStorageへ保存      |
| サーバー負荷 | 一時トークン発行のみ。音声中継はしない             |

---

## 4.3 可用性

Vercel上のNext.jsアプリとして動作させます。

ただしMVPでは、

* 再接続処理
* セッション復元
* サーバー側履歴復旧

は実装しません。

---

# 5. 推奨技術スタック

## 最小推奨スタック

| 領域       | 技術                                         |
| -------- | ------------------------------------------ |
| フレームワーク  | Next.js App Router                         |
| 言語       | TypeScript                                 |
| UI       | React / Tailwind CSS                       |
| デプロイ     | Vercel                                     |
| 音声取得     | `navigator.mediaDevices.getDisplayMedia()` |
| リアルタイム通信 | WebRTC                                     |
| 音声認識     | OpenAI Realtime API                        |
| モデル      | `gpt-realtime-whisper`                     |
| 認証       | 簡易パスコード + HttpOnly Cookie                  |
| キャッシュ    | localStorage                               |
| DB       | なし                                         |

---

# 6. 全体アーキテクチャ

```txt
User
 ↓
Vercel / Next.js Web App
 ↓
[簡易パスコード認証]
 ↓
Transcription Page
 ↓
getDisplayMedia()
 ↓
Chromeタブ音声 MediaStream
 ↓
WebRTC PeerConnection
 ↓
OpenAI Realtime API
 ↓
transcript delta / completed
 ↓
React UI
 ↓
localStorage 24h cache
```

---

# 7. データフロー

## 7.1 認証フロー

```txt
1. ユーザーがパスコードを入力
2. POST /api/auth
3. サーバーで APP_PASSCODE と比較
4. 正しければ HttpOnly Cookie をセット
5. 文字起こし画面を利用可能にする
```

Cookieには、単純な平文ではなく、署名付きの簡易トークンを保存します。

MVPではDBを持たないため、認証状態はCookieだけで管理します。

---

## 7.2 文字起こし開始フロー

```txt
1. ユーザーが「開始」を押す
2. /api/realtime/session からOpenAI用の一時クライアントシークレットを取得
3. getDisplayMedia() でChromeタブ共有UIを表示
4. ユーザーが対象タブを選び、音声共有をONにする
5. 音声トラックを取得
6. RTCPeerConnectionを作成
7. 音声トラックをPeerConnectionに追加
8. OpenAI Realtime APIにWebRTC接続
9. DataChannelで文字起こしイベントを受信
10. UIに暫定・確定テキストを表示
11. 確定テキストをlocalStorageに保存
```

---

## 7.3 停止フロー

```txt
1. ユーザーが「停止」を押す
2. MediaStream tracks を stop()
3. RTCPeerConnection を close()
4. DataChannel を close()
5. 状態を idle に戻す
6. 確定テキストはlocalStorageに残す
```

---

# 8. 画面設計

## 8.1 画面構成

```txt
リアルタイム文字起こし

Chromeタブを共有し、「音声を共有」をONにしてください。

[開始] [停止] [コピー] [クリア]

状態:
待機中 / 共有選択中 / 接続中 / 文字起こし中 / 停止済み / エラー

暫定テキスト:
...

確定テキスト:
...
```

---

## 8.2 UI状態

| 状態                   | 説明                 |
| -------------------- | ------------------ |
| `idle`               | 開始前                |
| `auth_required`      | パスコード未認証           |
| `requesting_display` | 共有対象選択中            |
| `connecting`         | OpenAI Realtime接続中 |
| `transcribing`       | 文字起こし中             |
| `stopped`            | 停止済み               |
| `error`              | エラー発生              |

---

# 9. API設計

## 9.1 `POST /api/auth`

簡易パスコード認証用。

### Request

```json
{
  "passcode": "入力されたパスコード"
}
```

### Response 成功

```json
{
  "ok": true
}
```

### Response 失敗

```json
{
  "ok": false,
  "error": "Invalid passcode"
}
```

### 責務

* パスコード検証
* 署名付きCookie発行

---

## 9.2 `POST /api/logout`

認証Cookieを削除します。

### Response

```json
{
  "ok": true
}
```

---

## 9.3 `GET /api/auth/me`

認証状態確認用。

### Response

```json
{
  "authenticated": true
}
```

---

## 9.4 `POST /api/realtime/session`

OpenAI Realtime API用の一時セッションを発行します。

### Request

なし。

### Response

```json
{
  "client_secret": {
    "value": "ephemeral_token"
  }
}
```

### 責務

* 認証済みCookieの確認
* OpenAI APIキーを使って一時セッションを作成
* ブラウザへ一時クライアントシークレットのみ返す

---

# 10. フロントエンド設計

## 10.1 コンポーネント構成

```txt
app/
  page.tsx
  api/
    auth/
      route.ts
    auth/me/
      route.ts
    logout/
      route.ts
    realtime/session/
      route.ts

components/
  PasscodeGate.tsx
  TranscriptionPanel.tsx
  StatusBadge.tsx
  TranscriptViewer.tsx
  ActionButtons.tsx

lib/
  auth.ts
  cache.ts
  realtime.ts
  display-media.ts
  constants.ts
  types.ts
```

---

## 10.2 各責務

| ファイル                     | 責務                       |
| ------------------------ | ------------------------ |
| `PasscodeGate.tsx`       | パスコード入力・認証状態確認           |
| `TranscriptionPanel.tsx` | 文字起こし画面全体の制御             |
| `StatusBadge.tsx`        | 状態表示                     |
| `TranscriptViewer.tsx`   | 暫定・確定テキスト表示              |
| `ActionButtons.tsx`      | 開始・停止・コピー・クリア            |
| `lib/auth.ts`            | Cookie署名・検証              |
| `lib/cache.ts`           | localStorage保存・復元・期限切れ削除 |
| `lib/realtime.ts`        | OpenAI Realtime WebRTC接続 |
| `lib/display-media.ts`   | `getDisplayMedia()` 呼び出し |
| `lib/constants.ts`       | TTL、モデル名、状態定義            |
| `lib/types.ts`           | 型定義                      |

SRPのため、**UI・音声取得・Realtime接続・キャッシュ・認証**を分離します。

---

# 11. localStorageキャッシュ設計

## 11.1 保存内容

音声は保存しません。文字起こしテキストのみ保存します。

```ts
type TranscriptCache = {
  text: string;
  savedAt: number;
};
```

## 11.2 キー

```txt
transcript-cache-v1
```

## 11.3 TTL

```txt
24時間
```

## 11.4 復元仕様

```txt
1. ページ読み込み時にlocalStorageを確認
2. savedAtから24時間以内なら復元
3. 24時間超過なら削除
4. クリアボタンで明示削除
```

---

# 12. エラー設計

| エラー        | 表示メッセージ                                     |
| ---------- | ------------------------------------------- |
| パスコード誤り    | パスコードが正しくありません                              |
| 音声トラックなし   | 音声を取得できませんでした。Chromeタブ共有時に「音声を共有」をONにしてください |
| 共有キャンセル    | 共有がキャンセルされました                               |
| OpenAI接続失敗 | 文字起こしサービスへの接続に失敗しました                        |
| APIキー未設定   | サーバー設定に問題があります                              |
| ブラウザ非対応    | このブラウザでは利用できません。macOS版Chrome最新版をご利用ください     |
| 不明なエラー     | 予期しないエラーが発生しました                             |

---

# 13. 環境変数

Vercelに以下を設定します。

```env
OPENAI_API_KEY=sk-...
APP_PASSCODE=任意のパスコード
AUTH_SECRET=ランダムな長い文字列
```

フロントに公開する必要がある値は原則ありません。

`OPENAI_API_KEY` や `APP_PASSCODE` に `NEXT_PUBLIC_` は付けません。

---

# 14. 採用する設計原則

## DRY

同じ処理を重複させません。

例：

* localStorage処理は `lib/cache.ts` に集約
* 認証Cookie処理は `lib/auth.ts` に集約
* Realtime接続処理は `lib/realtime.ts` に集約

---

## YAGNI

MVPに不要なものは入れません。

入れないもの：

* DB
* 本格ログイン
* 音声保存
* 履歴一覧
* ユーザー管理
* 要約
* 翻訳
* 話者分離
* 複数ブラウザ対応

---

## KISS

構成を単純にします。

```txt
Next.js + Vercel + OpenAI Realtime + localStorage
```

だけで完結させます。

音声を自前サーバーで中継しないため、サーバー側の複雑性も抑えます。

---

## SRP

責務を分離します。

| 責務       | 配置                       |
| -------- | ------------------------ |
| 画面表示     | React components         |
| 音声取得     | `display-media.ts`       |
| OpenAI接続 | `realtime.ts`            |
| キャッシュ    | `cache.ts`               |
| 認証       | `auth.ts` / API routes   |
| 状態管理     | `TranscriptionPanel.tsx` |

---

# 15. 受け入れ条件

MVP完了条件は以下です。

* Vercelにデプロイできる
* HTTPS上でアクセスできる
* パスコード入力後にアプリ画面へ進める
* 開始ボタンでChromeの共有UIが開く
* Chromeタブを選び、音声共有ONで文字起こしが開始される
* 日本語音声がリアルタイムに表示される
* 暫定テキストと確定テキストが区別される
* 停止ボタンで音声取得と接続が停止する
* リロードしても24時間以内なら文字起こしテキストが復元される
* 24時間超過後はキャッシュが破棄される
* 音声ファイルは保存されない
* OpenAI APIキーがブラウザに露出しない

---

# 16. 推奨実装順

```txt
1. Next.jsプロジェクト作成
2. Tailwind最低限設定
3. 簡易パスコード認証API
4. 認証ゲートUI
5. localStorageキャッシュ処理
6. getDisplayMedia()で音声トラック取得
7. OpenAI Realtime一時セッションAPI
8. WebRTC接続処理
9. transcriptイベントのUI反映
10. 停止・コピー・クリア
11. エラーハンドリング
12. Vercel環境変数設定
13. Vercelデプロイ
14. Chromeタブ音声で動作確認
```

---

# 17. 最終設計方針

今回のMVPは、次の構成で進めるのが最も堅いです。

```txt
Next.js App Router
TypeScript
Tailwind CSS
Vercel
getDisplayMedia()
OpenAI Realtime API
gpt-realtime-whisper
WebRTC
簡易パスコード認証
localStorage 24時間キャッシュ
DBなし
音声保存なし
```

これで、要件を満たしつつ、実装量・運用コスト・セキュリティリスクを最小化できます。

[1]: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia?utm_source=chatgpt.com "MediaDevices: getDisplayMedia() method - Web APIs | MDN"
[2]: https://developers.openai.com/api/docs/guides/realtime?utm_source=chatgpt.com "Realtime and audio | OpenAI API"
[3]: https://nextjs.org/docs/app/guides/environment-variables?utm_source=chatgpt.com "Guides: Environment Variables"
