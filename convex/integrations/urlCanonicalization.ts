const TRACKING_PARAMETER_NAMES = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref_src",
]);

function isTrackingParameter(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_PARAMETER_NAMES.has(normalized);
}

export function canonicalizeUrl(
  value: string,
  baseUrl?: string,
): string | null {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80")
    ) {
      url.port = "";
    }

    for (const name of [...url.searchParams.keys()]) {
      if (isTrackingParameter(name)) {
        url.searchParams.delete(name);
      }
    }
    url.searchParams.sort();

    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/$/, "");
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function sameCanonicalUrl(left: string, right: string): boolean {
  const canonicalLeft = canonicalizeUrl(left);
  const canonicalRight = canonicalizeUrl(right);
  return canonicalLeft !== null && canonicalLeft === canonicalRight;
}

export function canonicalDomain(value: string): string | null {
  const canonical = canonicalizeUrl(value);
  if (canonical === null) return null;
  const hostname = new URL(canonical).hostname;
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}
