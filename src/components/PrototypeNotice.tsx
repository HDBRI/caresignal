import { InfoIcon } from "./icons";

export const PROTOTYPE_LIMITATION =
  "CareSignal is a classroom prototype. It uses synthetic (fictional) data only, is not medical advice, is not a validated clinical triage system, and is not connected to any real clinical system or care team.";

export function PrototypeNotice() {
  return (
    <aside className="prototype-notice" aria-label="Prototype limitations">
      <InfoIcon size={18} />
      <p>
        <strong>Classroom prototype · synthetic data only.</strong> Not medical advice, not a validated
        clinical triage system, and not connected to any real clinical system or care team. In an emergency,
        call 911.
      </p>
    </aside>
  );
}
