/** メイン画面の接続・認証などの粗い状態 */
export type AppStatus =
  | "auth_required"
  | "idle"
  | "requesting_display"
  | "connecting"
  | "transcribing"
  | "stopped"
  | "error";

/** localStorage に永続化する文字起こしキャッシュの形 */
export type TranscriptCache = {
  text: string;
  savedAt: number;
};

/** Realtime から受け取る文字起こしイベントの判別可能な形 */
export type TranscriptEvent =
  | { type: "delta"; text: string }
  | { type: "completed"; text: string };
