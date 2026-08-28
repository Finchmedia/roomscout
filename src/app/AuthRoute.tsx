import {
  useSignInWithPassword,
  useSignUpWithPassword,
} from "@convex-dev/auth/providers/password/react";
import { Authenticated, AuthLoading, Unauthenticated } from "@convex-dev/auth/react";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { authErrorMessage } from "../features/auth/errors";
import { AuthPage } from "../routes";
import type { AuthCredentials } from "../routes";
import { safeReturnTo } from "./returnTo";

function PasswordAuthForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string>();
  const { signIn, pending: signInPending } = useSignInWithPassword(
    api.auth.signInWithPassword,
  );
  const { signUp, pending: signUpPending } = useSignUpWithPassword(
    api.auth.signUpWithPassword,
  );

  async function authenticate(
    mode: "signIn" | "signUp",
    credentials: AuthCredentials,
  ) {
    setError(undefined);
    const result =
      mode === "signIn" ? await signIn(credentials) : await signUp(credentials);
    if (!result.success) {
      setError(authErrorMessage(result.userError));
      return;
    }
    navigate(safeReturnTo(searchParams.get("returnTo")), { replace: true });
  }

  return (
    <AuthPage
      error={error}
      onAuthenticate={authenticate}
      pending={signInPending || signUpPending}
    />
  );
}

export function AuthRoute() {
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  return (
    <>
      <AuthLoading>
        <div className="rs-route-state" role="status">Restoring your session…</div>
      </AuthLoading>
      <Authenticated>
        <Navigate replace to={returnTo} />
      </Authenticated>
      <Unauthenticated>
        <PasswordAuthForm />
      </Unauthenticated>
    </>
  );
}
