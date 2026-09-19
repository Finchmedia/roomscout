import { generateText, tool } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "./_generated/server";
import { generateRoomScoutObject, getRoomScoutLanguageModel, ROOMSCOUT_UTILITY_MODEL_ID } from "./ai";

/** Two fixed synthetic checks. No database writes, user context or provider messages. */
export const utility = internalAction({
  args: {},
  returns: v.object({ model: v.string(), correctedFacts: v.boolean(), separateQuestions: v.boolean() }),
  handler: async () => {
    const facts = await generateRoomScoutObject({
      modelRole: "utility",
      timeoutMs: 45_000,
      schema: z.object({ city: z.string(), monthlyBudgetEur: z.number(), days: z.array(z.string()) }),
      instructions: "Extract the musician's latest explicit search facts. Corrections replace earlier facts. Use English weekday names.",
      prompt: "We need a room in Berlin for 250 euros per month on Tuesday or Thursday. Correction: raise our monthly budget to 400 euros; the city and days stay the same.",
    });
    const correctedFacts = facts.city === "Berlin" && facts.monthlyBudgetEur === 400
      && facts.days.length === 2 && facts.days.includes("Tuesday") && facts.days.includes("Thursday");
    const roundSchema = z.object({
      questions: z.array(z.object({
        constraint: z.enum(["schedule", "drums"]),
        question: z.string(),
        options: z.array(z.string()).min(2).max(3),
      })).length(2),
    });
    const result = await generateText({
      model: getRoomScoutLanguageModel("utility"),
      abortSignal: AbortSignal.timeout(45_000),
      maxRetries: 0,
      tools: { recordQuestions: tool({
        description: "Record separate questions for the two independent compromises, in English.",
        inputSchema: roundSchema,
      }) },
      toolChoice: { type: "tool", toolName: "recordQuestions" },
      instructions: "Ask one question per independent constraint conflict with clear accept/keep-requirement options. Accepting a different day does not accept different drums.",
      prompt: "The musician wants Tuesday or Thursday and acoustic drums. This provider offers Wednesday only and prohibits acoustic drums but supplies electronic drums. Ask about both compromises using recordQuestions.",
    });
    const calls = result.toolCalls;
    const round = calls.length === 1 ? roundSchema.safeParse(calls[0]?.input) : null;
    const separateQuestions = !!round?.success
      && new Set(round.data.questions.map((question) => question.constraint)).size === 2;
    if (!correctedFacts || !separateQuestions) throw new Error("LUNA_FUNCTIONAL_SMOKE_FAILED");
    return { model: ROOMSCOUT_UTILITY_MODEL_ID, correctedFacts, separateQuestions };
  },
});
