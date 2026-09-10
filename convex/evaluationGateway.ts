import type { LanguageModelV4CallOptions, LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { ConvexError, v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { roomScoutLanguageModel, ROOMSCOUT_MODEL_ID } from "./ai";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";
import { internal } from "./_generated/api";

const DEV_CLOUD_URL = "https://perceptive-antelope-445.eu-west-1.convex.cloud";
const DEV_SITE_URL = "https://perceptive-antelope-445.eu-west-1.convex.site";
const MAX_REQUEST_BYTES = 160_000;
const MAX_RESPONSE_BYTES = 160_000;

function assertDevelopment(): void {
  if (envValue("CONVEX_CLOUD_URL") !== DEV_CLOUD_URL && envValue("CONVEX_SITE_URL") !== DEV_SITE_URL) {
    throw new ConvexError({ code: "EVAL_GATEWAY_DEVELOPMENT_ONLY" });
  }
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedJson(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 40_000;
  if (Array.isArray(value)) return value.length <= 100 && value.every((item) => boundedJson(item, depth + 1));
  const record = jsonRecord(value);
  if (!record || Object.keys(record).length > 40 ||
    Object.hasOwn(record, "__proto__") || Object.hasOwn(record, "constructor")) return false;
  return Object.entries(record).every(([key, item]) => key.length <= 100 && boundedJson(item, depth + 1));
}

function validPrompt(prompt: unknown[]): boolean {
  return prompt.every((message) => {
    const record = jsonRecord(message);
    if (!record || !["system", "user", "assistant", "tool"].includes(String(record.role))) return false;
    if (record.role === "system") return typeof record.content === "string" && record.content.length <= 120_000;
    if (!Array.isArray(record.content) || record.content.length > 40) return false;
    return record.content.every((part) => {
      const content = jsonRecord(part);
      return !!content && typeof content.type === "string" &&
        ["text", "reasoning", "file", "tool-call", "tool-result", "tool-approval-response"].includes(content.type) &&
        boundedJson(content);
    });
  });
}

function validTools(tools: unknown): boolean {
  if (tools === undefined) return true;
  if (!Array.isArray(tools) || tools.length > 12) return false;
  return tools.every((tool) => {
    const record = jsonRecord(tool);
    if (!record || record.type !== "function" || typeof record.name !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(record.name)) return false;
    if (record.description !== undefined && (typeof record.description !== "string" || record.description.length > 8_000)) return false;
    return boundedJson(record.inputSchema);
  });
}

export function parseGatewayRequest(requestJson: string): LanguageModelV4CallOptions {
  if (new TextEncoder().encode(requestJson).length > MAX_REQUEST_BYTES) throw new Error("EVAL_GATEWAY_INPUT_INVALID");
  const parsed: unknown = JSON.parse(requestJson);
  const record = jsonRecord(parsed);
  const allowedKeys = new Set([
    "prompt", "maxOutputTokens", "temperature", "topP", "topK", "presencePenalty",
    "frequencyPenalty", "stopSequences", "responseFormat", "seed", "tools", "toolChoice",
    "includeRawChunks", "reasoning",
  ]);
  if (!record || Object.keys(record).some((key) => !allowedKeys.has(key)) ||
    !Array.isArray(record.prompt) || record.prompt.length === 0 || record.prompt.length > 80 ||
    !validPrompt(record.prompt)) {
    throw new Error("EVAL_GATEWAY_INPUT_INVALID");
  }
  if (!validTools(record.tools) ||
    (record.responseFormat !== undefined && !boundedJson(record.responseFormat)) ||
    (record.toolChoice !== undefined && !boundedJson(record.toolChoice))) {
    throw new Error("EVAL_GATEWAY_INPUT_INVALID");
  }
  if (record.maxOutputTokens !== undefined &&
    (typeof record.maxOutputTokens !== "number" || !Number.isInteger(record.maxOutputTokens) || record.maxOutputTokens < 1 || record.maxOutputTokens > 8_000)) {
    throw new Error("EVAL_GATEWAY_INPUT_INVALID");
  }
  for (const key of ["temperature", "topP", "topK", "presencePenalty", "frequencyPenalty", "seed"] as const) {
    const value = record[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) throw new Error("EVAL_GATEWAY_INPUT_INVALID");
  }
  if (record.stopSequences !== undefined && (!Array.isArray(record.stopSequences) || record.stopSequences.length > 8 ||
    record.stopSequences.some((item) => typeof item !== "string" || item.length > 200))) throw new Error("EVAL_GATEWAY_INPUT_INVALID");
  if (record.includeRawChunks !== undefined && record.includeRawChunks !== false) throw new Error("EVAL_GATEWAY_INPUT_INVALID");
  if (record.reasoning !== undefined && !["provider-default", "none", "minimal", "low", "medium", "high", "xhigh"].includes(String(record.reasoning))) {
    throw new Error("EVAL_GATEWAY_INPUT_INVALID");
  }
  return parsed as LanguageModelV4CallOptions;
}

function serializeResult(result: LanguageModelV4GenerateResult): string {
  const responseJson = JSON.stringify({
    content: result.content,
    finishReason: result.finishReason,
    usage: result.usage,
    warnings: result.warnings,
  });
  if (new TextEncoder().encode(responseJson).length > MAX_RESPONSE_BYTES) throw new Error("EVAL_GATEWAY_RESPONSE_INVALID");
  return responseJson;
}

async function generateCore(
  args: { requestJson: string; callIndex: number },
): Promise<{ responseJson: string; model: typeof ROOMSCOUT_MODEL_ID }> {
  assertDevelopment();
  if (!Number.isInteger(args.callIndex) || args.callIndex < 0 || args.callIndex >= 48) {
    throw new ConvexError({ code: "EVAL_GATEWAY_CALL_LIMIT" });
  }
  let request: LanguageModelV4CallOptions;
  try {
    request = parseGatewayRequest(args.requestJson);
  } catch {
    throw new ConvexError({ code: "EVAL_GATEWAY_INPUT_INVALID" });
  }
  try {
    const result = await roomScoutLanguageModel.doGenerate({
      ...request,
      abortSignal: AbortSignal.timeout(120_000),
    });
    return { responseJson: serializeResult(result), model: ROOMSCOUT_MODEL_ID };
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    throw new ConvexError({ code: "EVAL_GATEWAY_GENERATION_FAILED" });
  }
}

export const generate = action({
  args: { requestJson: v.string(), callIndex: v.number() },
  returns: v.object({ responseJson: v.string(), model: v.literal(ROOMSCOUT_MODEL_ID) }),
  handler: async (ctx, args): Promise<{ responseJson: string; model: typeof ROOMSCOUT_MODEL_ID }> => {
    const ownerId = await requireActionUserId(ctx);
    const operator = await ctx.runQuery(internal.users.isOperatorInternal, { userId: ownerId });
    if (!operator) throw new ConvexError({ code: "FORBIDDEN" });
    return await generateCore(args);
  },
});

/** Narrow trusted CLI bridge for the local in-memory evaluator. */
export const generateInternal = internalAction({
  args: { requestJson: v.string(), callIndex: v.number() },
  returns: v.object({ responseJson: v.string(), model: v.literal(ROOMSCOUT_MODEL_ID) }),
  handler: async (_ctx, args): Promise<{ responseJson: string; model: typeof ROOMSCOUT_MODEL_ID }> =>
    await generateCore(args),
});
