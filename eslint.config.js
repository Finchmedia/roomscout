import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "convex/_generated",
      "convex/components/**/_generated",
      "artifacts/**",
      // Read-only mirror of the Claude Design prototype (spec, not app code):
      // machine-generated bundles + JSX specs that are never built or shipped.
      "design-system",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
    },
  },
  {
    // Local browser helpers are Node.js scripts. The browser snippets they
    // submit as strings are not evaluated in this process.
    files: [
      "scripts/browserbase-local-*.mjs",
      "scripts/firecrawl-local-*.mjs",
    ],
    languageOptions: {
      globals: {
        AbortSignal: "readonly",
        URL: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
      },
    },
  },
  {
    // Playwright serializes these callbacks into the active browser page.
    files: ["scripts/browserbase-local-verify.mjs"],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
      },
    },
  },
  {
    // Design-system layer: colours must come from src/styles/tokens.css, never
    // from a literal in a component. Warns on hex and rgb()/rgba() in strings
    // and template literals (className strings, inline styles, SVG fills).
    files: ["src/components/ui/**/*.{ts,tsx}", "src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Raw color — use a design-system token (var(--rs-…) or a Tailwind token utility)",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Raw color — use a design-system token (var(--rs-…) or a Tailwind token utility)",
        },
        {
          selector: "Literal[value=/rgba?\\(/]",
          message:
            "Raw color — use a design-system token (var(--rs-…) or a Tailwind token utility)",
        },
        {
          selector: "TemplateElement[value.raw=/rgba?\\(/]",
          message:
            "Raw color — use a design-system token (var(--rs-…) or a Tailwind token utility)",
        },
      ],
    },
  },
  {
    // Files written by `npx shadcn add` stay verbatim (the CLI is the source of
    // truth, see docs/BUILD_LOG.md 2026-09-15). Upstream exports cva variants
    // and hooks next to the components, so the fast-refresh rule is off here.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // The local Firecrawl component intentionally preserves upstream source
    // byte-for-byte where possible. Match upstream's lint posture instead of
    // rewriting its provider-envelope and callback types during vendoring.
    files: ["convex/components/firecrawlRoomScout/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
