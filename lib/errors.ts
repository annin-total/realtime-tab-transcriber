/**
 * エラー方針:
 * - ユーザー向け表示は {@link toPublicErrorMessage} に集約し、意図した文言だけを返す
 * - {@link AppError} は HTTP ステータスと機械可読 code を添えて Route Handler 等で投げる
 * - 想定外の値は詳細を隠して汎用メッセージに落とす
 */

const GENERIC_MESSAGE = "予期しないエラーが発生しました";

/** アプリ内で区別可能な業務エラー */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** 値が {@link AppError} かどうかを判定する */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * UI やクライアント向け JSON に載せる安全なメッセージへ正規化する
 */
export function toPublicErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  return GENERIC_MESSAGE;
}
