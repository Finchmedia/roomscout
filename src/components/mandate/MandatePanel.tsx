import { LockKeyhole, Pencil, ShieldCheck, Siren } from "lucide-react";
import { useState } from "react";
import { hardHumanActionTypes } from "../../features/agentOperations/mandatePolicy";
import type { MandateActionType, ScoutMandate, ScoutMandateMode, ScoutMandateStatus } from "../../features/agentOperations/types";
import { ActionDialog } from "../ui/ActionDialog";
import { LedgerCard } from "../ui/LedgerCard";

const modeCopy: Record<ScoutMandateMode, { label: string; description: string }> = {
  guided: { label: "Approve", description: "Scout prepares the next step. Every external communication requires exact one-time approval." },
  research: { label: "Research", description: "Scout may browse allowlisted sources, read connected messages, and extract facts. It cannot communicate." },
  outreach: { label: "YOLO outreach", description: "A persisted mandate may execute only listed, non-binding communication within its limits." },
  negotiation: { label: "YOLO negotiation", description: "Scout may continue non-binding negotiation, but any agreement, booking, contract, or payment returns to exact approval." },
};

const actionLabels: Record<MandateActionType, string> = {
  browse_public: "Browse public sources",
  browse_connected: "Browse connected portals",
  read_messages: "Read connected messages",
  extract_facts: "Extract and compare facts",
  send_email: "Send email",
  submit_webform: "Submit web form",
  send_platform_dm: "Send platform message",
  create_portal_account: "Create a portal account",
  publish_listing: "Publish a search listing",
  share_contact_details: "Share contact details",
  propose_visit: "Propose a visit time",
  accept_terms: "Accept terms",
  accept_contract: "Accept or sign a contract",
  confirm_booking: "Confirm a booking",
  make_payment: "Make a payment",
  pay_deposit: "Pay a deposit",
  enter_password: "Enter a password",
  complete_2fa: "Complete two-factor authentication",
  solve_captcha: "Solve a CAPTCHA",
};

const configurableActions: MandateActionType[] = [
  "send_email",
  "submit_webform",
  "send_platform_dm",
  "create_portal_account",
  "publish_listing",
  "share_contact_details",
  "propose_visit",
];

const personalDataScopes = [
  "band_name",
  "member_first_names",
  "reply_email",
  "phone",
  "precise_location",
  "availability",
  "budget",
  "music_profile",
] as const;

type MandatePanelProps = {
  mandate: ScoutMandate;
  platformOptions?: Array<{ id: string; label: string }>;
  onSave?: (mandate: ScoutMandate) => Promise<void> | void;
  onStatusChange?: (status: ScoutMandateStatus) => Promise<void> | void;
};

function dateInputValue(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

export function MandatePanel({ mandate, platformOptions = [], onSave, onStatusChange }: MandatePanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(mandate);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const mandateIsExecutable = mandate.persisted && Boolean(mandate.version) && mandate.status === "active" && mandate.killSwitchEnabled;

  async function save() {
    if (!onSave) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave(draft);
      setOpen(false);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "The mandate could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: ScoutMandateStatus) {
    if (!onStatusChange) return;
    setSaving(true);
    try {
      await onStatusChange(status);
    } finally {
      setSaving(false);
    }
  }

  function toggleAction(action: MandateActionType) {
    setDraft((current) => ({
      ...current,
      allowedActionTypes: current.allowedActionTypes.includes(action)
        ? current.allowedActionTypes.filter((candidate) => candidate !== action)
        : [...current.allowedActionTypes, action],
    }));
  }

  function toggleListValue(key: "platformAllowlist" | "dataScopes", value: string) {
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((candidate) => candidate !== value)
        : [...current[key], value],
    }));
  }

  return (
    <>
      <LedgerCard
        accent
        header={<><span className="type t-scout">Scout mandate</span><span className={`pill ${mandateIsExecutable ? "new" : mandate.status === "killed" ? "warn" : ""}`}>{mandate.status} · {mandate.persisted ? `v${mandate.version ?? "—"}` : "not persisted"}</span></>}
      >
        <div className="rs-mandate-head">
          <div><strong>{modeCopy[mandate.mode].label}</strong><p>{modeCopy[mandate.mode].description}</p></div>
          <button className="btn btn-s btn-sm" onClick={() => { setDraft(mandate); setOpen(true); }} type="button"><Pencil aria-hidden="true" size={13} />Review mandate</button>
        </div>
        <div className="rs-mandate-summary">
          <span><b>{mandate.sourceAllowlist.length}</b> sources</span><span><b>{mandate.platformAllowlist.length}</b> platforms</span><span><b>{mandate.dailyContactLimit}</b> contacts/day</span><span><b>{mandate.dailyBrowserMinutes}</b> browser min/day</span>
        </div>
        <div className="rs-mandate-boundary"><ShieldCheck aria-hidden="true" size={15} /><span>Approve checks every exact message. YOLO may cover only listed, non-binding communication under an active, versioned mandate. Agreements, contracts, bookings, payments, deposits, passwords, 2FA and CAPTCHA always return to you.</span></div>
        <div className="actionsrow rs-mandate-controls">
          {mandate.status === "active" ? <button className="btn btn-g btn-sm" disabled={!onStatusChange || saving} onClick={() => void changeStatus("paused")} type="button">Revoke mandate</button> : null}
          <button className="btn btn-g btn-sm rs-kill-button" disabled={!onStatusChange || saving || mandate.status === "killed"} onClick={() => void changeStatus("killed")} type="button"><Siren aria-hidden="true" size={13} />Kill switch</button>
        </div>
      </LedgerCard>

      <ActionDialog
        description="YOLO authorizes only the listed non-binding actions and limits. Binding commitments and hard human boundaries cannot be delegated."
        footer={<><button className="btn btn-g" onClick={() => setOpen(false)} type="button">Cancel</button><button className="btn btn-p" disabled={!onSave || saving} onClick={() => void save()} type="button">{saving ? "Activating…" : onSave ? "Save and activate new version" : "Persistence not available"}</button></>}
        onOpenChange={setOpen}
        open={open}
        title="Review Scout mandate"
      >
        <div className="rs-mandate-editor">
          <div aria-label="Scout mode" className="rs-mandate-modes" role="radiogroup">
            {(Object.keys(modeCopy) as ScoutMandateMode[]).map((mode) => (
              <button aria-checked={draft.mode === mode} className={draft.mode === mode ? "on" : undefined} key={mode} onClick={() => setDraft((current) => ({ ...current, mode, allowedActionTypes: mode === "guided" || mode === "research" ? [] : current.allowedActionTypes }))} role="radio" type="button">
                <strong>{modeCopy[mode].label}</strong><span>{modeCopy[mode].description}</span>
              </button>
            ))}
          </div>
          <section><span className="flabel">Goal</span><div className="mailbox">{draft.goal}</div></section>
          <section><span className="flabel">Public research scope</span><div className="mailbox">{draft.sourceAllowlist.length ? draft.sourceAllowlist.join(", ") : "Reviewed sources for this search"}</div></section>
          <section><span className="flabel">Platform allowlist</span>{platformOptions.length ? <div className="rs-mandate-actions">{platformOptions.map((platform) => <label className="ack" key={platform.id}><input checked={draft.platformAllowlist.includes(platform.id)} onChange={() => toggleListValue("platformAllowlist", platform.id)} type="checkbox" /><span>{platform.label}</span></label>)}</div> : <p className="hint">No reviewed platforms are currently mapped to this search.</p>}</section>
          <section><span className="flabel">Allowed action types</span><div className="rs-mandate-actions">{configurableActions.map((action) => <label className="ack" key={action}><input checked={draft.allowedActionTypes.includes(action)} onChange={() => toggleAction(action)} type="checkbox" /><span>{actionLabels[action]}</span></label>)}</div></section>
          <section><span className="flabel">Personal data scopes</span><div className="rs-mandate-actions">{personalDataScopes.map((scope) => <label className="ack" key={scope}><input checked={draft.dataScopes.includes(scope)} onChange={() => toggleListValue("dataScopes", scope)} type="checkbox" /><span>{scope.replaceAll("_", " ")}</span></label>)}</div></section>
          <div className="rs-mandate-limits">
            <label><span className="flabel">Contacts / day</span><input className="input" min="0" onChange={(event) => setDraft((current) => ({ ...current, dailyContactLimit: Number(event.target.value) }))} type="number" value={draft.dailyContactLimit} /></label>
            <label><span className="flabel">Browser min / day</span><input className="input" min="0" onChange={(event) => setDraft((current) => ({ ...current, dailyBrowserMinutes: Number(event.target.value) }))} type="number" value={draft.dailyBrowserMinutes} /></label>
            <label><span className="flabel">Max monthly price €</span><input className="input" min="0" onChange={(event) => setDraft((current) => ({ ...current, maxMonthlyPriceEur: event.target.value ? Number(event.target.value) : undefined }))} type="number" value={draft.maxMonthlyPriceEur ?? ""} /></label>
            <label><span className="flabel">Expires</span><input className="input" onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value ? new Date(`${event.target.value}T23:59:59`).getTime() : undefined }))} type="date" value={dateInputValue(draft.expiresAt)} /></label>
          </div>
          <div className="cols rs-mandate-columns">
            <section><span className="flabel">Stop conditions</span><ul>{draft.stopConditions.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><span className="flabel">Always human</span><ul className="checks">{hardHumanActionTypes.map((action) => <li className="check" key={action}><LockKeyhole aria-hidden="true" size={13} />{actionLabels[action]}</li>)}</ul></section>
          </div>
          {saveError ? <p className="rs-form-error" role="alert">{saveError}</p> : null}
          {!onSave ? <p className="fitline">Mandate persistence is unavailable. Guided approval remains enforced.</p> : <p className="hint">Saving creates an immutable version and activates it only after its exact server-generated content hash is checked.</p>}
        </div>
      </ActionDialog>
    </>
  );
}
