import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getServiceToken } from "convex/server";

const productionGatewayHost = "https://ai-gateway.convex.dev";

/**
 * Convex AI Gateway adapter with native JSON Schema output enabled.
 *
 * @convex-dev/ai-sdk-provider@0.1.0 currently creates the same
 * OpenAI-compatible provider without declaring this capability. AI SDK then
 * downgrades Output.object() to JSON Object mode and drops the schema even
 * though the Gateway supports response_format.type = "json_schema".
 *
 * Keep this adapter small so it can be removed when the upstream provider
 * exposes or derives the capability itself.
 */
export function structuredConvexGateway(modelId: string) {
  const provider = createOpenAICompatible({
    name: "convexGateway",
    baseURL: `${process.env.CONVEX_INTERNAL_AI_GATEWAY_HOST || productionGatewayHost}/v1`,
    supportsStructuredOutputs: true,
    fetch: async (input, init) => {
      const token = await getServiceToken("ai-gateway");
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return await globalThis.fetch(input, { ...init, headers });
    },
  });

  return provider(modelId);
}
