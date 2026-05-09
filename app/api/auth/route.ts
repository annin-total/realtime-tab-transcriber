import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  createSignedSessionCookieValue,
} from "@/lib/auth";

type AuthBody = {
  passcode?: unknown;
};

/**
 * パスコード検証後、署名付き HttpOnly Cookie を発行する
 */
export async function POST(request: Request) {
  let body: AuthBody;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const passcode = body.passcode;
  if (typeof passcode !== "string") {
    return NextResponse.json(
      { ok: false, error: "passcode is required" },
      { status: 400 },
    );
  }

  if (!process.env.APP_PASSCODE) {
    return NextResponse.json(
      { ok: false, error: "APP_PASSCODE is not set" },
      { status: 500 },
    );
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.json(
      { ok: false, error: "AUTH_SECRET is not set" },
      { status: 500 },
    );
  }

  if (passcode !== process.env.APP_PASSCODE) {
    return NextResponse.json(
      { ok: false, error: "Invalid passcode" },
      { status: 401 },
    );
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(
      AUTH_COOKIE_NAME,
      createSignedSessionCookieValue(),
      authCookieOptions,
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to set session" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
