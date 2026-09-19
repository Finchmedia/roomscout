import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, loadEnv } from "vite";

// A bounded CLI-only experiment. Production keeps useCopy/LocaleProvider and
// its existing EN/DE dictionaries; neither GT nor a reload-based switcher is
// installed into the browser bundle.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "artifacts/gt-compatibility");
const translate = process.argv.includes("--translate");
assert(process.argv.slice(2).every((arg) => arg === "--translate"), "Only --translate is supported.");
const credentials = loadEnv("development", root, "GT_");
if (translate && (!credentials.GT_API_KEY || !credentials.GT_PROJECT_ID)) {
  throw new Error("The real GT check needs GT_API_KEY and GT_PROJECT_ID in the environment or .env.local. Run npm run test:gt for the credential-free dry run.");
}

function select(dict) {
  return {
    knowledge: dict.settings.nav.item.knowledge,
    greeting: dict.scout.welcome.greeting,
    factCount: dict.scout.brief.sheet.count,
    sourcesForCity: dict.liveSettings.sourcesForCity,
    commitmentBoundary: dict.scout.brief.caption.line2,
    endConversation: dict.scout.discovery.controls.end,
    privacy: dict.liveSettings.notStored,
  };
}

const loader = await createServer({
  root, configFile: false, logLevel: "error", appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null },
});
let source;
let existing;
try {
  source = select((await loader.ssrLoadModule("/src/ui/copy/en.ts")).en);
  existing = select((await loader.ssrLoadModule("/src/ui/copy/de.ts")).de);
} finally {
  await loader.close();
}

await mkdir(join(output, "en"), { recursive: true });
await mkdir(join(output, "de"), { recursive: true });
await rm(join(output, "result.json"), { force: true });
const json = (value) => JSON.stringify(value, null, 2) + "\n";
await writeFile(join(output, "en/roomscout.json"), json(source));
await writeFile(join(output, "existing-de.json"), json(existing));
const context = "RoomScout helps musicians find rehearsal spaces. Warm, concise, informal. Keep RoomScout unchanged. Keep all brace placeholders, keys and numbers exactly intact. Use informal German plural ihr/euch for the band. Do not imply a booking or contract is confirmed.";
const metadata = Object.fromEntries(Object.entries(source).map(([key, value]) => [key,
  typeof value === "string" ? { context } : Object.fromEntries(Object.keys(value).map((form) => [form, { context }])),
]));
await writeFile(join(output, "en/roomscout.metadata.json"), json(metadata));
await writeFile(join(output, "gt.config.json"), json({
  defaultLocale: "en", locales: ["de"],
  files: { json: { include: ["[locale]/roomscout.json"] } },
}));

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", timeout: 240_000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} did not finish successfully.`);
}

// Delete a previous API result before a real run so a stale download can never
// be mistaken for a successful translation in this experiment.
const translatedPath = join(output, "de/roomscout.json");
if (translate) await rm(translatedPath, { force: true });
run("npx", ["--yes", "gt@2.21.2", "translate", "--config", "gt.config.json", "--disable-branch-detection",
  ...(translate ? ["--timeout", "120"] : ["--dry-run"])], output, {
  ...process.env,
  ...(translate ? { GT_API_KEY: credentials.GT_API_KEY, GT_PROJECT_ID: credentials.GT_PROJECT_ID } : {}),
});

const resultPath = translate ? translatedPath : join(output, "existing-de.json");
const translated = JSON.parse(await readFile(resultPath, "utf8"));
function validate(reference, result, path = "root") {
  if (typeof reference === "string") {
    assert.equal(typeof result, "string", `Missing translated string: ${path}`);
    assert(result.trim().length > 0, `Empty translation: ${path}`);
    const tokens = (text) => [...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(tokens(result), tokens(reference), `Interpolation changed: ${path}`);
    return;
  }
  assert(result && typeof result === "object" && !Array.isArray(result), `Expected object: ${path}`);
  assert.deepEqual(Object.keys(result).sort(), Object.keys(reference).sort(), `Keys/plural forms changed: ${path}`);
  for (const key of Object.keys(reference)) validate(reference[key], result[key], `${path}.${key}`);
}
validate(source, translated);
run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "tools/i18n/vitest.config.ts"], root, {
  ...process.env, ROOMSCOUT_GT_RESULT: resultPath,
});
await writeFile(join(output, "result.json"), json({
  checkedAt: new Date().toISOString(), cliVersion: "2.21.2", locales: ["en", "de"],
  mode: translate ? "gt-api" : "dry-run-with-existing-translations",
  cliPassed: true, structureAndPlaceholdersPassed: true, uiSwitchPassed: true,
  hostedTranslationTested: translate,
}));
console.log(translate
  ? "GT API translation and RoomScout dictionary/UI compatibility passed. Review the generated German copy for tone before adopting it."
  : "GT CLI dry run and existing EN/DE dictionary/UI compatibility passed. No hosted translation was requested; translation quality remains untested.");
