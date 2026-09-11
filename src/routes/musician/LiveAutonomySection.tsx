import * as React from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Icon } from "../../components/ui/icon";
import { Overline } from "../../components/ui/overline";
import { RadioCard, RadioCardGroup } from "../../components/ui/radio-card";
import { Stepper, type StepperValue } from "../../components/ui/stepper";
import { Switch } from "../../components/ui/switch";
import { useCopy } from "../../ui/copy";
import { SaveBar } from "../../ui/settings/SaveBar";
import { PageLead, PageTitle, SettingsRow } from "../../ui/settings/primitives";

/* The parent settings route intentionally imports the mapper/type beside this component. */
/* eslint-disable react-refresh/only-export-components */

type Mandate = FunctionReturnType<typeof api.mandates.getActiveMine>;
type Action = NonNullable<Mandate>["allowedActionTypes"][number];
type PersonalData = NonNullable<Mandate>["allowedPersonalData"][number];

export interface AutonomyRules {
  mode: "autopilot" | "review";
  contact: boolean;
  viewings: boolean;
  publishAd: boolean;
  shareProfile: boolean;
  sharePrivate: boolean;
  perDay: StepperValue;
}

const CONTACT_ACTIONS = new Set<Action>(["send_email", "submit_webform", "send_platform_dm"]);
const PROFILE_DATA = new Set<PersonalData>(["band_name", "member_first_names", "reply_email", "availability", "budget", "music_profile"]);
const PRIVATE_DATA = new Set<PersonalData>(["phone", "precise_location"]);

export function mandateToRules(mandate: Mandate): AutonomyRules {
  if (!mandate) return { mode: "review", contact: false, viewings: false, publishAd: false, shareProfile: false, sharePrivate: false, perDay: 10 };
  return {
    mode: mandate.mode === "guided" ? "review" : "autopilot",
    contact: mandate.allowedActionTypes.some((value) => CONTACT_ACTIONS.has(value)),
    viewings: mandate.allowedActionTypes.includes("propose_visit_time"),
    publishAd: mandate.allowedActionTypes.includes("publish_listing"),
    shareProfile: mandate.allowedPersonalData.some((value) => PROFILE_DATA.has(value)),
    sharePrivate: mandate.allowedPersonalData.some((value) => PRIVATE_DATA.has(value)),
    perDay: mandate.maxContactsPerDay,
  };
}

export function autonomyRulesEqual(left: AutonomyRules, right: AutonomyRules): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

interface LiveAutonomySectionProps {
  needId: Id<"savedNeeds"> | undefined;
  mandate: Mandate | undefined;
  platformIds?: Id<"sourcePlatforms">[];
  /** Alias kept for hosts that describe the first-save scope as defaults. */
  defaultPlatformIds?: Id<"sourcePlatforms">[];
  draft: AutonomyRules | null;
  onDraftChange: (draft: AutonomyRules | null) => void;
  back: () => void;
}

function replaceMapped<T extends string>(existing: readonly T[], mapped: ReadonlySet<T>, enabled: boolean): T[] {
  const preserved = existing.filter((value) => !mapped.has(value));
  return enabled ? [...new Set([...preserved, ...mapped])] : preserved;
}

export function LiveAutonomySection({ needId, mandate, platformIds, defaultPlatformIds, draft, onDraftChange, back }: LiveAutonomySectionProps) {
  const { t } = useCopy();
  const createDraft = useMutation(api.mandates.createDraft);
  const activate = useMutation(api.mandates.activate);
  const revoke = useMutation(api.mandates.revoke);
  const [actionDetails, setActionDetails] = React.useState(false);
  const [shareDetails, setShareDetails] = React.useState(false);
  const [limitsOpen, setLimitsOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState(false);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alertId = React.useId();
  React.useEffect(() => () => clearTimeout(savedTimer.current), []);

  const baseline = mandateToRules(mandate ?? null);
  const rules = draft ?? baseline;
  const dirty = draft !== null && !autonomyRulesEqual(draft, baseline);
  const dailyLimit = Number(rules.perDay);
  const invalidLimit = !(Number.isInteger(dailyLimit) && dailyLimit > 0);
  const initialPlatformIds = platformIds ?? defaultPlatformIds ?? [];
  const missingScope = rules.mode === "autopilot" && !mandate && initialPlatformIds.length === 0;
  const controlsDisabled = !needId || mandate === undefined || saving || rules.mode === "review";
  const invalid = invalidLimit || !needId || mandate === undefined || missingScope || saving;
  const patch = (next: Partial<AutonomyRules>) => onDraftChange({ ...rules, ...next });
  const setFlag = (key: keyof Pick<AutonomyRules, "contact" | "viewings" | "publishAd" | "shareProfile" | "sharePrivate">, checked: boolean) => patch({ [key]: checked });

  async function save() {
    if (invalid || !needId) return;
    setSaving(true); setError(false);
    try {
      if (rules.mode === "review") {
        if (mandate) await revoke({ mandateId: mandate._id });
      } else {
        const oldActions = mandate?.allowedActionTypes ?? [];
        let actions = rules.contact === baseline.contact ? [...oldActions] : replaceMapped(oldActions, CONTACT_ACTIONS, rules.contact);
        if (rules.viewings !== baseline.viewings) actions = replaceMapped(actions, new Set<Action>(["propose_visit_time"]), rules.viewings);
        if (rules.publishAd !== baseline.publishAd) actions = replaceMapped(actions, new Set<Action>(["publish_listing"]), rules.publishAd);
        let data = mandate?.allowedPersonalData ? [...mandate.allowedPersonalData] : [];
        if (rules.shareProfile !== baseline.shareProfile) data = replaceMapped(data, PROFILE_DATA, rules.shareProfile);
        if (rules.sharePrivate !== baseline.sharePrivate) data = replaceMapped(data, PRIVATE_DATA, rules.sharePrivate);
        const now = Date.now();
        const result = await createDraft({
          savedNeedId: needId,
          mode: actions.length > 0 ? "negotiation_autopilot" : "research_autopilot",
          platformIds: mandate?.platformIds ?? initialPlatformIds,
          allowedActionTypes: actions,
          allowedPersonalData: data,
          maxContactsPerDay: dailyLimit,
          maxBrowserMinutesPerDay: mandate?.maxBrowserMinutesPerDay ?? 30,
          ...(mandate?.maxMonthlyPriceEur === undefined ? {} : { maxMonthlyPriceEur: mandate.maxMonthlyPriceEur }),
          expiresAt: mandate && mandate.expiresAt > now ? mandate.expiresAt : now + 30 * 24 * 60 * 60 * 1_000,
          stopOnComplaint: mandate?.stopOnComplaint ?? true,
          stopWhenSuitableRoomConfirmed: mandate?.stopWhenSuitableRoomConfirmed ?? true,
        });
        await activate({ mandateId: result.mandateId, expectedContentHash: result.contentHash });
      }
      onDraftChange(null); setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2600);
    } catch { setError(true); } finally { setSaving(false); }
  }

  const actionRows = [
    ["contact", t("settings.autonomy.action.contact")],
    ["viewings", t("settings.autonomy.action.viewings")],
    ["publishAd", t("settings.autonomy.action.publishAd")],
  ] as const;
  const shareRows = [["shareProfile", t("settings.autonomy.share.profile")], ["sharePrivate", t("settings.autonomy.share.private")]] as const;

  return <>
    <PageTitle>{t("settings.autonomy.title")}</PageTitle>
    <PageLead>{t("settings.autonomy.subtitle")}</PageLead>
    <RadioCardGroup aria-label={t("settings.autonomy.modeGroupAria")} className="mt-[var(--space-12)] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[var(--space-6)]">
      <RadioCard disabled={!needId || mandate === undefined || saving} checked={rules.mode === "autopilot"} onSelect={() => patch({ mode: "autopilot" })} title={t("settings.autonomy.mode.autopilot.title")} description={t("settings.autonomy.mode.autopilot.sub")} />
      <RadioCard disabled={!needId || mandate === undefined || saving} checked={rules.mode === "review"} onSelect={() => patch({ mode: "review" })} title={t("settings.autonomy.mode.review.title")} description={t("settings.autonomy.mode.review.sub")} />
    </RadioCardGroup>
    <div className="mt-[var(--space-14)] flex items-baseline justify-between gap-[var(--space-9)]"><Overline>{t("settings.autonomy.actions.label")}</Overline><Button variant="ghost" size="2xs" aria-expanded={actionDetails} className="text-[length:var(--text-caption-size)] text-rs-ink-6" onClick={() => setActionDetails(!actionDetails)}>{t("settings.autonomy.details.toggle")}</Button></div>
    {actionDetails ? <p className="mt-[var(--space-3)] mb-0 animate-rs-fade-up text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">{t("settings.autonomy.actions.details")}</p> : null}
    {actionRows.map(([key, label]) => <SettingsRow key={key} className="py-[var(--space-6)] text-[length:var(--text-body-lg-size)]"><span>{label}</span><Switch disabled={controlsDisabled} checked={rules[key]} onCheckedChange={(checked) => setFlag(key, checked)} label={label} /></SettingsRow>)}
    <div className="mt-[var(--space-14)] flex items-baseline justify-between gap-[var(--space-9)]"><Overline>{t("settings.autonomy.share.label")}</Overline><Button variant="ghost" size="2xs" aria-expanded={shareDetails} className="text-[length:var(--text-caption-size)] text-rs-ink-6" onClick={() => setShareDetails(!shareDetails)}>{t("settings.autonomy.details.toggle")}</Button></div>
    {shareDetails ? <p className="mt-[var(--space-3)] mb-0 animate-rs-fade-up text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">{t("settings.autonomy.share.details")}</p> : null}
    {shareRows.map(([key, label]) => <SettingsRow key={key} className="py-[var(--space-6)] text-[length:var(--text-body-lg-size)]"><span>{label}</span><Switch disabled={controlsDisabled} checked={rules[key]} onCheckedChange={(checked) => setFlag(key, checked)} label={label} /></SettingsRow>)}
    <Overline className="mt-[var(--space-14)]">{t("settings.autonomy.limits.label")}</Overline>
    <SettingsRow className="flex-wrap py-[var(--space-6)] text-[length:var(--text-body-lg-size)]"><span>{t("settings.autonomy.limits.perDay")}</span><div className="flex flex-wrap items-center gap-[var(--space-10)]"><Stepper disabled={controlsDisabled} value={rules.perDay} onChange={(value) => patch({ perDay: value })} label={t("settings.autonomy.limits.perDay")} aria-invalid={invalidLimit} aria-describedby={invalidLimit ? alertId : undefined} /><Button variant="link" size="2xs" aria-expanded={limitsOpen} className="text-[length:var(--text-body-sm-size)] text-rs-ink" onClick={() => setLimitsOpen(!limitsOpen)}>{t("settings.autonomy.limits.more")}<Icon name="chevron-right" size={14} className={limitsOpen ? "rotate-90" : undefined} /></Button></div></SettingsRow>
    {invalidLimit ? <div id={alertId} role="alert" className="mt-[var(--space-3)] text-[length:var(--text-caption-size)] text-rs-red-text">{t("settings.autonomy.limits.invalid")}</div> : null}
    <div className="mt-[var(--space-2)] text-[length:var(--text-caption-sm-size)] text-rs-ink-6">{t("settings.autonomy.limits.caption")}</div>
    {limitsOpen ? <div className="mt-[var(--space-5)] animate-rs-fade-up rounded-card border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-9)] py-[var(--space-7)] text-[length:var(--text-body-sm-size)] leading-[1.7] text-rs-ink-2"><div><span className="text-rs-ink-6">{t("settings.autonomy.limits.periodLabel")}</span>{" "}{mandate ? new Date(mandate.expiresAt).toLocaleDateString() : t("liveSettings.autonomyFirstExpiry")}</div><div><span className="text-rs-ink-6">{t("settings.autonomy.limits.stopsLabel")}</span>{" "}{mandate ? t("liveSettings.autonomyStopsCurrent", { label: t(mandate.stopOnComplaint ? "liveSettings.autonomyStopOn" : "liveSettings.autonomyStopOff"), text: t(mandate.stopWhenSuitableRoomConfirmed ? "liveSettings.autonomyStopOn" : "liveSettings.autonomyStopOff") }) : t("liveSettings.autonomyStopsDefault")}</div><div><span className="text-rs-ink-6">{t("settings.autonomy.limits.budgetLabel")}</span>{" "}{mandate?.maxMonthlyPriceEur === undefined ? t("liveSettings.autonomyNoPriceCap") : `${mandate.maxMonthlyPriceEur} EUR`} {<Button variant="link" size="2xs" className="text-[length:var(--text-body-sm-size)] text-rs-ink" onClick={back}>{t("settings.autonomy.limits.budgetLink")}</Button>}</div></div> : null}
    <Card tone="rust" size="md" className="mt-[var(--space-12)] flex items-center gap-[var(--space-9)]"><Icon name="lock" size={26} className="flex-none text-rs-orange-light" /><div><div className="text-[length:var(--text-body-lg-size)] font-medium">{t("settings.autonomy.lock.title")}</div><div className="mt-[3px] text-[length:var(--text-caption-size)] text-rs-ink-4">{t("settings.autonomy.lock.sub")}</div></div></Card>
    {missingScope ? <p role="alert" className="mt-4 text-sm text-rs-red-text">{t("liveSettings.autonomyMissingScope")}</p> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-rs-red-text">{t("liveSettings.autonomySaveFailed")}</p> : null}
    <SaveBar dirty={dirty} invalid={invalid} saved={saved} onCancel={() => { if (!saving) onDraftChange(null); }} onSave={() => void save()} />
  </>;
}
