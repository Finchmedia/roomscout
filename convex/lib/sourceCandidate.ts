import { redactPublicText } from "./privacy";
import {
  canonicalDomain,
  canonicalizeUrl,
} from "../integrations/urlCanonicalization";

export type RawDiscoveryHit = {
  url: string;
  title?: string;
  description?: string;
};

export type NormalizedDiscoveryCandidate = {
  canonicalKey: string;
  canonicalUrl: string;
  canonicalDomain: string;
  title: string;
  snippet: string;
};

const NON_SOURCE_HOSTS = new Set([
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
]);

export function normalizeDiscoveryHit(
  hit: RawDiscoveryHit,
): NormalizedDiscoveryCandidate | null {
  const canonicalUrl = canonicalizeUrl(hit.url);
  const domain = canonicalDomain(hit.url);
  if (canonicalUrl === null || domain === null || NON_SOURCE_HOSTS.has(domain)) {
    return null;
  }
  const title = redactPublicText(hit.title ?? "").slice(0, 500);
  const snippet = redactPublicText(hit.description ?? "").slice(0, 2_000);
  return {
    canonicalKey: `${domain}:${canonicalUrl}`,
    canonicalUrl,
    canonicalDomain: domain,
    title: title || domain,
    snippet,
  };
}
