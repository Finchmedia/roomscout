import { generateText, Output } from "ai";
import type { z } from "zod";
import { structuredConvexGateway } from "./integrations/structuredConvexGateway";
import type { LanguageModelV4 } from "@ai-sdk/provider";

export const ROOMSCOUT_MODEL_ID = "openai/gpt-5.6-terra" as const;

export const roomScoutLanguageModel =
  structuredConvexGateway(ROOMSCOUT_MODEL_ID);

let activeRoomScoutLanguageModel: LanguageModelV4 = roomScoutLanguageModel;
let testOverrideActive = false;

export function getRoomScoutLanguageModel(): LanguageModelV4 {
  return activeRoomScoutLanguageModel;
}

/** Local convex-test/eval seam. It is deliberately unavailable in deployed
 * runtimes and serialized because the model holder is process-global. */
export async function withRoomScoutLanguageModelForTest<T>(
  model: LanguageModelV4,
  run: () => Promise<T>,
): Promise<T> {
  if (process.env.NODE_ENV !== "test") throw new Error("ROOMSCOUT_MODEL_OVERRIDE_FORBIDDEN");
  if (testOverrideActive) throw new Error("ROOMSCOUT_MODEL_OVERRIDE_CONCURRENT");
  const previous = activeRoomScoutLanguageModel;
  testOverrideActive = true;
  activeRoomScoutLanguageModel = model;
  try {
    return await run();
  } finally {
    activeRoomScoutLanguageModel = previous;
    testOverrideActive = false;
  }
}

export async function generateRoomScoutObject<T>(args: {
  schema: z.ZodType<T>;
  instructions: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<T> {
  const result = await generateText({
    model: getRoomScoutLanguageModel(),
    output: Output.object({ schema: args.schema }),
    instructions: args.instructions,
    prompt: args.prompt,
    ...(args.timeoutMs ? { abortSignal: AbortSignal.timeout(args.timeoutMs), maxRetries: 1 } : {}),
  });
  return args.schema.parse(result.output);
}
