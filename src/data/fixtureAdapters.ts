import type {
  InboxPort,
  MailThread,
  OutreachDraft,
  OutreachPort,
  ScoutMessage,
  ScoutPort,
  SearchNeed,
  SearchPort,
  SignalFilters,
  SignalSummary,
  SignalsPort,
} from "./ports";

const tick = async () => await Promise.resolve();

export function createFixtureSignalsPort(seed: SignalSummary[]): SignalsPort {
  return {
    async list(filters: SignalFilters) {
      await tick();
      return seed.filter((signal) => {
        if (filters.city && signal.city !== filters.city) return false;
        if (filters.side && filters.side !== "all" && signal.side !== filters.side) {
          return false;
        }
        if (
          filters.arrangement &&
          filters.arrangement !== "all" &&
          signal.arrangement !== filters.arrangement
        ) {
          return false;
        }
        return true;
      });
    },
    async get(signalId: string) {
      await tick();
      return seed.find((signal) => signal.id === signalId) ?? null;
    },
  };
}

export function createFixtureSearchPort(initial: SearchNeed | null): SearchPort {
  let active = initial;
  return {
    async getActive() {
      await tick();
      return active;
    },
    async save(search) {
      await tick();
      active = search;
      return search;
    },
  };
}

export function createFixtureScoutPort(initial: ScoutMessage[]): ScoutPort {
  const messages = [...initial];
  return {
    async listMessages() {
      await tick();
      return [...messages];
    },
    async sendMessage(message) {
      await tick();
      const reply: ScoutMessage = {
        id: `fixture-assistant-${messages.length + 1}`,
        role: "assistant",
        body: `I captured that. The next useful step is to confirm the structured search card beside this conversation. (${message.length} characters received.)`,
        createdAtLabel: "Just now",
      };
      messages.push(reply);
      return reply;
    },
  };
}

export function createFixtureOutreachPort(
  initial: OutreachDraft | null,
): OutreachPort {
  let draft = initial;
  return {
    async getDraft() {
      await tick();
      return draft;
    },
    async revise(next) {
      await tick();
      draft = {
        ...next,
        contentVersion: next.contentVersion + 1,
        status: "awaiting_approval",
      };
      return draft;
    },
    async approve(draftId, contentVersion) {
      await tick();
      if (!draft || draft.id !== draftId || draft.contentVersion !== contentVersion) {
        throw new Error("This draft changed. Review the current version before approval.");
      }
      draft = { ...draft, status: "approved" };
      return draft;
    },
  };
}

export function createFixtureInboxPort(seed: MailThread[]): InboxPort {
  return {
    async listThreads() {
      await tick();
      return [...seed];
    },
    async getThread(threadId) {
      await tick();
      return seed.find((thread) => thread.id === threadId) ?? null;
    },
  };
}
