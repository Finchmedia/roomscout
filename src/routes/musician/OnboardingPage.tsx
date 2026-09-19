import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { MusicianProfileForm, type MusicianProfileDraft } from "../../components/profile/MusicianProfileForm";
import { Card } from "../../components/ui/card";
import { AppHeader } from "../../ui/chrome/AppHeader";
import { StageBackground } from "../../ui/chrome/StageBackground";
import { useCopy } from "../../ui/copy";
import { PageLead, PageTitle } from "../../ui/settings/primitives";
import { safeReturnTo } from "../../app/returnTo";

export function OnboardingPage() {
  const { t } = useCopy();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const user = useQuery(api.users.current);
  const saveProfile = useMutation(api.musicianProfile.saveMine);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (user === undefined) return <StageBackground position="fixed"><div className="rs-route-state" role="status">{t("appRoutes.onboarding.loading")}</div></StageBackground>;
  if (user === null) return <Navigate replace to={`/sign-in?returnTo=${encodeURIComponent(`/onboarding?returnTo=${returnTo}`)}`} />;
  if (user.role === "operator" || user.profileCompleted) return <Navigate replace to={returnTo} />;

  async function submit(profile: MusicianProfileDraft) {
    setSaving(true); setError("");
    try {
      await saveProfile(profile);
      navigate(returnTo, { replace: true });
      return true;
    } catch {
      setError(t("appRoutes.onboarding.error"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return <StageBackground position="fixed" className="font-sans text-rs-ink">
    <AppHeader initials="RS" avatarLabel="RoomScout" />
    <main className="relative z-2 mx-auto flex min-h-dvh w-full max-w-3xl items-center px-[var(--space-9)] py-[var(--space-16)]">
      <Card size="lg" tone="panel" className="w-full p-[var(--space-13)] max-[680px]:p-[var(--space-9)]">
        <div className="mb-[var(--space-11)]"><div className="text-[length:var(--text-overline-size)] uppercase tracking-[var(--text-overline-tracking)] text-rs-orange">{t("appRoutes.onboarding.eyebrow")}</div><PageTitle>{t("appRoutes.onboarding.title")}</PageTitle><PageLead>{t("appRoutes.onboarding.lead")}</PageLead></div>
        <MusicianProfileForm submitLabel={t("appRoutes.onboarding.save")} submitting={saving} onSubmit={submit} />
        {error ? <p className="mt-[var(--space-6)] text-rs-red-text" role="alert">{error}</p> : null}
      </Card>
    </main>
  </StageBackground>;
}
