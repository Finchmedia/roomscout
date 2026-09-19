/**
 * „Nachrichten“ — the musician's own view of the Anbieter conversations.
 *
 * Everything the surface says about a conversation lives here: the list rows,
 * the thread header, the message speakers, the composer and every reason a
 * reply is waiting instead of going out. The Freigabeprüfung's own sentences
 * come from the backend (`gateReasonText`) and are never restated here.
 */
export const liveInboxDe = {
  title: "Nachrichten",
  navAria: "Nachrichten",
  messagesAria: "Nachrichtenverlauf",
  scrollToEnd: "Zu den neuesten Nachrichten",

  count: { one: "{count} Unterhaltung", other: "{count} Unterhaltungen" },

  loading: "Deine Unterhaltungen werden geladen …",
  threadLoading: "Die Unterhaltung wird geladen …",
  notFound: "Diese Unterhaltung gibt es nicht mehr.",
  empty: "Noch keine Unterhaltungen. Sobald dein Scout einen Anbieter kontaktiert, erscheint sie hier.",
  emptyAction: "Zum Scout",
  emptyThread: "Dein Scout bereitet die erste Nachricht vor.",
  emptyHistory: "Noch keine Nachrichten zum Anzeigen.",
  emptyChecking: "Dein Scout prüft diesen Kandidaten.",
  emptyContactNotReady: "Dieser Kandidat wurde noch nicht kontaktiert.",
  selectHint: "Wähle links eine Unterhaltung.",

  provider: "Anbieter",
  scout: "Dein Scout",
  you: "Du",
  youToScout: "Du an deinen Scout",

  previewProvider: "Anbieter: {text}",
  previewScout: "Dein Scout: {text}",
  previewYou: "Du: {text}",

  unread: "Neue Nachricht",
  stateOfferReady: "Angebot liegt vor",
  stateThinking: "Scout wertet aus",

  channelPortal: "Portal",
  channelMail: "E-Mail",
  channelNone: "Noch kein Kanal",
  subtitle: "{city} · {label}",
  subtitleChannelOnly: "{label}",

  scoutUpdate: "Scout-Update",
  privateScoutQuestion: "Private Scout-Frage",
  scoutQuestion: "Frage deines Scouts",
  yourAnswer: "Deine Antwort",
  decisionAnsweredState: "Beantwortet",
  decisionAnsweredUnknown: "beantwortet",

  pendingSending: "Wird gesendet …",
  pendingApproval: "Wartet auf deine Freigabe",
  pendingApprovalAction: "Entscheidung öffnen",
  /** A Zusage waits for the binding approval, which is its own dialog, not a chat detour. */
  pendingAcceptance: "Zusage wartet auf deine Freigabe",
  pendingAcceptanceAction: "Zusage prüfen",
  pendingFailed: "Konnte nicht gesendet werden.",
  pendingBlocked: "Dein Scout darf das gerade nicht senden.",
  pendingDrafted: "Dein Scout bereitet den Versand vor.",
  pendingOutcomeUnknown: "Der Versand konnte nicht bestätigt werden.",
  deliverySent: "Gesendet",
  deliveryDelivered: "Zugestellt",
  deliveryFailed: "Zustellung fehlgeschlagen",

  composerPlaceholder: "Nachricht an den Anbieter …",
  composerSend: "Senden",
  composerSending: "Deine Nachricht wird übergeben …",
  composerStatus: "Gesprächsstatus",
  composerRestore: "Fehlgeschlagenen Entwurf wiederherstellen",

  hintThinking: "Dein Scout wertet gerade aus …",
  hintClosed: "Diese Unterhaltung ist beendet.",
  hintChannelNotReady: "Der Anbieter kann aktuell nicht erreicht werden.",
  hintAssessmentRequired: "Dein Scout prüft noch die letzte Antwort.",
  hintDrafted: "Dein Scout bereitet diese Nachricht vor.",
  hintAwaitingApproval: "Diese Nachricht wartet auf deine Freigabe.",
  hintSending: "Dein Scout sendet diese Nachricht gerade.",
  hintSendFailed: "Diese Nachricht wurde nicht gesendet.",
  hintDeliveryFailed: "Die Zustellung ist fehlgeschlagen.",
  hintAwaitingReply: "Deine Nachricht wurde gesendet. Dein Scout wartet auf die Antwort des Anbieters.",
  hintOutcomeUnknown: "Der Versand konnte nicht bestätigt werden. Prüfe den Verlauf, bevor du es erneut versuchst.",
  assessmentFailed: "Die Prüfung dieses Raums konnte nicht abgeschlossen werden.",
  retryAssessment: "Prüfung wiederholen",
  retrying: "Wird erneut geprüft …",

  errorNotFound: "Diese Unterhaltung gibt es nicht mehr.",
  errorClosed: "Diese Unterhaltung ist beendet.",
  errorAssessmentRequired: "Dein Scout prüft noch die letzte Antwort. Gleich kannst du wieder schreiben.",
  errorContextChanged: "Der Suchauftrag hat sich geändert. Dein Scout prüft das Gespräch neu.",
  errorChannelNotReady: "Der Anbieter kann aktuell nicht erreicht werden.",
  errorInvalidBody: "Diese Nachricht kann so nicht gesendet werden.",
  errorGeneric: "Das hat gerade nicht geklappt. Versuche es erneut.",
} as const;
