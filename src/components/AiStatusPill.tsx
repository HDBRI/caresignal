import { AlertIcon, SparkIcon } from "./icons";
import type { AiStatus } from "@/lib/ai/client";

/** Honest AI availability. "Configured" means a key is present — not that a call has succeeded. */
export function AiStatusPill({ status }: { status: AiStatus }) {
  if (status === "available") {
    return (
      <span className="pill pill-calm">
        <SparkIcon size={14} />
        AI configured · gpt-6-luna
      </span>
    );
  }
  return (
    <span className="pill pill-unknown">
      <AlertIcon size={14} />
      AI analysis unavailable — safety rules and note-taking still work
    </span>
  );
}
