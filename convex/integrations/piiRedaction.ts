export type RedactionResult = {
  redacted: string;
  contactDataPresent: boolean;
};

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const MAIL_LINK_PATTERN = /\bmailto:[^\s)\]>]+/gi;
const TEL_LINK_PATTERN = /\btel:[^\s)\]>]+/gi;
const PHONE_CANDIDATE_PATTERN = /(?:\+|00)?\d[\d\s()./-]{6,}\d/g;

function redactPhoneCandidate(candidate: string): string {
  const digitCount = (candidate.match(/\d/g) ?? []).length;
  const hasPhoneFormatting = /[+()\s/-]/.test(candidate);
  return digitCount >= 7 && digitCount <= 16 && hasPhoneFormatting
    ? "[phone redacted]"
    : candidate;
}

export function redactContactData(value: string): RedactionResult {
  let contactDataPresent = false;
  let redacted = value.replace(MAIL_LINK_PATTERN, () => {
    contactDataPresent = true;
    return "mailto:[email redacted]";
  });
  redacted = redacted.replace(TEL_LINK_PATTERN, () => {
    contactDataPresent = true;
    return "tel:[phone redacted]";
  });
  redacted = redacted.replace(EMAIL_PATTERN, () => {
    contactDataPresent = true;
    return "[email redacted]";
  });
  redacted = redacted.replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
    const replacement = redactPhoneCandidate(candidate);
    contactDataPresent ||= replacement !== candidate;
    return replacement;
  });

  return {
    redacted: redacted.replace(/\s+/g, " ").trim(),
    contactDataPresent,
  };
}
