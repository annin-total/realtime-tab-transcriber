import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthValue } from "@/lib/auth";

/**
 * 現在の Cookie が有効な署名付きセッションかどうかを返す
 */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const authenticated = verifyAuthValue(raw);

  return NextResponse.json({ authenticated });
}
