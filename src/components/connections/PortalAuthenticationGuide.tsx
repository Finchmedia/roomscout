import { Clipboard, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import styles from "./PortalAuthenticationGuide.module.css";

type PortalAuthenticationGuideProps = {
  portalName: string;
  mailboxAddress?: string;
  mailboxWorking?: boolean;
  liveViewOpen: boolean;
  signedInConfirmed: boolean;
  onSignedInConfirmedChange: (confirmed: boolean) => void;
  onEnsureMailbox?: () => void;
};

export function PortalAuthenticationGuide({
  portalName,
  mailboxAddress,
  mailboxWorking = false,
  liveViewOpen,
  signedInConfirmed,
  onSignedInConfirmedChange,
  onEnsureMailbox,
}: PortalAuthenticationGuideProps) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!mailboxAddress) return;
    await navigator.clipboard.writeText(mailboxAddress);
    setCopied(true);
  }

  return (
    <section aria-label="Portal login instructions" className={styles.guide}>
      <div className={styles.head}>
        <ShieldCheck aria-hidden="true" size={17} />
        <div>
          <strong>You control this one-time {portalName} setup</strong>
          <p>The Live View is a direct window into an isolated Browserbase session. Type passwords, OTPs and 2FA only there. RoomScout does not ask for, receive or store them, and Browserbase CAPTCHA solving is disabled.</p>
        </div>
      </div>

      <ol className={styles.steps}>
        <li>Open Live View, then log in—or create the portal account yourself.</li>
        <li>Complete email verification, 2FA or CAPTCHA manually if the site requires it.</li>
        <li>Once the portal visibly shows you as signed in, confirm below and return control.</li>
      </ol>

      <div className={styles.mail}>
        <div>
          <strong>{mailboxAddress ?? "RoomScout registration address not created"}</strong>
          <p><Mail aria-hidden="true" size={12} /> Use this email for a new portal account so confirmation and future replies reach your RoomScout inbox.</p>
        </div>
        {mailboxAddress ? (
          <button className="btn btn-s btn-sm" onClick={() => void copyAddress()} type="button"><Clipboard aria-hidden="true" size={13} />{copied ? "Copied" : "Copy address"}</button>
        ) : (
          <button className="btn btn-s btn-sm" disabled={!onEnsureMailbox || mailboxWorking} onClick={onEnsureMailbox} type="button"><Mail aria-hidden="true" size={13} />{mailboxWorking ? "Creating…" : "Create address"}</button>
        )}
      </div>

      <label className={styles.check}>
        <input checked={signedInConfirmed} disabled={!liveViewOpen} onChange={(event) => onSignedInConfirmedChange(event.target.checked)} type="checkbox" />
        <span><strong>I can see that {portalName} is signed in</strong><br />This confirmation saves the authenticated Context for later approved runs. It does not authorize RoomScout to send messages, accept terms, book, or pay.</span>
      </label>
      {!liveViewOpen ? <p className="hint"><KeyRound aria-hidden="true" size={12} /> Open the Live View before confirming the portal session.</p> : null}
    </section>
  );
}
