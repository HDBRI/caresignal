import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function code(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Unique, human-readable handoff ID shown to users and stored with the receipt. */
export const newHandoffDisplayId = () => `HO-${code(8)}`;

/** Receipt ID returned by the simulated receiver once it has saved a payload. */
export const newReceiptCode = () => `RC-${code(10)}`;

/** Patient reference for a user-created fictional case. */
export const newUserPatientRef = () => `PAT-USER-${code(6)}`;

/** Display ID for an observation added during a session: OBS-0001, OBS-0002, ... per case. */
export const sessionObservationDisplayId = (n: number) => `OBS-${String(n).padStart(4, "0")}`;
