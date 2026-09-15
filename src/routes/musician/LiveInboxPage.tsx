import * as React from "react";
import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LiveProfileMenu } from "../../components/navigation/LiveProfileMenu";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { AppHeader } from "../../ui/chrome/AppHeader";
import { PanelDialog, type PanelDialogGroup } from "../../ui/chrome/PanelDialog";
import { StageBackground } from "../../ui/chrome/StageBackground";
import { useCopy, type StringCopyKey } from "../../ui/copy";
import { formatMessageStamp } from "../../ui/copy/format";
import { ConversationThread } from "../../ui/inbox/ConversationThread";

/**
 * Nachrichten — the musician's own inbox, in the settings panel's chrome: the
 * conversation list where Settings has its nav, one conversation on the right,
 * and the composer for the musician's own message pinned at the bottom.
 *
 * The route is `/app/inbox/:conversationId?`; the bare `/app/inbox` (the seven
 * links that already exist) selects the newest conversation and replaces the
 * URL, so a reload and a shared link land on the same thread.
 *
 * Reading is recorded by the surface, not by the query: `markRead` runs when a
 * conversation is opened and again whenever its newest activity moves while it
 * is open — that is the only writer of `lastReadAt`.
 */

/** German sentence per backend code; anything unmapped stays the generic line. */
const REPLY_ERROR_COPY: Record<string, StringCopyKey> = {
  CONVERSATION_NOT_FOUND: "liveInbox.errorNotFound",
  CONVERSATION_CLOSED: "liveInbox.errorClosed",
  CONVERSATION_ASSESSMENT_REQUIRED: "liveInbox.errorAssessmentRequired",
  CONVERSATION_CONTEXT_CHANGED: "liveInbox.errorContextChanged",
  REPLY_CHANNEL_NOT_READY: "liveInbox.errorChannelNotReady",
  INVALID_REPLY_BODY: "liveInbox.errorInvalidBody",
  TEXT_REQUIRED: "liveInbox.errorInvalidBody",
  INVALID_CHOICE: "liveInbox.errorInvalidBody",
  DECISION_NOT_FOUND: "liveInbox.errorContextChanged",
  DECISION_NOT_ANSWERABLE: "liveInbox.errorContextChanged",
  ACTION_NOT_FOUND: "liveInbox.errorContextChanged",
};

function errorCodeOf(error: unknown): string | undefined {
  if (!(error instanceof ConvexError)) return undefined;
  const data: unknown = error.data;
  if (typeof data === "object" && data !== null && "code" in data) {
    const code = (data as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function initials(name: string): string {
  return name.trim().split(/[\s_-]+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0] ?? "").join("").toLocaleUpperCase() || "–";
}

export function LiveInboxPage() {
  const { t, tp, locale } = useCopy();
  const navigate = useNavigate();
  const params = useParams<{ conversationId?: string }>();
  const currentUser = useQuery(api.users.current);
  const rows = useQuery(api.conversations.listMine, { limit: 50 });
  const offers = useQuery(api.providerConversations.listMine, { limit: 50 });
  const markRead = useMutation(api.conversations.markRead);
  const reply = useMutation(api.conversations.reply);
  const answerDecision = useMutation(api.decisions.answer);
  // The error belongs to one conversation: keyed, so switching threads clears
  // it without an effect that writes state on every selection.
  const [replyError, setReplyError] = React.useState<{ conversationId: string; message: string } | null>(null);
  // One reference moment per visit, so every stamp on the surface agrees and a
  // re-render never reshuffles „Heute“ into „Gestern“ mid-session.
  const [now] = React.useState(() => Date.now());

  const list = React.useMemo(() => rows ?? [], [rows]);
  const routeId = params.conversationId as Id<"providerConversations"> | undefined;
  const selected = routeId ? list.find((row) => row.conversationId === routeId) : undefined;
  const selectedId = selected?.conversationId;
  const thread = useQuery(api.conversations.getMine, selectedId ? { conversationId: selectedId } : "skip");

  // A bare /app/inbox opens the newest conversation; the URL is replaced, not
  // pushed, so Back still leaves the surface instead of bouncing.
  React.useEffect(() => {
    if (rows === undefined || routeId !== undefined || list.length === 0) return;
    navigate(`/app/inbox/${list[0]!.conversationId}`, { replace: true });
  }, [rows, routeId, list, navigate]);

  // Opening a conversation is what marks it read — and so is every new activity
  // on it while it stays open.
  const lastActivityAt = selected?.lastActivityAt;
  React.useEffect(() => {
    if (!selectedId || lastActivityAt === undefined) return;
    void markRead({ conversationId: selectedId }).catch(() => undefined);
  }, [selectedId, lastActivityAt, markRead]);

  const name = currentUser?.displayName ?? currentUser?.username ?? "";

  function previewOf(row: (typeof list)[number]): string | undefined {
    if (!row.preview) return undefined;
    const key: StringCopyKey = row.preview.author === "provider" ? "liveInbox.previewProvider"
      : row.preview.author === "scout" ? "liveInbox.previewScout"
        : "liveInbox.previewYou";
    return t(key, { text: row.preview.text });
  }

  function stateOf(row: (typeof list)[number]): string | undefined {
    if (row.offer?.ready) return t("liveInbox.stateOfferReady");
    if (row.state === "thinking") return t("liveInbox.stateThinking");
    return undefined;
  }

  const groups: PanelDialogGroup[] = [{
    id: "conversations",
    items: list.map((row) => {
      const label = row.title || row.providerLabel || t("liveInbox.provider");
      return {
        id: row.conversationId,
        label,
        onSelect: () => navigate(`/app/inbox/${row.conversationId}`),
        meta: {
          avatar: <Avatar variant="provider" size="sm" aria-hidden="true">
            <AvatarFallback>{initials(row.providerLabel || label)}</AvatarFallback>
          </Avatar>,
          preview: previewOf(row),
          time: formatMessageStamp(locale, row.lastActivityAt, now, { short: true }),
          status: stateOf(row),
          dot: row.unread || row.openDecision !== undefined,
          dotLabel: t("liveInbox.unread"),
        },
      };
    }),
  }];

  async function send(body: string): Promise<boolean> {
    if (!selectedId) return false;
    setReplyError(null);
    try {
      await reply({ conversationId: selectedId, body });
      return true;
    } catch (error) {
      const key = REPLY_ERROR_COPY[errorCodeOf(error) ?? ""] ?? "liveInbox.errorGeneric";
      setReplyError({ conversationId: selectedId, message: t(key) });
      return false;
    }
  }

  const loading = rows === undefined;
  const offerConversation = selectedId
    ? (offers ?? []).find((row) => row.conversationId === selectedId) ?? null
    : null;

  return <StageBackground position="fixed" className="font-sans text-rs-ink">
    <AppHeader
      initials={initials(name)}
      avatarLabel={name || "RoomScout"}
      avatarSlot={<LiveProfileMenu name={name} operator={currentUser?.role === "operator"} />}
    />
    <PanelDialog
      open
      onOpenChange={(open) => { if (!open) navigate("/app/scout"); }}
      title={t("liveInbox.title")}
      rootLabel={t("appRoutes.messages")}
      navLabel={t("liveInbox.navAria")}
      closeLabel={t("common.close")}
      groups={groups}
      currentId={selectedId}
      back={{ label: t("settings.nav.back"), onSelect: () => navigate("/app/scout") }}
      navHeader={loading ? null : <div className="mx-[var(--space-4)] text-[length:var(--text-micro-size)] leading-[1.4] text-rs-ink-4">
        {tp("liveInbox.count", list.length)}
      </div>}
      contentClassName="p-0! overflow-hidden flex flex-col min-[900px]:p-0!"
    >
      {loading ? <div className="flex flex-col gap-[var(--space-6)] p-[var(--space-10)]" role="status" aria-label={t("liveInbox.loading")}>
        <Skeleton className="h-[var(--space-9)] w-1/2" />
        <Skeleton className="h-[var(--space-9)] w-3/4" />
        <Skeleton className="h-[var(--space-9)] w-2/3" />
      </div> : null}

      {!loading && list.length === 0 ? <div className="m-auto flex max-w-[32rem] flex-col items-center gap-[var(--space-8)] p-[var(--space-10)] text-center">
        <p className="text-[length:var(--text-body-sm-size)] text-rs-ink-6">{t("liveInbox.empty")}</p>
        <Button size="md" onClick={() => navigate("/app/scout")}>{t("liveInbox.emptyAction")}</Button>
      </div> : null}

      {!loading && list.length > 0 && !selectedId
        ? <p role="status" className="m-auto max-w-[32rem] py-[var(--space-17)] text-center text-[length:var(--text-body-sm-size)] text-rs-ink-6">{t("liveInbox.selectHint")}</p>
        : null}

      {selectedId && thread === undefined
        ? <p role="status" className="m-auto max-w-[32rem] py-[var(--space-17)] text-center text-[length:var(--text-body-sm-size)] text-rs-ink-6">{t("liveInbox.threadLoading")}</p>
        : null}

      {selectedId && thread === null
        ? <p role="status" className="m-auto max-w-[32rem] py-[var(--space-17)] text-center text-[length:var(--text-body-sm-size)] text-rs-ink-6">{t("liveInbox.notFound")}</p>
        : null}

      {selectedId && thread ? <ConversationThread
        key={selectedId}
        header={thread.header}
        items={thread.items}
        now={now}
        onSend={send}
        onAnswerDecision={async (decisionId, choice, text) => { await answerDecision({ decisionId, choice, ...(text ? { text } : {}) }); }}
        offerConversation={offerConversation}
        offerTitle={thread.header.title || undefined}
        error={replyError?.conversationId === selectedId ? replyError.message : undefined}
      /> : null}
    </PanelDialog>
  </StageBackground>;
}
