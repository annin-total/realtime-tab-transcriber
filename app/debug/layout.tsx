/**
 * 開発用ルートの共通レイアウト（本番では debug API が 404 になる想定）
 */
export default function DebugLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        開発用デバッグ領域です。API
        キーを消費する可能性があります。信頼できる環境でのみ開いてください。
      </div>
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  );
}
