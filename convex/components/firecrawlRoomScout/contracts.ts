export function firecrawlId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 300) {
    throw new Error(`INVALID_FIRECRAWL_${label.toUpperCase()}`);
  }
  return encodeURIComponent(normalized);
}

export function queryString(
  values: Record<string, string | number | boolean | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function normalizeInteractArgs(args: {
  code?: string;
  prompt?: string;
  language?: "node" | "python" | "bash";
  timeout?: number;
}) {
  const code = args.code?.trim();
  const prompt = args.prompt?.trim();
  if ((!code && !prompt) || (code && prompt)) {
    throw new Error("FIRECRAWL_INTERACT_REQUIRES_EXACTLY_ONE_INPUT");
  }
  if (code && code.length > 100_000) {
    throw new Error("FIRECRAWL_INTERACT_CODE_TOO_LONG");
  }
  if (prompt && prompt.length > 10_000) {
    throw new Error("FIRECRAWL_INTERACT_PROMPT_TOO_LONG");
  }
  const timeout = args.timeout === undefined
    ? undefined
    : Math.max(1, Math.min(300, Math.floor(args.timeout)));
  return {
    ...(code ? { code } : {}),
    ...(prompt ? { prompt } : {}),
    language: args.language ?? "node",
    ...(timeout !== undefined ? { timeout } : {}),
  };
}
