/**
 * Host policy for source discovery. Search engines return a large share of
 * social posts and aggregator pages for every rehearsal-room query; those are
 * never reviewable RoomScout sources, so they are rejected before a candidate
 * row is written. Marketplaces stay discoverable but are marked so an operator
 * decides the terms question before anything is activated.
 */

/** Never becomes a source candidate: search engines, social, aggregators. */
const BLOCKED_HOST_SUFFIXES = [
  "google.com",
  "google.de",
  "bing.com",
  "duckduckgo.com",
  "yandex.com",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "threads.net",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "reddit.com",
  "pinterest.com",
  "pinterest.de",
  "yelp.com",
  "yelp.de",
  "wikipedia.org",
  "wikimedia.org",
  "amazon.de",
  "amazon.com",
  "tripadvisor.de",
  "tripadvisor.com",
  "booking.com",
  "airbnb.de",
  "airbnb.com",
] as const;

/**
 * Discoverable, but the operator must resolve the terms-of-service question
 * before activation. These marketplaces carry real listing volume and their
 * robots/ToS restrict automated access.
 */
const TOS_REVIEW_HOST_SUFFIXES = [
  "kleinanzeigen.de",
  "ebay-kleinanzeigen.de",
  "ebay.de",
  "ebay.com",
  "quoka.de",
  "markt.de",
] as const;

function matchesSuffix(domain: string, suffixes: readonly string[]): boolean {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.length === 0) return false;
  return suffixes.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

/** True when the domain must never become a source candidate. */
export function isBlockedDiscoveryHost(domain: string): boolean {
  return matchesSuffix(domain, BLOCKED_HOST_SUFFIXES);
}

/** True when a candidate needs an explicit terms review before activation. */
export function requiresTosReview(domain: string): boolean {
  return matchesSuffix(domain, TOS_REVIEW_HOST_SUFFIXES);
}

/** Prefix carried in the candidate snippet so /ops shows the flag inline. */
export const TOS_REVIEW_SNIPPET_PREFIX = "[ToS review required] ";
