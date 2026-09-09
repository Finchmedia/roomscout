import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
} from "@ai-sdk/provider";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

type BridgeArgs = { requestJson: string; callIndex: number };
type BridgeResult = { responseJson: string; model: "openai/gpt-5.6-terra" };
const generate = makeFunctionReference<"action", BridgeArgs, BridgeResult>("evaluationGateway:generate");
const execFileAsync = promisify(execFile);
const DEVELOPMENT_DEPLOYMENT = "perceptive-antelope-445";

export function gatewayBridgeConfigured(): boolean {
  return Boolean(process.env.EVALITE_CONVEX_URL);
}

export function createGatewayBridgeModel(): { model: LanguageModelV4; getCallCount: () => number } {
  const deploymentUrl = process.env.EVALITE_CONVEX_URL;
  const authToken = process.env.EVALITE_CONVEX_AUTH_TOKEN;
  if (!deploymentUrl) throw new Error("EVAL_BACKEND_NOT_CONFIGURED");
  const expectedUrl = "https://perceptive-antelope-445.eu-west-1.convex.cloud";
  if (deploymentUrl.replace(/\/$/, "") !== expectedUrl) throw new Error("EVAL_GATEWAY_DEVELOPMENT_ONLY");
  const client = authToken ? new ConvexHttpClient(deploymentUrl) : null;
  if (client && authToken) client.setAuth(authToken);
  let callIndex = 0;
  const model: LanguageModelV4 = {
    specificationVersion: "v4",
    provider: "convex-evaluation-gateway",
    modelId: "openai/gpt-5.6-terra",
    supportedUrls: {},
    async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
      if (callIndex >= 48) throw new Error("EVAL_GATEWAY_CALL_LIMIT");
      const serializable = { ...options };
      delete serializable.abortSignal;
      delete serializable.headers;
      delete serializable.providerOptions;
      const args = { requestJson: JSON.stringify(serializable), callIndex: callIndex++ };
      let response: BridgeResult;
      try {
        response = client
          ? await client.action(generate, args)
          : JSON.parse((await execFileAsync("npx", ["convex", "run", "--deployment", DEVELOPMENT_DEPLOYMENT,
            "evaluationGateway:generateInternal", JSON.stringify(args), "--typecheck", "disable", "--codegen", "disable"], {
            timeout: 150_000, maxBuffer: 400_000,
          })).stdout) as BridgeResult;
      } catch {
        throw new Error("EVAL_GATEWAY_CLI_FAILED");
      }
      if (response.model !== "openai/gpt-5.6-terra") throw new Error("EVAL_GATEWAY_MODEL_MISMATCH");
      try {
        return JSON.parse(response.responseJson) as LanguageModelV4GenerateResult;
      } catch {
        throw new Error("EVAL_GATEWAY_RESPONSE_INVALID");
      }
    },
    async doStream(): Promise<never> {
      throw new Error("EVAL_GATEWAY_STREAM_UNSUPPORTED");
    },
  };
  return { model, getCallCount: () => callIndex };
}
