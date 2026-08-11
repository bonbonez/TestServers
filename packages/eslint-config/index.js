import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config for every app and package in the repo.
 * Consume it from an app's `eslint.config.js`:
 *
 *   import config from "@test-servers/eslint-config";
 *   export default config;
 */
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
