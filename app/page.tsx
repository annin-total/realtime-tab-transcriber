import { PasscodeGate } from "@/components/PasscodeGate";
import { TranscriptionPanel } from "@/components/TranscriptionPanel";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <PasscodeGate>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-12 sm:px-8 sm:py-16">
          <TranscriptionPanel />
        </main>
      </PasscodeGate>
    </div>
  );
}
