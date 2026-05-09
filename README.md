# realtime-tab-transcriber

Chrome タブの音声（および任意でマイク）を **OpenAI Realtime API（WebRTC）** でリアルタイム文字起こしする、Next.js 製のシングルページ Web アプリです。API キーはサーバーにのみ置き、ブラウザには短命トークンだけを渡します。

## 主な機能

- **簡易パスコード認証**（`PasscodeGate`）で画面へのアクセスを制限
- **タブ共有**（`getDisplayMedia`）で対象タブの音声を取得。「音声を共有」を ON にする必要があります
- **任意のマイク入力**を同時に文字起こしし、**タブ／自分**の入力経路で結果を分けて表示
- **同一ソースの連続発話**は確定テキストを 1 ブロックにまとめて表示（ラベルの繰り返しを抑える）
- **暫定テキスト**（ストリーミング中）と**確定テキスト**（発話単位）の表示、コピー、クリア
- **確定行の localStorage キャッシュ**（有効期限付き。旧単一テキスト形式からの移行あり）

## 想定環境

| 項目 | 内容 |
|------|------|
| OS | macOS（開発・動作確認の前提） |
| ブラウザ | Chrome 最新版 |
| デプロイ | HTTPS（例: Vercel）※`getDisplayMedia` / マイクは安全なコンテキストが前提 |

## 技術スタック

- **Next.js** 16（App Router）
- **React** 19
- **TypeScript** / **Tailwind CSS** v4
- **OpenAI Realtime**: `POST /v1/realtime/client_secrets` で短命トークン発行 → ブラウザが `POST /v1/realtime/calls` に SDP を送信（WebRTC）

## セットアップ

1. 依存関係のインストール

   ```bash
   npm install
   ```

2. 環境変数  
   [`.env.example`](.env.example) を参考に `.env.local` を作成します。

   | 変数 | 説明 |
   |------|------|
   | `OPENAI_API_KEY` | OpenAI API キー（サーバー専用） |
   | `APP_PASSCODE` | 画面アクセス用の共有パスコード |
   | `AUTH_SECRET` | 認証 Cookie 署名用の秘密文字列 |
   | `OPENAI_ORGANIZATION_ID` | 任意。組織 ID（`org_…`） |
   | `OPENAI_REALTIME_TRANSCRIPTION_MODEL` | 任意。未設定時は `gpt-4o-transcribe` 相当の既定 |

3. 開発サーバー

   ```bash
   npm run dev
   ```

4. 本番ビルド

   ```bash
   npm run build
   npm start
   ```

## npm スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm start` | 本番サーバー起動 |
| `npm run lint` | ESLint |

## ディレクトリの目安

| パス | 役割 |
|------|------|
| [`app/page.tsx`](app/page.tsx) | パスコードゲート配下のメイン画面 |
| [`app/api/realtime/session/`](app/api/realtime/session/) | Realtime 用 `client_secrets` のプロキシ（認証必須） |
| [`app/api/auth/`](app/api/auth/) | パスコード検証・セッション |
| [`components/TranscriptionPanel.tsx`](components/TranscriptionPanel.tsx) | 共有・Realtime・状態のオーケストレーション |
| [`lib/realtime-client.ts`](lib/realtime-client.ts) | WebRTC 接続（SDP・DataChannel） |
| [`lib/openai-realtime-session.ts`](lib/openai-realtime-session.ts) | セッション JSON ボディ組み立て |
| [`constants/`](constants/) | UI 文言・ユーザー向けエラー文言 |

## 注意事項

- **音声ファイルの永続保存は行いません**（ストリームを送るのみ）。
- マイクを ON にした場合、**タブ音声とマイクは別々の Realtime セッション**になり、概ね課金・負荷は二系統に近くなります。
- スピーカー出力がマイクに入ると、タブ側と自分側に**同じ内容が二重に出る**ことがあります。ヘッドホン利用を推奨します。

## ライセンス

`package.json` の `private: true` に従い、リポジトリ公開時は別途ライセンスを付与してください。
