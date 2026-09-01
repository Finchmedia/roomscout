const LABELED_CODE =
  /(?:verification|verify|security|confirmation|one[ -]?time|otp|code|bestätigungs|verifizierungs|sicherheits|einmal(?:code|passwort))[^0-9]{0,48}([0-9]{4,8})/gi;
const STANDALONE_CODE = /(?:^|[^0-9])([0-9]{6})(?=$|[^0-9])/g;

function plausible(code: string): boolean {
  return !/^0+$/.test(code) && !/^(19|20)\d{2}$/.test(code);
}

/**
 * Extract a single unambiguous short-lived verification code. The message is
 * untrusted input; this function never executes markup, links, or instructions.
 */
export function extractPortalVerificationCode(input: string): string | null {
  const normalized = input.replace(/<[^>]*>/g, " ").slice(0, 100_000);
  const labeled = new Set<string>();
  for (const match of normalized.matchAll(LABELED_CODE)) {
    if (match[1] && plausible(match[1])) labeled.add(match[1]);
  }
  if (labeled.size === 1) return [...labeled][0] ?? null;
  if (labeled.size > 1) return null;

  const standalone = new Set<string>();
  for (const match of normalized.matchAll(STANDALONE_CODE)) {
    if (match[1] && plausible(match[1])) standalone.add(match[1]);
  }
  return standalone.size === 1 ? ([...standalone][0] ?? null) : null;
}

export function isRelevantPortalVerificationMessage(input: {
  from: string;
  subject: string;
  body: string;
  portalDomain: string;
}): boolean {
  const haystack = `${input.from}\n${input.subject}\n${input.body.slice(0, 5_000)}`.toLowerCase();
  const portal = input.portalDomain.toLowerCase().replace(/^www\./, "");
  const portalLabel = portal.split(".")[0] ?? portal;
  return (
    /verify|verification|confirmation|one[ -]?time|otp|code|bestätig|verifiz|einmal/.test(
      haystack,
    ) &&
    (haystack.includes(portal) || haystack.includes(portalLabel))
  );
}
