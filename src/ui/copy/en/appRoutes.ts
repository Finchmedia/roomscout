import type { DeepWiden } from "../types";
import type { appRoutesDe } from "../de/appRoutes";

export const appRoutesEn = {
  restoring: "Restoring your session …",
  checkingOperator: "Checking operator access …",
  operatorTitle: "Operators only.",
  operatorDetail: "You can use the Scout with your account. The operator view is available to authorized accounts.",
  scout: "Go to Scout",
  errorTitle: "This view could not be loaded.",
  errorDetail: "Try again. Your saved data is still here.",
  reload: "Reload",
  home: "Back to home",
  profileMenu: "Profile menu",
  settings: "Settings",
  messages: "Messages",
  operator: "Operator view",
  signOut: "Sign out",
  signOutError: "Signing out did not work. Please try again.",
  auth: {
    personalScout: "Your personal RoomScout",
    signUpTitle: "Your next rehearsal room starts here.",
    signUpSubtitle: "One conversation. One search. Your Scout stays on it.",
    signInTitle: "Welcome back.",
    signInSubtitle: "Your search and conversations are waiting for you.",
  },
} as const satisfies DeepWiden<typeof appRoutesDe>;
