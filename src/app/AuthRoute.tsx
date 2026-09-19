import {
  useSignInWithPassword,
  useSignUpWithPassword,
} from "@convex-dev/auth/providers/password/react";
import { Authenticated, AuthLoading, Unauthenticated } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { authErrorMessage } from "../features/auth/errors";
import { AuthPage } from "../routes";
import type { AuthCredentials } from "../routes";
import { useCopy } from "../ui/copy";
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
    const returnTo = safeReturnTo(searchParams.get("returnTo"));
    navigate(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  }

  return (
    <AuthPage
      error={error}
      onAuthenticate={authenticate}
      pending={signInPending || signUpPending}
    />
  );
}

function AuthenticatedDestination({ returnTo }: { returnTo: string }) {
  const { t } = useCopy();
  const user = useQuery(api.users.current);
  if (user === undefined) return <div className="rs-route-state" role="status">{t("appRoutes.restoring")}</div>;
  if (user?.role === "musician" && !user.profileCompleted) {
    return <Navigate replace to={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} />;
  }
  return <Navigate replace to={returnTo} />;
}

export function AuthRoute() {
  const { t } = useCopy();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  return (
    <>
      <AuthLoading>
        <div className="rs-route-state" role="status">{t("appRoutes.restoring")}</div>
      </AuthLoading>
      <Authenticated>
        <AuthenticatedDestination returnTo={returnTo} />
      </Authenticated>
      <Unauthenticated>
        <PasswordAuthForm />
      </Unauthenticated>
    </>
  );
}
