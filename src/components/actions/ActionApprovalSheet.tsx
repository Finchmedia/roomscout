import { ShieldCheck } from "lucide-react";
import { useId, useState } from "react";
import type { ActionApprovalRequest } from "../../features/agentOperations/types";
import { ActionDialog } from "../ui/ActionDialog";
import { Table, TableBody, TableCell, TableRow } from "../ui/table";

type ActionApprovalSheetProps = {
  request: ActionApprovalRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (request: ActionApprovalRequest) => Promise<void> | void;
  onReject?: (request: ActionApprovalRequest) => Promise<void> | void;
  onPauseMandate?: (mandateVersion: number) => Promise<void> | void;
};

const kindLabels: Record<ActionApprovalRequest["kind"], string> = {
  send_email: "Send email",
  submit_webform: "Submit web form",
  send_platform_dm: "Send platform message",
  create_portal_account: "Create portal account",
  publish_listing: "Publish listing",
  share_contact_details: "Share contact details",
  propose_visit_time: "Propose visit time",
};

export function ActionApprovalSheet({ request, open, onOpenChange, onApprove, onReject, onPauseMandate }: ActionApprovalSheetProps) {
  const acknowledgementId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  function changeOpen(next: boolean) {
    if (!next) setAcknowledged(false);
    if (!next) setError("");
    onOpenChange(next);
  }

  if (!request) return null;

  const standingAuthorization = request.authorization.mode === "standing_mandate" ? request.authorization : undefined;
  const needsOneTimeApproval = !standingAuthorization?.executionAllowed;

  async function approve() {
    if (!request || !acknowledged || !onApprove) return;
    setWorking(true);
    setError("");
    try {
      await onApprove(request);
      changeOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The exact action could not be approved.");
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    if (!request || !onReject) return;
    setWorking(true);
    setError("");
    try {
      await onReject(request);
      changeOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be rejected.");
    } finally {
      setWorking(false);
    }
  }

  async function pauseMandate() {
    if (!standingAuthorization || !onPauseMandate) return;
    setWorking(true);
    try {
      await onPauseMandate(standingAuthorization.mandateVersion);
      changeOpen(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <ActionDialog
      description={`${kindLabels[request.kind]} · exact payload version ${request.contentVersion}`}
      footer={needsOneTimeApproval
        ? <><button className="btn btn-g" disabled={working || !onReject} onClick={() => void reject()} type="button">Reject</button><button className="btn btn-p" disabled={!acknowledged || working || !onApprove} onClick={() => void approve()} type="button">{working ? "Saving…" : "Approve once"}</button></>
        : <><button className="btn btn-g" onClick={() => changeOpen(false)} type="button">Close</button><button className="btn btn-s" disabled={working || !onPauseMandate} onClick={() => void pauseMandate()} type="button">{working ? "Pausing…" : "Pause mandate"}</button></>}
      onOpenChange={changeOpen}
      open={open}
      title={needsOneTimeApproval ? "This step needs you" : "Handled by Autopilot"}
    >
      <div className="rs-action-approval">
        {standingAuthorization ? (
          <div className={`rs-action-authorization${standingAuthorization.executionAllowed ? " is-authorized" : ""}`}>
            <ShieldCheck aria-hidden="true" size={16} />
            <p><strong>{standingAuthorization.executionAllowed ? "Covered by Autopilot" : "Outside the current Autopilot boundary"}</strong><br />{standingAuthorization.mandateLabel} · version {standingAuthorization.mandateVersion}{standingAuthorization.executionAllowed ? " allows this non-binding action." : " does not cover this exact action, so your decision is required."}</p>
          </div>
        ) : <div className="rs-action-effect"><ShieldCheck aria-hidden="true" size={16} /><p><strong>One-time approval:</strong> nothing executes until you approve this exact destination and payload.</p></div>}
        <div className="rs-action-effect"><ShieldCheck aria-hidden="true" size={16} /><p><strong>What will happen:</strong> {request.effect}</p></div>
        <Table className="facts"><TableBody><TableRow><TableCell>Destination</TableCell><TableCell>{request.destination}</TableCell></TableRow><TableRow><TableCell>Acting as</TableCell><TableCell>{request.actingAs}</TableCell></TableRow><TableRow><TableCell>Action</TableCell><TableCell>{kindLabels[request.kind]}</TableCell></TableRow>{standingAuthorization ? <TableRow><TableCell>Authorization</TableCell><TableCell>Autopilot v{standingAuthorization.mandateVersion}</TableCell></TableRow> : <TableRow><TableCell>Authorization</TableCell><TableCell>Your decision</TableCell></TableRow>}</TableBody></Table>
        <section><span className="flabel">Exact payload</span><div className="rs-action-fields">{request.fields.map((field) => <div key={field.label}><span className="mono">{field.label}</span><p>{field.value}</p></div>)}</div></section>
        {needsOneTimeApproval ? <label className="ack" htmlFor={acknowledgementId}><input checked={acknowledged} id={acknowledgementId} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" /><span>I approve this exact destination and payload for one execution.</span></label> : null}
        {error ? <p className="rs-form-error" role="alert">{error}</p> : null}
        <p className="rs-hard-boundary-note">Autopilot never authorizes terms, contracts, bookings, payments, deposits, passwords, 2FA, or CAPTCHA.</p>
      </div>
    </ActionDialog>
  );
}
