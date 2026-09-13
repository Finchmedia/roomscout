export const REVIEWED_PORTAL_ORIGIN = "https://roomscout.dev";

export function reviewedPortalUrl(
  rawUrl: string,
  errorCode = "PORTAL_URL_NOT_ALLOWED",
): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(errorCode);
  }
  if (
    parsed.origin !== REVIEWED_PORTAL_ORIGIN ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(errorCode);
  }
  return parsed.toString();
}

export function reviewedPortalPath(path: string): string {
  return reviewedPortalUrl(new URL(path, REVIEWED_PORTAL_ORIGIN).toString());
}

export function isReviewedPortalUrl(rawUrl: string): boolean {
  try {
    reviewedPortalUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
