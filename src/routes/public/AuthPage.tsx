import { Bookmark, Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { PublicHeader } from "../../components/navigation/PublicHeader";
import { LedgerCard } from "../../components/ui/LedgerCard";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../../features/auth/errors";

export type AuthCredentials = { username: string; password: string };

type AuthPageProps = {
  initialMode?: "signIn" | "signUp";
  onAuthenticate?: (mode: "signIn" | "signUp", credentials: AuthCredentials) => void | Promise<void>;
  error?: string;
  pending?: boolean;
};

export function AuthPage({ initialMode, onAuthenticate, error, pending = false }: AuthPageProps) {
  const location = useLocation();
  const inferredMode = location.pathname.endsWith("sign-up") ? "signUp" : "signIn";
  const [mode, setMode] = useState(initialMode ?? inferredMode);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string>();
  const usernameId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const isSignUp = mode === "signUp";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const passwordLength = [...password].length;
    if (!username.trim()) {
      setNotice("Enter a username.");
      return;
    }
    if (passwordLength < MIN_PASSWORD_LENGTH) {
      setNotice(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (passwordLength > MAX_PASSWORD_LENGTH) {
      setNotice(`Use no more than ${MAX_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (isSignUp && password !== confirmation) {
      setNotice("The passwords do not match.");
      return;
    }
    if (!onAuthenticate) {
      setNotice("Authentication is not connected in this presentation-only route yet.");
      return;
    }
    setNotice(undefined);
    await onAuthenticate(mode, { username: username.trim(), password });
  }

  return (
    <>
      <PublicHeader />
      <main className="center rs-auth-page">
        <LedgerCard className="authcard" header={<><span className="type t-scout">{isSignUp ? "Create account" : "Sign in"}</span><span className="mono">Convex Auth v2</span></>}>
          <div className="ctx"><Bookmark aria-hidden="true" size={15} /><span>Your current search can continue after authentication.</span></div>
          <form onSubmit={submit}>
            <div className="field"><label className="flabel" htmlFor={usernameId}>Username</label><input autoComplete="username" className="input" id={usernameId} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. vierteltakt" value={username} /></div>
            <div className="field"><label className="flabel" htmlFor={passwordId}>Password</label><div className="pwrow"><input autoComplete={isSignUp ? "new-password" : "current-password"} className="input" id={passwordId} maxLength={MAX_PASSWORD_LENGTH} minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} value={password} /><button aria-label={showPassword ? "Hide password" : "Show password"} className="pwtoggle" onClick={() => setShowPassword((shown) => !shown)} type="button">{showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}</button></div><p className="hint">{MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters. No spaces at the beginning or end.</p></div>
            {isSignUp ? <div className="field"><label className="flabel" htmlFor={confirmId}>Confirm password</label><input autoComplete="new-password" className="input" id={confirmId} onChange={(event) => setConfirmation(event.target.value)} type="password" value={confirmation} /></div> : null}
            {error || notice ? <p aria-live="polite" className="err visible">{error ?? notice}</p> : null}
            <button className="btn btn-p" disabled={pending} type="submit">{pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}</button>
          </form>
          <p className="swap">
            {isSignUp ? "Already have an account? " : "New here? "}
            <button className="rs-link-button" onClick={() => { setMode(isSignUp ? "signIn" : "signUp"); setNotice(undefined); }} type="button">{isSignUp ? "Sign in" : "Create an account"}</button>
          </p>
          <Link className="mono rs-auth-page__back" to="/explore">Continue browsing without an account</Link>
        </LedgerCard>
      </main>
    </>
  );
}
