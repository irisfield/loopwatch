import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },

  // Type-aware TypeScript rulesets — covers recommended-type-checked,
  // strict-type-checked, and stylistic-type-checked in one pass
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Enable project-aware linting so the type-checker backs every rule
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Modern JS idioms
  unicorn.configs.recommended,

  // Import ordering
  {
    plugins: { "import-x": importX },
    rules: {
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import-x/no-duplicates": "error",
    },
  },

  // Project-wide rules
  {
    rules: {
      // TypeScript — type-checker-backed
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Base ESLint
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
      "no-console": "warn",

      // Unicorn overrides — too aggressive for this codebase
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off",
      "unicorn/no-array-reduce": "off",
    },
  },

  // Enforce explicit return types on exported functions (library public API)
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
    },
  },

  // Disable type-aware rules on plain JS/MJS config files — they are not
  // covered by tsconfig.json and would cause parser errors
  {
    files: ["*.js", "*.mjs", "*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Prettier must be last — disables all ESLint formatting rules that
  // would conflict with Prettier's output
  prettier,
);
