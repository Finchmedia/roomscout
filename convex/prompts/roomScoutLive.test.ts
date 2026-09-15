import { describe, expect, it } from "vitest";
import { liveInstructions, scoutVoiceInstructions } from "./roomScoutLive";

describe("RoomScout Live prompts", () => {
  it("keeps English questions grounded in genuine gaps and uses an English search action", () => {
    const prompt = liveInstructions(
      "en",
      "Active search: rehearsal room; arrangements=shared; requirements=secure storage. No market signal is attached.",
    );

    expect(prompt).toContain("never recap it");
    expect(prompt).toContain("briefly acknowledge the one fact that was just corrected");
    expect(prompt).toContain("a saved shared-room arrangement already answers whether the musician is open to sharing");
    expect(prompt).toContain("Wanting to leave gear is a storage requirement, not a reason to ask about security");
    expect(prompt).toContain("A saved requirement says what the musician needs, not what a candidate room provides");
    expect(prompt).toContain('can "start the search"');
    expect(prompt).not.toContain("Scout losschicken");
  });

  it("keeps German storage answers provisional until a room capability is verified", () => {
    const prompt = liveInstructions(
      "de",
      "Aktiver Suchauftrag: Raumteilung; Anforderungen=Lagerung. Kein Raum ausgewählt.",
    );

    expect(prompt).toContain("Fasse ihn nie zusammen");
    expect(prompt).toContain("ist für sich kein neuer Fakt");
    expect(prompt).toContain("beschreibt, was der Musiker braucht, nicht was ein Raum bietet");
    expect(prompt).toContain("RoomScout noch klären muss, ob ein Raum oder Anbieter sie erfüllt");
    expect(prompt).not.toContain("Scout losschicken");
  });

  it("repeats the requirement-versus-capability boundary in concise Scout results", () => {
    expect(scoutVoiceInstructions("en")).toContain("A saved requirement is not evidence of a room capability");
    expect(scoutVoiceInstructions("de")).toContain("Eine gespeicherte Anforderung belegt keine Eigenschaft eines Raums");
  });
});
