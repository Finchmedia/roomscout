export const MUSIC_CONTEXT_IMPORT_PROMPT = `I am setting up RoomScout, an assistant that helps musicians and bands find rehearsal rooms and compatible room-sharing partners.

Based only on things I have explicitly told you in our previous conversations, create a concise context export about my music life. Include useful facts such as:
- bands, projects, members, roles, and instruments
- genres, influences, sound, working style, and musical direction
- rehearsal habits, schedules, locations, mobility, and travel limits
- instruments, equipment, storage, noise, access, and technical needs
- room budget, room type, preferred districts, and deal-breakers
- openness to sharing a room and what would make another band compatible
- current goals and relevant unresolved questions

Keep distinctions between me, other people, and bands clear. Mark uncertain or outdated information as uncertain. Do not guess. Do not include passwords, authentication details, financial account data, health information, exact home addresses, private contact details, or unrelated personal information.

Return plain text with clear headings and bullet points. I will review the result before RoomScout stores any extracted facts.`;

