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

/** 文字起こし入力経路（タブ共有 vs マイク） */
export type TranscriptSource = "tab" | "mic";

/** 時系列表示用の確定 1 行 */
export type TranscriptLine = {
  id: string;
  source: TranscriptSource;
  text: string;
  createdAt: number;
};

/** 確定行配列の localStorage キャッシュ形 */
export type TranscriptLinesCache = {
  lines: TranscriptLine[];
  savedAt: number;
};

/** IndexedDB に保存する文字起こし履歴 1 件（開始〜停止の 1 回分） */
export type HistoryEntry = {
  id: string;
  startedAt: number;
  /** 最後に確定行を保存した時刻。保持期限の判定に使う */
  updatedAt: number;
  lines: TranscriptLine[];
};

/** Realtime から受け取る文字起こしイベントの判別可能な形 */
export type TranscriptEvent =
  | { type: "delta"; text: string }
  | { type: "completed"; text: string };
