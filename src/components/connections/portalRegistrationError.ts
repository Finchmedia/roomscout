type RegistrationErrorData = {
  code?: unknown;
  kind?: unknown;
  name?: unknown;
  retryAfter?: unknown;
};

const MAX_DISPLAYED_RETRY_MS = 30 * 24 * 60 * 60 * 1_000;

function errorData(error: unknown): RegistrationErrorData | undefined {
  if (!error || typeof error !== "object") return undefined;
  const data = (error as { data?: unknown }).data;
  return data && typeof data === "object"
    ? (data as RegistrationErrorData)
    : undefined;
}

function retryTimeLabel(retryAfter: number): string {
  const boundedMs = Math.min(
    Math.max(retryAfter, 1_000),
    MAX_DISPLAYED_RETRY_MS,
  );
  const minutes = Math.max(1, Math.ceil(boundedMs / 60_000));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const remainingMinutes = minutes % 60;

  if (days > 0) {
    return hours > 0
      ? `${days} day${days === 1 ? "" : "s"} and ${hours} hour${hours === 1 ? "" : "s"}`
      : `${days} day${days === 1 ? "" : "s"}`;
  }
  if (hours > 0) {
    return remainingMinutes > 0
      ? `${hours} hour${hours === 1 ? "" : "s"} and ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`
      : `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function portalRegistrationErrorMessage(error: unknown): string {
  const data = errorData(error);
  if (
    data?.kind === "RateLimited" &&
    (data.name === "portalAuthSource" || data.name === "portalSessionGlobal" || data.name === "portalAuthRecovery") &&
    typeof data.retryAfter === "number" &&
    Number.isFinite(data.retryAfter)
  ) {
    const reason = data.name === "portalAuthSource"
      ? "RoomScout has reached its registration limit for this portal."
      : data.name === "portalAuthRecovery"
        ? "The failed setup has already been reset for this daily window."
        : "RoomScout has reached its shared browser-session limit.";
    return `${reason} Try again in ${retryTimeLabel(data.retryAfter)}.`;
  }

  if (data?.code === "REGISTRATION_RECOVERY_NOT_AVAILABLE" ||
    data?.code === "CONTROLLED_REGISTRATION_RECOVERY_REJECTED") {
    return "Only a failed browser startup on the reviewed demo portal can be reset. Existing registrations and active sessions are left unchanged.";
  }

  if (
    typeof data?.code === "string" &&
    data.code.startsWith("AGENT_REGISTRATION_BROWSER_LAUNCH_")
  ) {
    return "Browserbase could not open the secure registration browser. Check the Browserbase account capacity, then try again.";
  }

  return "The controlled portal registration could not be started. Please try again later.";
}
