import { appRoutesEn } from "./en/appRoutes";
import { commonEn } from "./en/common";
import { landingEn } from "./en/landing";
import { liveInboxEn } from "./en/liveInbox";
import { liveOperatorEn } from "./en/liveOperator";
import { liveScoutEn } from "./en/liveScout";
import { liveSettingsEn } from "./en/liveSettings";
import { operatorEn } from "./en/operator";
import { scoutEn } from "./en/scout";
import { settingsEn } from "./en/settings";
import type { Dict } from "./types";

/** Complete English product dictionary. No locale falls back between dictionaries. */
export const en = {
  common: commonEn,
  appRoutes: appRoutesEn,
  liveOperator: liveOperatorEn,
  liveSettings: liveSettingsEn,
  liveScout: liveScoutEn,
  liveInbox: liveInboxEn,
  scout: scoutEn,
  settings: settingsEn,
  operator: operatorEn,
  landing: landingEn,
} as const satisfies Dict;
