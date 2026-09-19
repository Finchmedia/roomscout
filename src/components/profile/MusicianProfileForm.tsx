import * as React from "react";
import { resolveProviderIdentity, type MusicianActKind } from "../../../convex/lib/musicianIdentity";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Overline } from "../ui/overline";
import { RadioCard, RadioCardGroup } from "../ui/radio-card";
import { useCopy } from "../../ui/copy";

export type MusicianProfileDraft = {
  firstName: string;
  lastName?: string;
  actKind: MusicianActKind;
  actName?: string;
  expectedProviderDisplayName: string;
};

type InitialProfile = {
  firstName?: string;
  lastName?: string;
  actKind?: MusicianActKind;
  actName?: string;
};

type MusicianProfileFormProps = {
  initialProfile?: InitialProfile;
  submitting?: boolean;
  submitLabel: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (profile: MusicianProfileDraft) => Promise<boolean>;
};

function normalized(value: string) {
  const result = value.trim();
  return result || undefined;
}

function comparableProfile(profile?: InitialProfile) {
  return JSON.stringify({
    firstName: normalized(profile?.firstName ?? ""),
    lastName: normalized(profile?.lastName ?? ""),
    actKind: profile?.actKind,
    actName: normalized(profile?.actName ?? ""),
  });
}

export function MusicianProfileForm({ initialProfile, submitting = false, submitLabel, onDirtyChange, onSubmit }: MusicianProfileFormProps) {
  const { t } = useCopy();
  const [firstName, setFirstName] = React.useState(initialProfile?.firstName ?? "");
  const [lastName, setLastName] = React.useState(initialProfile?.lastName ?? "");
  const [actKind, setActKind] = React.useState<MusicianActKind | undefined>(initialProfile?.actKind);
  const [actName, setActName] = React.useState(initialProfile?.actName ?? "");
  const [baseline, setBaseline] = React.useState(() => comparableProfile(initialProfile));

  const comparable = React.useMemo(() => JSON.stringify({
    firstName: normalized(firstName),
    lastName: normalized(lastName),
    actKind,
    actName: normalized(actName),
  }), [firstName, lastName, actKind, actName]);
  const dirty = comparable !== baseline;
  React.useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const identity = resolveProviderIdentity({
    firstName,
    actKind,
    actName,
    providerIdentityConfirmedAt: 1,
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!identity.complete || submitting) return;
    const saved = await onSubmit({
      firstName: firstName.trim(),
      lastName: normalized(lastName),
      actKind: identity.actKind,
      actName: normalized(actName),
      expectedProviderDisplayName: identity.providerDisplayName,
    });
    if (saved) setBaseline(comparable);
  }

  return <form className="grid gap-[var(--space-9)]" onSubmit={submit}>
    <div className="grid grid-cols-2 gap-[var(--space-7)] max-[680px]:grid-cols-1">
      <label className="grid gap-[var(--space-3)] text-[length:var(--text-body-sm-size)]" htmlFor="musician-first-name">
        {t("appRoutes.onboarding.firstName")}
        <Input id="musician-first-name" required maxLength={80} value={firstName} placeholder={t("appRoutes.onboarding.firstNamePlaceholder")} onChange={(event) => setFirstName(event.target.value)} />
      </label>
      <label className="grid gap-[var(--space-3)] text-[length:var(--text-body-sm-size)]" htmlFor="musician-last-name">
        {t("appRoutes.onboarding.lastName")}
        <Input id="musician-last-name" maxLength={80} value={lastName} placeholder={t("appRoutes.onboarding.lastNamePlaceholder")} helper={t("appRoutes.onboarding.lastNameHint")} onChange={(event) => setLastName(event.target.value)} />
      </label>
    </div>
    <div>
      <Overline className="mb-[var(--space-5)]">{t("appRoutes.onboarding.actKind")}</Overline>
      <RadioCardGroup aria-label={t("appRoutes.onboarding.actKind")} className="grid-cols-2 max-[680px]:grid-cols-1">
        <RadioCard checked={actKind === "band"} title={t("appRoutes.onboarding.band")} description={t("appRoutes.onboarding.bandDescription")} onSelect={() => setActKind("band")} />
        <RadioCard checked={actKind === "solo"} title={t("appRoutes.onboarding.solo")} description={t("appRoutes.onboarding.soloDescription")} onSelect={() => setActKind("solo")} />
      </RadioCardGroup>
    </div>
    <label className="grid gap-[var(--space-3)] text-[length:var(--text-body-sm-size)]" htmlFor="musician-act-name">
      {t("appRoutes.onboarding.actName")}
      <Input id="musician-act-name" maxLength={120} value={actName} placeholder={t("appRoutes.onboarding.actNamePlaceholder")} onChange={(event) => setActName(event.target.value)} />
    </label>
    <div className="rounded-card border border-rs-border-accent-soft bg-rs-rust-faint px-[var(--space-9)] py-[var(--space-8)]">
      <Overline>{t("appRoutes.onboarding.preview")}</Overline>
      <div className="mt-[var(--space-4)] text-[length:var(--text-card-title-size)] text-rs-ink">{identity.complete ? identity.providerDisplayName : "RoomScout"}</div>
      <p className="mt-[var(--space-3)] mb-0 text-[length:var(--text-caption-size)] text-rs-ink-4">{t("appRoutes.onboarding.previewHint")}</p>
    </div>
    <Button type="submit" disabled={!identity.complete || !dirty || submitting}>{submitLabel}</Button>
  </form>;
}
