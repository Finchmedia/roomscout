import { describe, expect, it } from "vitest";
import {
  collisionSafeMailboxUsername,
  mailboxUsername,
} from "./mailboxes";

describe("personal AgentMail usernames", () => {
  it("uses the sanitized RoomScout username as the first choice", () => {
    expect(mailboxUsername("The Strümmers!!")).toBe("the-strummers");
    expect(mailboxUsername("---")).toBe("musician");
  });

  it("adds a deterministic owner-derived suffix only for a collision retry", () => {
    const clientId = `roomscout-user-${"a1b2c3d4".repeat(8)}`;
    expect(collisionSafeMailboxUsername("The Strümmers!!", clientId)).toBe(
      "the-strummers-a1b2c3d4",
    );
    expect(collisionSafeMailboxUsername("The Strümmers!!", clientId)).toBe(
      collisionSafeMailboxUsername("The Strümmers!!", clientId),
    );
  });
});
