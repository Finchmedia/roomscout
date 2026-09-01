const encoder = new TextEncoder();

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

/**
 * Compares secret-bearing strings after hashing both inputs to a fixed length.
 * The final byte comparison does not branch on the first mismatch. JavaScript
 * runtimes cannot promise machine-level constant time, so this is defense in
 * depth rather than a substitute for rate limiting and secret rotation.
 */
export async function constantTimeSecretMatches(
  candidate: string | null,
  expected: string,
): Promise<boolean> {
  const [candidateHash, expectedHash] = await Promise.all([
    sha256(candidate ?? ""),
    sha256(expected),
  ]);
  let difference = candidate === null ? 1 : 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= candidateHash[index]! ^ expectedHash[index]!;
  }
  return difference === 0;
}
