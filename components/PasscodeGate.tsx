"use client";

import {
  type FormEvent,
  type ReactNode,
  startTransition,
  useEffect,
  useId,
  useState,
} from "react";
import { API_PATH_AUTH, API_PATH_AUTH_ME } from "@/lib/constants";

type GateStatus = "checking" | "authenticated" | "unauthenticated";

type AuthPostResponse = {
  ok?: boolean;
  error?: string;
};

type MeResponse = {
  authenticated?: boolean;
};

/**
 * API が返す英語エラーコードをユーザー向け日本語へ寄せる
 */
function mapAuthErrorMessage(body: AuthPostResponse, status: number): string {
  const code = body.error;
  switch (code) {
    case "Invalid passcode":
      return "パスコードが正しくありません。";
    case "passcode is required":
      return "パスコードを入力してください。";
    case "Invalid JSON":
      return "入力形式が不正です。";
    case "APP_PASSCODE is not set":
    case "AUTH_SECRET is not set":
      return "サーバー設定が不完全です。管理者に連絡してください。";
    case "Failed to set session":
      return "セッションの保存に失敗しました。しばらくしてから再度お試しください。";
    default:
      break;
  }
  if (status >= 500) {
    return "サーバーエラーが発生しました。しばらくしてから再度お試しください。";
  }
  return "認証に失敗しました。入力内容を確認してください。";
}

type PasscodeGateProps = {
  children: ReactNode;
};

/**
 * マウント時に `/api/auth/me` で Cookie を検証し、
 * 未認証ならパスコードフォーム、認証済みなら children を表示する
 */
export function PasscodeGate({ children }: PasscodeGateProps) {
  const formId = useId();
  const [status, setStatus] = useState<GateStatus>("checking");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(API_PATH_AUTH_ME, {
          credentials: "same-origin",
        });
        const data = (await res.json()) as MeResponse;
        if (cancelled) return;
        startTransition(() => {
          setStatus(
            data.authenticated === true ? "authenticated" : "unauthenticated",
          );
        });
      } catch {
        if (!cancelled) {
          startTransition(() => setStatus("unauthenticated"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(API_PATH_AUTH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      let data: AuthPostResponse = {};
      try {
        data = (await res.json()) as AuthPostResponse;
      } catch {
        data = {};
      }
      if (res.ok && data.ok === true) {
        setStatus("authenticated");
        setPasscode("");
        return;
      }
      setError(mapAuthErrorMessage(data, res.status));
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください。");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "checking") {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">認証状態を確認しています…</p>
      </div>
    );
  }

  if (status === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          パスコード認証
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          利用を続けるには、共有されたパスコードを入力してください。
        </p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={formId}
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              パスコード
            </label>
            <input
              id={formId}
              name="passcode"
              type="password"
              autoComplete="current-password"
              required
              value={passcode}
              onChange={(ev) => setPasscode(ev.target.value)}
              disabled={submitting}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:ring-zinc-500"
            />
          </div>
          {error ? (
            <p
              className="text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? "送信中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
