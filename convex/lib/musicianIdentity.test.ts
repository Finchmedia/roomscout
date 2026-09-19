import { describe, expect, it } from "vitest";
import { musicianProfilePromptContext, resolveProviderIdentity } from "./musicianIdentity";

describe("resolveProviderIdentity", () => {
  it.each([
    ["named band", { firstName: "Alex", lastName: "Private", actKind: "band" as const, actName: "Neon Harbour", providerIdentityConfirmedAt: 1 }, "Neon Harbour", "band_name"],
    ["unnamed band", { username: "login-handle", firstName: "Alex", lastName: "Private", actKind: "band" as const, providerIdentityConfirmedAt: 1 }, "Alex’s band", "member_first_names"],
    ["named solo act", { firstName: "Mina", lastName: "Private", actKind: "solo" as const, actName: "Night Loom", providerIdentityConfirmedAt: 1 }, "Night Loom", "band_name"],
    ["unnamed solo act", { username: "stage-login", firstName: "Mina", lastName: "Private", actKind: "solo" as const, providerIdentityConfirmedAt: 1 }, "Mina", "member_first_names"],
  ])("resolves a %s without sharing a surname or login username", (_case, user, representedName, dataField) => {
    const result = resolveProviderIdentity(user);
    expect(result).toEqual({
      complete: true,
      providerDisplayName: `RoomScout for ${representedName}`,
      representedName,
      actKind: user.actKind,
      firstName: user.firstName,
      dataFields: [dataField],
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    if ("username" in user) expect(JSON.stringify(result)).not.toContain(user.username);
  });

  it("reports incomplete instead of falling back to a username", () => {
    expect(resolveProviderIdentity({ username: "login-handle" })).toEqual({ complete: false });
  });

  it("gives Scout only the confirmed profile fields and marks them as already known", () => {
    const context = musicianProfilePromptContext({
      username: "private-login",
      firstName: "Alex",
      lastName: "Private-Surname",
      actKind: "band",
      actName: "Neon Harbour",
      providerIdentityConfirmedAt: 1,
    });

    expect(context).toContain('"firstName":"Alex"');
    expect(context).toContain('"representedName":"Neon Harbour"');
    expect(context).toContain('"actKind":"band"');
    expect(context).toContain("already confirmed");
    expect(context).not.toContain("Private-Surname");
    expect(context).not.toContain("private-login");
    expect(musicianProfilePromptContext({ username: "login-only" })).toBe("");
  });
});
