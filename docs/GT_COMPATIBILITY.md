# General Translation: EN/DE compatibility experiment

Status: isolated experiment, September 16, 2026. The production app still uses
its existing `useCopy`/`LocaleProvider` and English/German dictionaries. No GT
runtime, new language, location coverage, account or translation subscription
has been added.

## What the test proves

Run `npm run test:gt` from the application root. It:

1. Exports eight representative strings from the actual English dictionary as
   JSON: settings navigation, greeting, singular/plural search facts, location
   interpolation, human commitment, hangup and privacy copy. No account data,
   conversations or listing records are exported.
2. Runs the pinned `gt@2.21.2 translate --dry-run` CLI against this isolated
   source file with English as source and German as the only target.
3. Checks the existing German copy after the same JSON exchange for matching
   keys, nonempty strings, plural forms and unchanged interpolation tokens.
4. Loads the exchanged files into RoomScout's actual dictionary provider and
   renders a small UI through `useCopy` and `LanguageToggle`. The test switches
   EN → DE → EN and verifies interpolation, plurals, persistence and that the
   mounted conversation draft remains intact.

The first execution passed CLI discovery and the dictionary/UI proof. **This
does not prove hosted GT translation quality:** the dry run sends no files to
GT and uses our existing German translations for the UI part. Generated
artifacts and the result summary live in the gitignored
`artifacts/gt-compatibility/` directory.

## Running the real hosted translation check

Provide `GT_API_KEY` and `GT_PROJECT_ID` in the shell environment or the ignored
`.env.local`, then run:

```sh
npm run test:gt -- --translate
```

Use a project intended for this English-to-German experiment. This command
sends the small public-copy sample and per-key tone instructions to the GT
translation service. It downloads German output and runs the same structural
and UI checks against that output. A previous API output is removed before the
request so stale output cannot pass as a fresh result. Missing credentials or
a failed CLI step cause a failed check; the script never substitutes the
existing dictionary in API mode. API credentials stay outside source and
browser code. Review the generated German for tone and meaning separately;
the test can detect missing tokens but cannot certify translation quality.

## Adoption decision

The small integration boundary is **GT CLI → local dictionaries → existing
RoomScout locale state**. The initial local check supports trying this path;
adoption still depends on the hosted EN/DE result. Copy generation can run
before a release without a translation request in the voice-response path.

Before broader adoption, extract the remaining visible literals and choose a
consistent source/export format. Keep the currently reviewed translations until
their generated replacements are reviewed. Do not auto-translate stored user
facts, original provider evidence or quoted receipts as part of this UI test.

The default `gt-react` locale setter reloads the page, which would interrupt a
Live session. This experiment deliberately retains RoomScout's in-place locale
switch. Its mounted-state test checks that integration boundary; it is not a
real WebRTC/audio proof.

## Official references

- [CLI JSON format](https://generaltranslation.com/en-US/docs/cli/reference/formats/json-files.mdx)
- [Translate command and dry run](https://generaltranslation.com/en-US/docs/cli/reference/commands/translate.mdx)
- [Keyed translation context](https://generaltranslation.com/en-US/docs/cli/reference/keyed-metadata.mdx)
- [React locale setter behavior](https://generaltranslation.com/en-US/docs/react/reference/hooks/use-set-locale.mdx)
