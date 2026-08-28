function fnv1a32(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function stableFingerprint(input: string): string {
  return `v1:${fnv1a32(input, 0x811c9dc5)}${fnv1a32(
    input,
    0x9e3779b9,
  )}`;
}
