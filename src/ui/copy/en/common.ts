import type { DeepWiden } from "../types";
import type { commonDe } from "../de/common";

export const commonEn = {
  copyFailedToast: "Copying did not work. Select the text and copy it manually.",
  saved: "Saved",
  cancel: "Cancel",
  back: "Back",
  close: "Close",
  notifications: "Notifications",
  details: "Details",
  demoName: "Herzbuben",
  save: "Save",
  apply: "Apply",
  discard: "Discard",
  next: "Continue",
  language: {
    toggleAria: "Language",
    shortDe: "DE",
    shortEn: "EN",
  },
} as const satisfies DeepWiden<typeof commonDe>;
