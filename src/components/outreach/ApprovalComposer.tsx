import { useMutation, useQuery } from "convex/react";
import { useId, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MarketSignal, SavedSearch } from "../../mocks/demoData";
import { ActionDialog } from "../ui/ActionDialog";

export type ApprovalPayload = {
  recipient: string;
  subject: string;
  message: string;
};

type ApprovalComposerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal: MarketSignal;
  search: SavedSearch;
  draftId?: Id<"outreachDrafts">;
  onApprove?: (payload: ApprovalPayload) => void;
};

export function ApprovalComposer({
  open,
  onOpenChange,
  signal,
  search,
  draftId,
  onApprove,
}: ApprovalComposerProps) {
  const subjectId = useId();
  const messageId = useId();
  const [approved, setApproved] = useState(false);
  const [subjectOverride, setSubjectOverride] = useState<string>();
  const [messageOverride, setMessageOverride] = useState<string>();
  const [working, setWorking] = useState(false);
  const [flowMessage, setFlowMessage] = useState("");
  const drafts = useQuery(api.outreach.listMine, { limit: 50 });
  const matchingDraft = drafts?.find((draft) =>
    draft.signalId === signal.id &&
    draft.savedNeedId === search.id &&
    (draft.status === "drafted" || draft.status === "awaiting_approval" || draft.status === "approved"),
  );
  const resolvedDraftId = draftId ?? matchingDraft?._id;
  const liveDraft = useQuery(api.outreach.getMine, resolvedDraftId ? { draftId: resolvedDraftId } : "skip");
  const mailbox = useQuery(api.mailboxes.getMine);
  const updateDraft = useMutation(api.outreach.updateDraft);
  const submitForApproval = useMutation(api.outreach.submitForApproval);
  const decide = useMutation(api.outreach.decide);
  const sendApproved = useMutation(api.outreach.sendApproved);

  const subject = subjectOverride ?? liveDraft?.draft.subject ?? "";
  const message = messageOverride ?? liveDraft?.draft.body ?? "";

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setApproved(false);
      setSubjectOverride(undefined);
      setMessageOverride(undefined);
      setFlowMessage("");
    }
    onOpenChange(nextOpen);
  }

  async function handleApprove() {
    if (!approved) return;
    if (!liveDraft) {
      setFlowMessage("The Scout has not produced a sendable draft with a recipient yet.");
      return;
    }
    setWorking(true);
    setFlowMessage("");
    const { draft } = liveDraft;
    try {
      if (subject !== draft.subject || message !== draft.body) {
        await updateDraft({
          draftId: draft._id,
          recipientName: draft.recipientName,
          recipientEmail: draft.recipientEmail,
          subject,
          body: message,
        });
        setApproved(false);
        setFlowMessage("Changes saved. Review the refreshed version, then approve it.");
        return;
      }
      if (draft.status === "drafted") {
        await submitForApproval({ draftId: draft._id });
        setApproved(false);
        setFlowMessage("The exact message is ready. Confirm it once more to approve and send.");
        return;
      }
      if (draft.status === "awaiting_approval") {
        await decide({
          draftId: draft._id,
          decision: "approved",
          expectedContentVersion: draft.contentVersion,
          expectedContentHash: draft.contentHash,
          expectedRecipientEmail: draft.recipientEmail,
          expectedSubject: draft.subject,
          expectedBody: draft.body,
        });
        await sendApproved({ draftId: draft._id });
      } else if (draft.status === "approved") {
        await sendApproved({ draftId: draft._id });
      } else {
        throw new Error(`This draft cannot be sent while it is ${draft.status.replace("_", " ")}.`);
      }
      onApprove?.({ recipient: draft.recipientEmail, subject: draft.subject, message: draft.body });
      handleOpenChange(false);
    } catch (error) {
      setFlowMessage(error instanceof Error ? error.message : "The draft could not be approved.");
    } finally {
      setWorking(false);
    }
  }

  const recipient = liveDraft?.draft.recipientEmail;
  const recipientName = liveDraft?.draft.recipientName;
  const buttonLabel = working
    ? "Working…"
    : liveDraft?.draft.status === "drafted"
      ? "Lock exact version for review"
      : liveDraft?.draft.status === "awaiting_approval"
        ? "Approve & send once"
        : liveDraft?.draft.status === "approved"
          ? "Send approved message"
          : "Approve exact message";

  return (
    <ActionDialog
      description={`Linked to “${search.title}” and “${signal.title}”${liveDraft ? ` · version ${liveDraft.draft.contentVersion}` : ""}`}
      footer={
        <>
          <button className="btn btn-g" onClick={() => handleOpenChange(false)} type="button">Cancel</button>
          <button className="btn btn-p" disabled={!approved || working || !liveDraft} onClick={() => void handleApprove()} type="button">{buttonLabel}</button>
        </>
      }
      onOpenChange={handleOpenChange}
      open={open}
      title="Manual send review"
    >
      <div className="rs-approval-form">
        <div>
          <span className="flabel">From</span>
          <div className="mailbox">{mailbox?.emailAddress ?? "Your AgentMail inbox is being prepared"}</div>
        </div>
        <div>
          <span className="flabel">To</span>
          <div className="mailbox">{liveDraft ? <>{recipientName} &lt;{recipient}&gt;</> : "Waiting for the persisted draft and recipient…"}</div>
        </div>
        <div>
          <label className="flabel" htmlFor={subjectId}>Subject</label>
          <input className="input" id={subjectId} onChange={(event) => setSubjectOverride(event.target.value)} value={subject} />
        </div>
        <div>
          <label className="flabel" htmlFor={messageId}>Message</label>
          <textarea className="input" id={messageId} onChange={(event) => setMessageOverride(event.target.value)} rows={9} value={message} />
          <p className="mono">This fallback lets you review wording when a source is not covered by Autopilot.</p>
        </div>
        <label className="ack">
          <input checked={approved} onChange={(event) => setApproved(event.target.checked)} type="checkbox" />
          <span>I approve this exact recipient, subject, and message. RoomScout may send this version once.</span>
        </label>
        {flowMessage ? <p className="rs-form-error" role="status">{flowMessage}</p> : null}
      </div>
    </ActionDialog>
  );
}
