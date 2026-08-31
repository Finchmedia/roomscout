import { Check, Clipboard, ExternalLink, Handshake, HelpCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { Opportunity } from "../../features/agentOperations/types";
import { ActionDialog } from "../ui/ActionDialog";
import { LedgerCard } from "../ui/LedgerCard";

type OpportunityHandoffProps = {
  opportunity: Opportunity;
  onMarkHandedOff?: (opportunityId: string) => Promise<void> | void;
};

function briefFor(opportunity: Opportunity): string {
  return [
    opportunity.title,
    `Counterparty: ${opportunity.counterparty}`,
    "",
    "Confirmed:",
    ...opportunity.confirmed.map((item) => `- ${item}`),
    "",
    "Still unresolved:",
    ...opportunity.unresolved.map((item) => `- ${item}`),
    "",
    `Recommended next step: ${opportunity.recommendedNextStep}`,
    "",
    "RoomScout has not accepted any agreement.",
  ].join("\n");
}

export function OpportunityHandoff({ opportunity, onMarkHandedOff }: OpportunityHandoffProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyBrief() {
    await navigator.clipboard.writeText(briefFor(opportunity));
    setCopied(true);
  }

  return (
    <>
      <LedgerCard accent header={<><span className="type t-scout">Opportunity ready for handoff</span><span className="mono">{opportunity.status.replaceAll("_", " ")}</span></>}>
        <h2 className="ltitle">{opportunity.title}</h2>
        <p>{opportunity.counterparty}</p>
        <div className="rs-opportunity-columns">
          <section><span className="flabel">Confirmed</span><ul className="checks">{opportunity.confirmed.map((item) => <li className="check" key={item}><Check aria-hidden="true" size={13} />{item}</li>)}</ul></section>
          <section><span className="flabel">Still unresolved</span><ul className="checks">{opportunity.unresolved.map((item) => <li className="check" key={item}><HelpCircle aria-hidden="true" size={13} />{item}</li>)}</ul></section>
        </div>
        <p className="fitline">{opportunity.recommendedNextStep}</p>
        <div className="actionsrow"><button className="btn btn-p btn-sm" onClick={() => setOpen(true)} type="button"><Handshake aria-hidden="true" size={14} />Prepare handoff</button></div>
      </LedgerCard>

      <ActionDialog
        description="A structured summary for the human next step. This is not an accepted agreement."
        footer={<><button className="btn btn-g" onClick={() => setOpen(false)} type="button">Close</button><button className="btn btn-s" onClick={() => void copyBrief()} type="button"><Clipboard aria-hidden="true" size={14} />{copied ? "Copied" : "Copy brief"}</button><button className="btn btn-p" disabled={!onMarkHandedOff} onClick={() => void onMarkHandedOff?.(opportunity.id)} type="button">Mark handed off</button></>}
        onOpenChange={setOpen}
        open={open}
        title="Human agreement handoff"
      >
        <div className="rs-handoff-sheet">
          <div className="rs-handoff-warning"><ShieldAlert aria-hidden="true" size={16} /><p>RoomScout has not accepted, signed, booked, or paid for anything. Review the counterparty and all unresolved terms yourself.</p></div>
          <pre>{briefFor(opportunity)}</pre>
          {opportunity.sourceLinks?.length ? <div className="actionsrow">{opportunity.sourceLinks.map((link) => <a className="btn btn-s btn-sm" href={link.url} key={link.url} rel="noreferrer" target="_blank">{link.label}<ExternalLink aria-hidden="true" size={12} /></a>)}</div> : null}
          {!onMarkHandedOff ? <p className="hint">Persisted handoff state is not available yet; copying the brief is safe and local.</p> : null}
        </div>
      </ActionDialog>
    </>
  );
}
