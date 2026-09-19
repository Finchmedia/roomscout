export type MusicianActKind = "band" | "solo";

export type ProviderIdentityUser = {
  username?: string;
  firstName?: string;
  lastName?: string;
  actKind?: MusicianActKind;
  actName?: string;
  providerIdentityConfirmedAt?: number;
};

export type ProviderIdentityDataField = "band_name" | "member_first_names";

export type ProviderIdentityResolution =
  | { complete: false }
  | {
      complete: true;
      providerDisplayName: string;
      representedName: string;
      actKind: MusicianActKind;
      firstName: string;
      dataFields: ProviderIdentityDataField[];
    };

export type TrustedMusicianProfile = {
  firstName: string;
  representedName: string;
  actKind: MusicianActKind;
};

/** Canonical provider identity. Login usernames and surnames never participate. */
export function resolveProviderIdentity(user: ProviderIdentityUser): ProviderIdentityResolution {
  const firstName = user.firstName?.trim();
  const actName = user.actName?.trim();
  if (!firstName || !user.actKind || user.providerIdentityConfirmedAt === undefined) {
    return { complete: false };
  }

  const representedName = actName
    ? actName
    : user.actKind === "band"
      ? `${firstName}’s band`
      : firstName;
  return {
    complete: true,
    providerDisplayName: `RoomScout for ${representedName}`,
    representedName,
    actKind: user.actKind,
    firstName,
    dataFields: [actName ? "band_name" : "member_first_names"],
  };
}

/** Minimal confirmed identity shared with Scout and Live. Private account
 * fields such as surname and login username never enter model context. */
export function musicianProfilePromptContext(user: ProviderIdentityUser): string {
  const identity = resolveProviderIdentity(user);
  if (!identity.complete) return "";
  const profile: TrustedMusicianProfile = {
    firstName: identity.firstName,
    representedName: identity.representedName,
    actKind: identity.actKind,
  };
  return [
    "TRUSTED MUSICIAN PROFILE:",
    JSON.stringify(profile),
    "These identity details are already confirmed. Use them when relevant and do not ask the musician for them again unless they ask to change them.",
    "No surname or login username is supplied. Do not infer either one.",
  ].join("\n");
}
