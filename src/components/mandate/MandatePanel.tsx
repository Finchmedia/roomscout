import { LockKeyhole, Settings2, ShieldCheck, Siren, Sparkles } from "lucide-react";
import { useState } from "react";
import { hardHumanActionTypes } from "../../features/agentOperations/mandatePolicy";
import type { MandateActionType, ScoutMandate, ScoutMandateStatus } from "../../features/agentOperations/types";
import { ActionDialog } from "../ui/ActionDialog";
import { LedgerCard } from "../ui/LedgerCard";

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

const defaultAutopilotActions: MandateActionType[] = [
  "send_email",
  "submit_webform",
  "send_platform_dm",
  "create_portal_account",
  "publish_listing",
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

const defaultAutopilotData = [
  "band_name",
  "reply_email",
  "availability",
  "budget",
  "music_profile",
];

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
  const autopilotOn = mandate.persisted && Boolean(mandate.version) && mandate.status === "active" && mandate.killSwitchEnabled && mandate.mode !== "guided" && mandate.mode !== "research";
  const draftAutopilotOn = draft.mode !== "guided";

  async function save() {
    if (!onSave) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave(draft);
      setOpen(false);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "The Autopilot settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: ScoutMandateStatus) {
    if (!onStatusChange) return;
    setSaving(true);
    setSaveError("");
    try {
      await onStatusChange(status);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Autopilot could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  function enableDraftAutopilot() {
    setDraft((current) => ({
      ...current,
      mode: "negotiation",
      platformAllowlist: current.platformAllowlist.length > 0
        ? current.platformAllowlist
        : platformOptions.map((platform) => platform.id),
      allowedActionTypes: current.allowedActionTypes.length > 0
        ? current.allowedActionTypes
        : defaultAutopilotActions,
      dataScopes: current.dataScopes.length > 0 ? current.dataScopes : defaultAutopilotData,
      dailyContactLimit: current.dailyContactLimit || 10,
      dailyBrowserMinutes: current.dailyBrowserMinutes || 30,
    }));
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

  function openAdvanced() {
    setDraft(mandate);
    setSaveError("");
    setOpen(true);
  }

  return (
    <>
      <LedgerCard
        accent
        header={<><span className="type t-scout">Scout Autopilot</span><span className={`pill ${autopilotOn ? "new" : ""}`}>{autopilotOn ? "On" : "Off"}</span></>}
      >
        <div className="rs-mandate-head">
          <div>
            <strong>{autopilotOn ? "RoomScout is working for you" : "Put your room search on Autopilot"}</strong>
            <p>{autopilotOn
              ? "The Scout can research, contact suitable leads, and continue non-binding conversations within your limits."
              : "Let the Scout research, contact suitable leads, and follow up without asking about every message."}</p>
          </div>
          <div className="actionsrow">
            {autopilotOn
              ? <button className="btn btn-g btn-sm" disabled={!onStatusChange || saving} onClick={() => void changeStatus("paused")} type="button">Turn off</button>
              : <button className="btn btn-p btn-sm" disabled={!onStatusChange || saving} onClick={() => void changeStatus("active")} type="button"><Sparkles aria-hidden="true" size={13} />{saving ? "Starting…" : "Turn on Autopilot"}</button>}
            <button className="btn btn-s btn-sm" onClick={openAdvanced} type="button"><Settings2 aria-hidden="true" size={13} />Advanced</button>
          </div>
        </div>
        <div className="rs-mandate-boundary"><ShieldCheck aria-hidden="true" size={15} /><span>You stay in control of the consequential decision: agreements, bookings, contracts, and money always come back to you.</span></div>
        {autopilotOn ? <div className="rs-mandate-summary"><span><b>{mandate.platformAllowlist.length}</b> platforms</span><span><b>{mandate.dailyContactLimit}</b> contacts/day</span><span>active until <b>{dateInputValue(mandate.expiresAt)}</b></span></div> : null}
        {saveError && !open ? <p className="rs-form-error" role="alert">{saveError}</p> : null}
      </LedgerCard>

      <ActionDialog
        description="Autopilot is the default. Switch to manual review or tune its exact limits here."
        footer={<><button className="btn btn-g" onClick={() => setOpen(false)} type="button">Cancel</button><button className="btn btn-p" disabled={!onSave || saving} onClick={() => void save()} type="button">{saving ? "Saving…" : "Save settings"}</button></>}
        onOpenChange={setOpen}
        open={open}
        title="Autopilot settings"
      >
        <div className="rs-mandate-editor">
          <div aria-label="Scout operating mode" className="rs-mandate-modes" role="radiogroup">
            <button aria-checked={draftAutopilotOn} className={draftAutopilotOn ? "on" : undefined} onClick={enableDraftAutopilot} role="radio" type="button">
              <strong>Autopilot</strong><span>Research, outreach, and non-binding follow-up happen automatically.</span>
            </button>
            <button aria-checked={!draftAutopilotOn} className={!draftAutopilotOn ? "on" : undefined} onClick={() => setDraft((current) => ({ ...current, mode: "guided", allowedActionTypes: [] }))} role="radio" type="button">
              <strong>Review every action</strong><span>The Scout prepares work but waits before every external action.</span>
            </button>
          </div>

          <div className="rs-mandate-boundary"><ShieldCheck aria-hidden="true" size={15} /><span>Autopilot covers only non-binding actions on reviewed sources. Any commitment, payment, credential, 2FA, or CAPTCHA stops for you.</span></div>

          <details className="rs-advanced-settings">
            <summary><Settings2 aria-hidden="true" size={14} />Advanced controls</summary>
            <div className="rs-advanced-settings__body">
              <section><span className="flabel">Goal</span><div className="mailbox">{draft.goal}</div></section>
              <section><span className="flabel">Public research scope</span><div className="mailbox">{draft.sourceAllowlist.length ? draft.sourceAllowlist.join(", ") : "Reviewed sources for this search"}</div></section>
              <section><span className="flabel">Platform allowlist</span>{platformOptions.length ? <div className="rs-mandate-actions">{platformOptions.map((platform) => <label className="ack" key={platform.id}><input checked={draft.platformAllowlist.includes(platform.id)} disabled={!draftAutopilotOn} onChange={() => toggleListValue("platformAllowlist", platform.id)} type="checkbox" /><span>{platform.label}</span></label>)}</div> : <p className="hint">Active reviewed platforms are added automatically when Autopilot starts.</p>}</section>
              <section><span className="flabel">Allowed non-binding actions</span><div className="rs-mandate-actions">{configurableActions.map((action) => <label className="ack" key={action}><input checked={draft.allowedActionTypes.includes(action)} disabled={!draftAutopilotOn} onChange={() => toggleAction(action)} type="checkbox" /><span>{actionLabels[action]}</span></label>)}</div></section>
              <section><span className="flabel">Personal data scopes</span><div className="rs-mandate-actions">{personalDataScopes.map((scope) => <label className="ack" key={scope}><input checked={draft.dataScopes.includes(scope)} disabled={!draftAutopilotOn} onChange={() => toggleListValue("dataScopes", scope)} type="checkbox" /><span>{scope.replaceAll("_", " ")}</span></label>)}</div></section>
              <div className="rs-mandate-limits">
                <label><span className="flabel">Contacts / day</span><input className="input" disabled={!draftAutopilotOn} min="0" onChange={(event) => setDraft((current) => ({ ...current, dailyContactLimit: Number(event.target.value) }))} type="number" value={draft.dailyContactLimit} /></label>
                <label><span className="flabel">Browser min / day</span><input className="input" disabled={!draftAutopilotOn} min="0" onChange={(event) => setDraft((current) => ({ ...current, dailyBrowserMinutes: Number(event.target.value) }))} type="number" value={draft.dailyBrowserMinutes} /></label>
                <label><span className="flabel">Max monthly price €</span><input className="input" disabled={!draftAutopilotOn} min="0" onChange={(event) => setDraft((current) => ({ ...current, maxMonthlyPriceEur: event.target.value ? Number(event.target.value) : undefined }))} type="number" value={draft.maxMonthlyPriceEur ?? ""} /></label>
                <label><span className="flabel">Expires</span><input className="input" disabled={!draftAutopilotOn} onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value ? new Date(`${event.target.value}T23:59:59`).getTime() : undefined }))} type="date" value={dateInputValue(draft.expiresAt)} /></label>
              </div>
              <div className="cols rs-mandate-columns">
                <section><span className="flabel">Stop conditions</span><ul>{draft.stopConditions.map((item) => <li key={item}>{item}</li>)}</ul></section>
                <section><span className="flabel">Always human</span><ul className="checks">{hardHumanActionTypes.map((action) => <li className="check" key={action}><LockKeyhole aria-hidden="true" size={13} />{actionLabels[action]}</li>)}</ul></section>
              </div>
              {mandate.status === "active" ? <button className="btn btn-g btn-sm rs-kill-button" disabled={!onStatusChange || saving} onClick={() => void changeStatus("killed")} type="button"><Siren aria-hidden="true" size={13} />Emergency stop</button> : null}
            </div>
          </details>
          {saveError ? <p className="rs-form-error" role="alert">{saveError}</p> : null}
          {!onSave ? <p className="fitline">Autopilot persistence is unavailable. Manual review remains enforced.</p> : <p className="hint">Saving creates a new immutable mandate version. Existing provider gates re-check that version immediately before execution.</p>}
        </div>
      </ActionDialog>
    </>
  );
}
