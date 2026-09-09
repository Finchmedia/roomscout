/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { parseGatewayRequest } from "./evaluationGateway";
import { providerAssessmentSchema } from "./lib/providerAssessment";
import { z } from "zod";

const modules = import.meta.glob("./**/*.ts");
const generate = makeFunctionReference<"action", {
  requestJson: string;
  callIndex: number;
}, { responseJson: string; model: "openai/gpt-5.6-terra" }>("evaluationGateway:generate");
beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "https://perceptive-antelope-445.eu-west-1.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://perceptive-antelope-445.eu-west-1.convex.site");
});
afterEach(() => vi.unstubAllEnvs());

it("accepts only bounded model call payloads", () => {
  expect(parseGatewayRequest(JSON.stringify({ prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }] }))).toMatchObject({ prompt: expect.any(Array) });
  expect(() => parseGatewayRequest(JSON.stringify({ prompt: [] }))).toThrow("EVAL_GATEWAY_INPUT_INVALID");
  expect(() => parseGatewayRequest(JSON.stringify({ prompt: [{ role: "user" }], tools: Array.from({ length: 13 }, () => ({})) }))).toThrow("EVAL_GATEWAY_INPUT_INVALID");
});

it("accepts the real provider-assessment tool schema and system prompt shape", () => {
  const request = {
    prompt: [
      { role: "system", content: "Room Scout production instructions" },
      { role: "user", content: [{ type: "text", text: "Assess the provider evidence." }] },
    ],
    tools: [{
      type: "function", name: "recordProviderAssessment",
      description: "Record the complete evidence-backed private offer assessment.",
      inputSchema: z.toJSONSchema(providerAssessmentSchema),
    }],
    toolChoice: { type: "auto" },
  };
  expect(parseGatewayRequest(JSON.stringify(request))).toMatchObject({
    tools: [{ name: "recordProviderAssessment" }],
  });
  expect(() => parseGatewayRequest(JSON.stringify({ ...request, headers: { authorization: "never" } })))
    .toThrow("EVAL_GATEWAY_INPUT_INVALID");
});

it("rejects non-operators before any model call", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("users", { username: "not-operator", role: "musician", createdAt: now, lastSeenAt: now });
  });
  await expect(t.withIdentity({ subject: ownerId }).action(generate, {
    requestJson: JSON.stringify({ prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }] }), callIndex: 0,
  })).rejects.toThrow("FORBIDDEN");
});
