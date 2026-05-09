/**
 * 文字起こしフローのユーザー向けメッセージ（docs/implementation.md PR-11 の表に準拠）
 */

/** `getDisplayMedia` 非対応 */
export const ERR_UNSUPPORTED_BROWSER =
  "macOS版Chrome最新版をご利用ください";

/** タブ共有で音声トラックが得られなかったとき */
export const ERR_AUDIO_SHARE_OFF =
  "タブ共有時に「音声を共有」をONにしてください";

/** 共有 UI でキャンセルしたとき */
export const ERR_DISPLAY_CANCELLED = "共有がキャンセルされました。";

/** サーバーに API キー等が未設定のとき */
export const ERR_SERVER_CONFIG = "サーバー設定に問題があります。";

/** OpenAI セッション・WebRTC 接続に失敗したとき */
export const ERR_OPENAI_CONNECTION =
  "文字起こしサービスへの接続に失敗しました。";

/** クリップボード書き込み失敗 */
export const ERR_COPY_FAILED =
  "コピーに失敗しました。ブラウザの権限を確認してください。";

/** ユーザーがブラウザ側で共有を終了したとき（通知） */
export const NOTICE_SHARE_ENDED = "共有が終了しました。";
