import crypto from "node:crypto";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
} from "./constants";

/** Cookie に埋め込むペイロード（署名対象）。値が一致し署名が有効ならセッション有効とみなす */
const SESSION_PAYLOAD = "ok";

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return secret;
}

function getSecret(): string | undefined {
  return process.env.AUTH_SECRET;
}

/**
 * サーバー側のみで生成する署名付き Cookie 値
 * @param value 署名対象の文字列（通常は {@link SESSION_PAYLOAD}）
 */
export function signAuthValue(value: string): string {
  const secret = requireSecret();
  const sig = crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex");

  return `${value}.${sig}`;
}

/**
 * Cookie に保存された署名付き文字列を検証する
 * @param signedValue `value.signature` 形式（signature は hex）
 */
export function verifyAuthValue(signedValue?: string | null): boolean {
  if (!signedValue) {
    return false;
  }
  const secret = getSecret();
  if (!secret) {
    return false;
  }

  const lastDot = signedValue.lastIndexOf(".");
  if (lastDot <= 0) {
    return false;
  }
  const value = signedValue.slice(0, lastDot);
  const sig = signedValue.slice(lastDot + 1);
  if (value !== SESSION_PAYLOAD || !sig) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex");

  if (sig.length !== expected.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

/** 認証成功時にセットする Cookie の共通属性 */
export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
};

/** ログイン POST で Cookie に保存する値（ペイロード + HMAC） */
export function createSignedSessionCookieValue(): string {
  return signAuthValue(SESSION_PAYLOAD);
}

export { AUTH_COOKIE_NAME };
