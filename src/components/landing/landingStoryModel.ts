export type StoryFact = { id: string; label: string };

export const storyLines: Array<{ text: string; changes: StoryFact[] }> = [
  {
    text: "Wir sind zu viert und suchen einen geteilten Proberaum in Stuttgart.",
    changes: [
      { id: "location", label: "Stuttgart & Umgebung" },
      { id: "room", label: "Geteilter Raum · 4 Personen" },
    ],
  },
  {
    text: "Bis 400 Euro im Monat. Unser Schlagzeug soll dort bleiben können.",
    changes: [
      { id: "budget", label: "Bis 400 € / Monat" },
      { id: "drums", label: "Schlagzeug darf im Raum bleiben" },
    ],
  },
  {
    text: "Am liebsten donnerstags ab 19 Uhr.",
    changes: [{ id: "schedule", label: "Donnerstags ab 19 Uhr" }],
  },
  {
    text: "Eigentlich lieber maximal 350 Euro.",
    changes: [{ id: "budget", label: "Bis 350 € / Monat" }],
  },
];

export function factsAtStage(visibleLineCount: number): StoryFact[] {
  const facts = new Map<string, StoryFact>();
  for (const line of storyLines.slice(0, visibleLineCount))
    for (const change of line.changes) facts.set(change.id, change);
  return [...facts.values()];
}
