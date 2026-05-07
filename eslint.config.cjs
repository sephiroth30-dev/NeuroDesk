const js = require("@eslint/js");
const globals = require("globals");

const sharedRules = {
  "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-console": "off",
};

module.exports = [
  { ignores: ["node_modules/"] },

  // Backend — Node.js (CommonJS)
  {
    files: ["server.js", "ecosystem.config.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: { ...js.configs.recommended.rules, ...sharedRules },
  },

  // Frontend — Browser (ESM-style globals, script tag)
  {
    files: ["public/app.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...sharedRules,
      "no-var": "error",
      "prefer-const": ["warn", { destructuring: "all" }],
    },
  },

  // Tests — Node.js + Jest
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
];
