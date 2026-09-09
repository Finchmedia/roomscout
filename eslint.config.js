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
