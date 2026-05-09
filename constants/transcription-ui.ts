import type { AppStatus } from "@/lib/types";

/** メイン画面タイトル */
export const TRANSCRIPTION_PAGE_TITLE = "リアルタイム文字起こし";

/** タブ共有・音声 ON の案内（design 8.1 に準拠） */
export const TRANSCRIPTION_INSTRUCTION =
  "Chromeタブを共有し、「音声を共有」をONにしてください。";

/** 状態ラベル見出し */
export const LABEL_STATUS_HEADING = "状態:";

/** 暫定テキスト欄の見出し */
export const LABEL_TENTATIVE = "暫定テキスト:";

/** 確定テキスト欄の見出し */
export const LABEL_FINAL = "確定（時系列）:";

/** マイク併用のチェックボックス */
export const LABEL_MIC_INCLUDE = "自分のマイク音声も含める";

/** 時系列行のソース表示（タブ経路） */
export const LABEL_SOURCE_TAB = "タブ";

/** 時系列行のソース表示（マイク経路） */
export const LABEL_SOURCE_SELF = "自分";

/** 操作ボタン文言 */
export const BTN_START = "開始";
export const BTN_STOP = "停止";
export const BTN_COPY = "コピー";
export const BTN_CLEAR = "クリア";

/** `AppStatus` を画面表示用の短い日本語へ */
export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  auth_required: "認証が必要です",
  idle: "待機中",
  requesting_display: "共有選択中",
  connecting: "接続中",
  transcribing: "文字起こし中",
  stopped: "停止済み",
  error: "エラー",
};
