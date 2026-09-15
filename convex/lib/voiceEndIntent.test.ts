import { describe, expect, it } from "vitest";
import { rejectsVoiceEndIntent, voiceEndFarewell } from "./voiceEndIntent";

describe("voice call ending intent", () => {
  it.each([
    "Don't hang up.",
    "Leg bitte nicht auf.",
    "What happens if I say 'hang up'?",
    "When I say 'please hang up', do nothing.",
    "The instruction is: hang up.",
    "The caption literally reads “bye”.",
    "Please do not end the call.",
    "She said goodbye.",
    "How do you translate Tschüss?",
    "Stop speaking.",
    "Pause the search.",
    "We should say goodbye to that old requirement.",
  ])("does not end for negative, quoted, hypothetical, or unrelated input: %s", (input) => {
    expect(rejectsVoiceEndIntent(input)).toBe(true);
  });

  it.each([
    "Hang up now, please.",
    "Set Wednesday and bye, see you later!",
    "Mach's gut, wir hören uns.",
  ])("does not veto a semantic end-call decision for: %s", (input) => {
    expect(rejectsVoiceEndIntent(input)).toBe(false);
  });

  it("provides short localized neutral farewells", () => {
    expect(voiceEndFarewell("en", "user_request")).toBe("Okay, I'll end the call now.");
    expect(voiceEndFarewell("de", "farewell")).toBe("Tschüss!");
  });
});
