import * as React from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ContextImportDialog } from "../../components/memory/ContextImportDialog";
import { ActionDialog } from "../../components/ui/ActionDialog";
import { Button } from "../../components/ui/button";
import { Icon } from "../../components/ui/icon";
import { Input } from "../../components/ui/input";
import { LiveSourcesSection } from "./LiveSourcesSection";
import { LiveKnowledgeSection } from "./LiveKnowledgeSection";
import { LiveBillingSection, LivePrivacySection } from "./LiveAccountSections";
import { LiveAutonomySection, mandateToRules, type AutonomyRules } from "./LiveAutonomySection";
import { PanelDialog, type PanelDialogGroup } from "../../ui/chrome/PanelDialog";
import { StageBackground } from "../../ui/chrome/StageBackground";
import { AppHeader } from "../../ui/chrome/AppHeader";
import { useCopy, type CopyVars, type StringCopyKey } from "../../ui/copy";
import { liveSettingsCopy } from "../../ui/settings/liveCopy";
import { PageLead, PageTitle, SettingsRow } from "../../ui/settings/primitives";

const PAGES = ["sources", "autonomy", "knowledge", "profile", "notifications", "billing", "privacy"] as const;
type LiveSettingsSection = (typeof PAGES)[number];

function sectionOf(value: string | undefined): LiveSettingsSection {
  return PAGES.includes(value as LiveSettingsSection) ? value as LiveSettingsSection : "sources";
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase() || "–";
}

function isControlledDemoUrl(value: string) {
  try { return new URL(value).protocol === "https:" && new URL(value).hostname === "roomscout.dev"; }
  catch { return false; }
}

export function LiveSettingsPage() {
  const { t } = useCopy();
  const copy = (key: keyof typeof liveSettingsCopy, vars?: CopyVars) =>
    t(`liveSettings.${key}` as StringCopyKey, vars);
  const navigate = useNavigate();
  const params = useParams<{ section?: string }>();
  const page = sectionOf(params.section);
  const user = useQuery(api.users.current);
  const needs = useQuery(api.savedNeeds.listMine, user ? { limit: 10 } : "skip");
  const scout = useQuery(api.scout.getMine, user ? {} : "skip");
  const memory = useQuery(api.memory.listMine, user ? {} : "skip");
  const mailbox = useQuery(api.mailboxes.getMine, user ? {} : "skip");
  const portals = useQuery(api.portalConnections.listMine, user ? {} : "skip");
  const connectable = useQuery(api.portalConnections.listConnectableSources, user ? { limit: 50 } : "skip");
  const need = needs?.find((item) => item._id === scout?.activeNeedId && item.status !== "archived") ?? needs?.find((item) => item.status !== "archived");
  const sources = useQuery(api.searchSources.listForNeed, need ? { savedNeedId: need._id, limit: 50 } : "skip");
  const mandate = useQuery(api.mandates.getActiveMine, need ? { savedNeedId: need._id } : "skip");
  const portalPreferences = useQuery(api.searchSources.getPortalPreferences, need ? { savedNeedId: need._id } : "skip");
  const setPortalPreference = useMutation(api.searchSources.setPortalPreference);
  const updateName = useMutation(api.settings.updateDisplayName);
  const setPreference = useMutation(api.searchSources.setPreference);
  const deleteFact = useMutation(api.memory.deleteFact);
  const updateFact = useMutation(api.memory.updateFact);
  const confirmFact = useMutation(api.memory.confirmFact);
  const updateNeed = useMutation(api.savedNeeds.update);
  const ensureMailbox = useAction(api.mailboxes.ensureMine);
  const requestConnection = useMutation(api.portalConnections.requestConnection);
  const pauseConnection = useMutation(api.portalConnections.pauseMine);
  const startAuthentication = useAction(api.browserbasePortal.startAuthentication);
  const startRegistration = useAction(api.browserbasePortal.startAgentRegistration);
  const recoverFirecrawlProfile = useAction(api.firecrawlPortal.recoverProfile);
  const syncInbox = useAction(api.browserbasePortal.syncInboxNow);
  const disableConnection = useAction(api.browserbasePortal.disableConnection);
  const [nameDraft, setNameDraft] = React.useState<string | null>(null);
  const [autonomyDraft, setAutonomyDraft] = React.useState<AutonomyRules | null>(null);
  const [working, setWorking] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [discardAction, setDiscardAction] = React.useState<(() => void) | null>(null);
  const [disableId, setDisableId] = React.useState<Id<"portalConnections"> | null>(null);
  const currentName = user?.displayName ?? user?.username ?? "";
  const draftName = nameDraft ?? currentName;
  const nameDirty = nameDraft !== null && nameDraft.trim() !== currentName;
  const autonomyDirty = autonomyDraft !== null && JSON.stringify(autonomyDraft) !== JSON.stringify(mandateToRules(mandate ?? null));
  const dirty = nameDirty || autonomyDirty;
  const connectedSourceIds = new Set((portals ?? []).filter((portal) => portal.status !== "disabled").map((portal) => portal.sourceId));
  const availableConnections = (connectable ?? []).filter((source) => !connectedSourceIds.has(source.sourceId));

  function guarded(run: () => void) {
    if (dirty) setDiscardAction(() => run);
    else run();
  }
  function go(next: LiveSettingsSection) {
    guarded(() => navigate(`/app/settings/${next}`));
  }
  async function run(key: string, operation: () => Promise<unknown>, success = copy("saved")) {
    setWorking(key); setMessage("");
    try { await operation(); setMessage(success); }
    catch { setMessage(copy("actionFailed")); }
    finally { setWorking(""); }
  }

  const groups: PanelDialogGroup[] = [
    { id: "scout", label: t("settings.nav.groupScout"), items: [
      { id: "sources", label: t("settings.nav.item.sources"), icon: <Icon name="globe" /> },
      { id: "autonomy", label: t("settings.nav.item.autonomy"), icon: <Icon name="sliders" /> },
      { id: "knowledge", label: t("settings.nav.item.knowledge"), icon: <Icon name="doc" /> },
    ] },
    { id: "account", label: t("settings.nav.groupAccount"), items: [
      { id: "profile", label: t("settings.nav.item.profile"), icon: <Icon name="user" /> },
      { id: "notifications", label: t("settings.nav.item.notifications"), icon: <Icon name="bell" /> },
      { id: "billing", label: t("settings.nav.item.billing"), icon: <Icon name="card" /> },
      { id: "privacy", label: t("settings.nav.item.privacy"), icon: <Icon name="shield" /> },
    ] },
  ];

  const loading = user === undefined || needs === undefined || scout === undefined || memory === undefined || portals === undefined || connectable === undefined;
  return <StageBackground position="fixed" className="font-sans text-rs-ink">
    <AppHeader initials={initials(currentName)} avatarLabel={currentName || "RoomScout"} />
    <PanelDialog
    open
    onOpenChange={(open) => { if (!open) guarded(() => navigate("/app/scout")); }}
    title={t("settings.nav.aria")}
    rootLabel={t("settings.nav.aria")}
    closeLabel={t("common.close")}
    groups={groups}
    currentId={page}
    onSelect={(id) => go(sectionOf(id))}
    back={{ label: t("settings.nav.back"), onSelect: () => guarded(() => navigate("/app/scout")) }}
    navHeader={need?.status === "active" || need?.status === "paused" ? <div className="mx-[var(--space-4)] flex items-start gap-[var(--space-3)] text-[length:var(--text-micro-size)] leading-[1.4] text-rs-ink-4">
      <span aria-hidden="true" className="mt-[5px] size-[7px] flex-none rounded-circle bg-rs-orange" />
      {t(need.status === "active" ? "settings.session.working" : "settings.session.paused")}
    </div> : null}
    footer={<div><div className="font-medium">{currentName || "RoomScout"}</div><div className="text-sm text-rs-ink-6">{copy("personalArea")}</div></div>}
    overlays={<>
      <ContextImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ActionDialog open={discardAction !== null} onOpenChange={(open) => { if (!open) setDiscardAction(null); }} title={copy("discardTitle")} description={copy("discardDescription")} footer={<><Button variant="secondary" onClick={() => setDiscardAction(null)}>{copy("keepEditing")}</Button><Button onClick={() => { const action = discardAction; setNameDraft(null); setAutonomyDraft(null); setDiscardAction(null); action?.(); }}>{copy("discard")}</Button></>}><p>{copy("discardBody")}</p></ActionDialog>
      <ActionDialog open={disableId !== null} onOpenChange={(open) => { if (!open) setDisableId(null); }} title={copy("removeTitle")} description={copy("removeDescription")} footer={<><Button variant="secondary" disabled={working.startsWith("disable:")} onClick={() => setDisableId(null)}>{copy("keepConnected")}</Button><Button variant="danger" disabled={working.startsWith("disable:")} onClick={() => { const connectionId = disableId; if (!connectionId) return; void run(`disable:${connectionId}`, async () => { await disableConnection({ connectionId }); setDisableId(null); }, copy("connectionRemoved")); }}>{copy("removeConnection")}</Button></>}><p>{copy("removeBody")}</p></ActionDialog>
    </>}
  >
    {loading ? <p role="status">{copy("loading")}</p> : null}
    {message ? <p role="status" className="mb-6 rounded-card bg-rs-surface-subtle p-4">{message}</p> : null}

    {!loading && page === "sources" ? <LiveSourcesSection
      city={need ? sources?.city : undefined} address={mailbox?.emailAddress}
      portals={portals ?? []} sources={sources?.sources ?? []} busy={Boolean(working)}
      preference={(portal) => portalPreferences?.find((p) => p.sourceId === portal.sourceId)?.preference !== "exclude"}
      onPortalToggle={(portal, checked) => { if (need) void run(`source:${portal.sourceId}`, () => setPortalPreference({ savedNeedId: need._id, sourceId: portal.sourceId, preference: checked ? "include" : "exclude" })); }}
      onSourceToggle={(source, checked) => { if (need) void run(`source:${source.platformId}`, () => setPreference({ savedNeedId: need._id, platformId: source.platformId, preference: checked ? "include" : "exclude" })); }}
      portalActions={(portal) => {
        const registrationInProgress = portal.latestAuthenticationRun && ["queued", "running", "human_required"].includes(portal.latestAuthenticationRun.status);
        const firecrawlNeedsRecovery = portal.browserProvider === "firecrawl" && portal.latestAuthenticationRun?.status === "completed" && (portal.status !== "active" || portal.contextStatus !== "ready");
        return <>
          {portal.status === "active" && portal.allowInboxPolling ? <Button size="xs" variant="secondary" disabled={Boolean(working)} onClick={() => void run(`sync:${portal._id}`, () => syncInbox({ connectionId: portal._id }), copy("synced"))}>{copy("syncInbox")}</Button> : null}
          {portal.status === "active" ? <Button size="xs" variant="secondary" disabled={Boolean(working)} onClick={() => void run(`pause:${portal._id}`, () => pauseConnection({ connectionId: portal._id }), copy("connectionPaused"))}>{copy("pause")}</Button> : null}
          {registrationInProgress ? <Button size="xs" onClick={() => navigate(`/app/runs/${portal.latestAuthenticationRun!.runId}`)}>{copy("viewRegistrationProgress")}</Button> : null}
          {!registrationInProgress && portal.browserProvider !== "firecrawl" && ["needs_auth", "reauth_required", "paused"].includes(portal.status) ? <Button size="xs" disabled={Boolean(working)} onClick={() => void run(`auth:${portal._id}`, async () => { const result = await startAuthentication({ connectionId: portal._id }); navigate(`/app/runs/${result.runId}`); }, copy("authenticationStarted"))}>{copy("authenticate")}</Button> : null}
          {!registrationInProgress && firecrawlNeedsRecovery ? <Button size="xs" disabled={Boolean(working)} onClick={() => void run(`recover:${portal._id}`, async () => { const result = await recoverFirecrawlProfile({ connectionId: portal._id }); if (result.runId) navigate(`/app/runs/${result.runId}`); }, copy("authenticationStarted"))}>{copy("recoverFirecrawlProfile")}</Button> : null}
          {!registrationInProgress && !firecrawlNeedsRecovery && portal.status === "needs_auth" && isControlledDemoUrl(portal.baseUrl) ? <Button size="xs" variant="secondary" disabled={Boolean(working)} onClick={() => void run(`register:${portal._id}`, async () => { const result = await startRegistration({ connectionId: portal._id }); navigate(`/app/runs/${result.runId}`); }, copy("registrationStarted"))}>{copy("registerScout")}</Button> : null}
          {portal.browserProvider === "firecrawl" && ["needs_auth", "reauth_required", "paused"].includes(portal.status) ? <span className="text-sm text-rs-ink-4">{copy("firecrawlManualLoginUnsupported")}</span> : null}
          <Button size="xs" variant="danger" disabled={Boolean(working)} onClick={() => setDisableId(portal._id)}>{copy("remove")}</Button>
        </>;
      }}
      addressAction={!mailbox || mailbox.status === "failed" ? <Button size="xs" disabled={Boolean(working)} onClick={() => void run("mailbox", () => ensureMailbox(), copy("mailboxReady"))}>{copy("configureAddress")}</Button> : null}
      moreSources={< >{availableConnections.map((source) => <SettingsRow key={source.sourceId}><div><strong>{source.platformName ?? source.name}</strong><div className="text-sm text-rs-ink-4">{source.baseUrl}</div></div><Button size="xs" variant="secondary" disabled={Boolean(working)} onClick={() => void run(`connect:${source.sourceId}`, () => requestConnection({ sourceId: source.sourceId, label: source.name }), copy("connectionAdded"))}>{copy("include")}</Button></SettingsRow>)}{!availableConnections.length ? <p className="text-rs-ink-4">{copy("noMoreSources")}</p> : null}</>}
    /> : null}

    {!loading && page === "autonomy" ? <LiveAutonomySection
      needId={need?._id} mandate={mandate} draft={autonomyDraft}
      onDraftChange={setAutonomyDraft}
      platformIds={(sources?.sources ?? []).filter((source) => source.preference !== "exclude").map((source) => source.platformId)}
      back={() => guarded(() => navigate("/app/scout"))}
    /> : null}

    {!loading && page === "knowledge" ? <LiveKnowledgeSection
      summary={memory?.profile?.summary} need={need} facts={memory?.facts ?? []} events={memory?.events ?? []}
      busy={Boolean(working)} onImport={() => setImportOpen(true)} onManage={() => navigate("/app/settings/privacy")}
      onUpdate={(fact, value) => void run(`fact:${fact._id}`, async () => {
        if (fact.memoryId) { await updateFact({ factId: fact.memoryId, value }); return; }
        if (!need || !fact.structuredField) return;
        if (fact.structuredField === "maxBudgetEur") {
          const amount = Number(value.replace(/[^\d,.]/g, "").replace(",", "."));
          if (!Number.isFinite(amount)) throw new Error("invalid budget");
          await updateNeed({ needId: need._id, maxBudgetEur: amount }); return;
        }
        if (fact.structuredField === "sharing") { await updateNeed({ needId: need._id, openToSharing: !/^\s*(nein|keine|nicht|no)\b/i.test(value) }); return; }
        if (fact.structuredField === "genres") { await updateNeed({ needId: need._id, genres: value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean) }); return; }
        if (fact.structuredField === "location") { await updateNeed({ needId: need._id, locationQuery: value, locationLabel: value }); return; }
        if (fact.structuredField === "radiusKm") {
          const radiusKm = Number(value.replace(/[^\d,.]/g, "").replace(",", "."));
          if (!Number.isFinite(radiusKm)) throw new Error("invalid radius");
          await updateNeed({ needId: need._id, radiusKm }); return;
        }
        if (fact.structuredField === "schedule") { await updateNeed({ needId: need._id, schedule: value.split(/[;\n]/).map((item) => item.trim()).filter(Boolean) }); return; }
        if (fact.structuredField === "requirements") { const requirements = [...need.requirements]; requirements[fact.structuredIndex ?? 0] = value; await updateNeed({ needId: need._id, requirements }); return; }
        const instruments = [...(need.instruments ?? [])]; instruments[fact.structuredIndex ?? 0] = value; await updateNeed({ needId: need._id, instruments });
      })}
      onConfirm={(factId) => void run(`fact:${factId}`, () => confirmFact({ factId }))}
      onDelete={(factId) => void run(`fact:${factId}`, () => deleteFact({ factId }))}
    /> : null}

    {!loading && page === "profile" ? <>
      <PageTitle>{copy("profileTitle")}</PageTitle><PageLead>{copy("profileLead")}</PageLead>
      <form className="mt-8 grid max-w-xl gap-4" onSubmit={(event) => { event.preventDefault(); const value = draftName.trim(); if (!value || value === currentName) return; void run("profile", async () => { await updateName({ displayName: value }); setNameDraft(null); }); }}><div className="flex size-16 items-center justify-center rounded-full bg-rs-surface-subtle text-xl">{initials(draftName)}</div><Input label={copy("displayName")} maxLength={80} value={draftName} onChange={(event) => setNameDraft(event.target.value)} /><Button type="submit" disabled={!dirty || !draftName.trim() || Boolean(working)}>{copy("save")}</Button></form><p className="mt-8 text-sm text-rs-ink-4">{copy("immutableLogin", { username: user?.username })}</p>
    </> : null}

    {!loading && page === "notifications" ? <><PageTitle>{copy("notificationsTitle")}</PageTitle><PageLead>{copy("notificationUnavailable")}</PageLead><Button className="mt-8" variant="secondary" onClick={() => navigate("/app/inbox")}>{copy("openInbox")}</Button></> : null}
    {!loading && page === "billing" ? <LiveBillingSection /> : null}
    {!loading && page === "privacy" ? <LivePrivacySection
      onKnowledge={() => go("knowledge")}
      onSources={() => go("sources")}
      onScout={() => guarded(() => navigate("/app/scout"))}
    /> : null}
  </PanelDialog>
  </StageBackground>;
}

export type { LiveSettingsSection };
