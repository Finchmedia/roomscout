import { generateText, Output } from "ai";
import type { z } from "zod";
import { structuredConvexGateway } from "./integrations/structuredConvexGateway";

export const ROOMSCOUT_MODEL_ID = "openai/gpt-5.6-terra" as const;

export const roomScoutLanguageModel =
  structuredConvexGateway(ROOMSCOUT_MODEL_ID);

export async function generateRoomScoutObject<T>(args: {
  schema: z.ZodType<T>;
  instructions: string;
  prompt: string;
}): Promise<T> {
  const result = await generateText({
    model: roomScoutLanguageModel,
    output: Output.object({ schema: args.schema }),
    instructions: args.instructions,
    prompt: args.prompt,
  });
  return args.schema.parse(result.output);
}
