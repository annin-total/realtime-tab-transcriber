import {
  LABEL_SOURCE_SELF,
  LABEL_SOURCE_TAB,
} from "@/constants/transcription-ui";
import type { TranscriptLine } from "./types";

/** 暫定・確定をクリップボード用テキストに整形する */
export function buildClipboardText(
  lines: TranscriptLine[],
  partialTab: string,
  partialMic: string,
): string {
  const parts: string[] = [];
  if (partialTab.trim()) {
    parts.push(`【暫定・${LABEL_SOURCE_TAB}】\n${partialTab}`);
  }
  if (partialMic.trim()) {
    parts.push(`【暫定・${LABEL_SOURCE_SELF}】\n${partialMic}`);
  }
  const confirmed = lines
    .map((line) => {
      const tag = line.source === "tab" ? LABEL_SOURCE_TAB : LABEL_SOURCE_SELF;
      return `【${tag}】\n${line.text}`;
    })
    .join("\n\n");
  if (confirmed.trim()) {
    parts.push(`【確定】\n${confirmed}`);
  }
  return parts.join("\n\n");
}
