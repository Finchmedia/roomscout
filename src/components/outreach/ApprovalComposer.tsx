import { useId, useState } from "react";
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
  onApprove?: (payload: ApprovalPayload) => void;
};

const defaultSubject = "Rehearsal-room availability for a four-piece band";
const defaultMessage = `Hi,

we're a four-piece band from Stuttgart looking for a permanent rehearsal room. Your listing caught our eye because the area and arrangement could work well for us.

Could you tell us whether drums are workable and whether secure overnight storage is included?

Thanks!
Vera · vierteltakt`;

export function ApprovalComposer({
  open,
  onOpenChange,
  signal,
  search,
  onApprove,
}: ApprovalComposerProps) {
  const subjectId = useId();
  const messageId = useId();
  const [approved, setApproved] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setApproved(false);
    onOpenChange(nextOpen);
  }

  function handleApprove() {
    if (!approved) return;
    onApprove?.({
      recipient: "Klangraum West <contact@room-owner.example>",
      subject,
      message,
    });
  }

  return (
    <ActionDialog
      description={`Linked to “${search.title}” and “${signal.title}”`}
      footer={
        <>
          <button className="btn btn-g" onClick={() => handleOpenChange(false)} type="button">Cancel</button>
          <button className="btn btn-p" disabled={!approved} onClick={handleApprove} type="button">Approve exact message</button>
        </>
      }
      onOpenChange={handleOpenChange}
      open={open}
      title="Review & approve inquiry"
    >
      <div className="rs-approval-form">
        <div>
          <span className="flabel">To</span>
          <div className="mailbox">Klangraum West &lt;contact@room-owner.example&gt; · prototype recipient</div>
        </div>
        <div>
          <label className="flabel" htmlFor={subjectId}>Subject</label>
          <input className="input" id={subjectId} onChange={(event) => setSubject(event.target.value)} value={subject} />
        </div>
        <div>
          <label className="flabel" htmlFor={messageId}>Message</label>
          <textarea className="input" id={messageId} onChange={(event) => setMessage(event.target.value)} rows={9} value={message} />
          <p className="mono">Scout assumption: asking about drums and storage. Edit freely.</p>
        </div>
        <label className="ack">
          <input checked={approved} onChange={(event) => setApproved(event.target.checked)} type="checkbox" />
          <span>I approve this exact recipient, subject, and message. RoomScout may send this version once.</span>
        </label>
      </div>
    </ActionDialog>
  );
}
