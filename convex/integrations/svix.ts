const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

function decodeBase64(value: string): ArrayBuffer {
  const decoded = atob(value);
  const buffer = new ArrayBuffer(decoded.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return buffer;
}

export async function verifySvixWebhook(input: {
  body: string;
  messageId: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowMs?: number;
}): Promise<boolean> {
  if (!input.messageId || !input.timestamp || !input.signature) {
    return false;
  }

  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestamp) > MAX_WEBHOOK_AGE_SECONDS) {
    return false;
  }

  try {
    const secret = input.secret.startsWith("whsec_")
      ? input.secret.slice("whsec_".length)
      : input.secret;
    const key = await crypto.subtle.importKey(
      "raw",
      decodeBase64(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signedContent = new TextEncoder().encode(
      `${input.messageId}.${input.timestamp}.${input.body}`,
    );

    for (const candidate of input.signature.split(" ")) {
      const [version, encodedSignature] = candidate.split(",", 2);
      if (version !== "v1" || !encodedSignature) {
        continue;
      }
      const isValid = await crypto.subtle.verify(
        "HMAC",
        key,
        decodeBase64(encodedSignature),
        signedContent,
      );
      if (isValid) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}
