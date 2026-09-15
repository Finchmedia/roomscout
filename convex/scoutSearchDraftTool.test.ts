import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import { createSearchDraftTool, SEARCH_FACET_GUIDANCE } from "./scout";

describe("Scout search equipment extraction contract", () => {
  it("keeps owned-gear storage distinct from provider-supplied equipment and ignores questions", () => {
    expect(SEARCH_FACET_GUIDANCE).toContain(
      "equipment.storage=true means the musician requires permission to leave their own gear onsite",
    );
    expect(SEARCH_FACET_GUIDANCE).toContain(
      "equipment.backline=true mean that the room or provider must supply that equipment",
    );
    expect(SEARCH_FACET_GUIDANCE).toContain(
      "'Can our drum kit stay there?' is a question and causes no update",
    );
    const tool = createSearchDraftTool({} as never, {
      ownerId: "owner" as Id<"users">,
      needId: "need" as Id<"savedNeeds">,
    });
    expect(tool.description).toContain(SEARCH_FACET_GUIDANCE);
  });
});
