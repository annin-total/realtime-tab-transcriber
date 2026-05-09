import { LABEL_MIC_INCLUDE } from "@/constants/transcription-ui";

type MicToggleProps = {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

/** 開始前にマイク音声を Realtime に送るかどうかを選ぶ */
export function MicToggle({ checked, disabled, onChange }: MicToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        className="size-4 rounded border-zinc-300 text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-900"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{LABEL_MIC_INCLUDE}</span>
    </label>
  );
}
