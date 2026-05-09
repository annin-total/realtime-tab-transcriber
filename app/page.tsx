import { PasscodeGate } from "@/components/PasscodeGate";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <PasscodeGate>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16 sm:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            タブ文字起こし
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            認証済みです。接続・操作の UI は次の PR で追加されます。
          </p>
        </main>
      </PasscodeGate>
    </div>
  );
}
