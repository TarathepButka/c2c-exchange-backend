import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

const readonly = "readonly";

export default [
  eslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        console: readonly,
        process: readonly,
        describe: readonly,
        it: readonly,
        expect: readonly,
        jest: readonly,
        beforeEach: readonly,
        afterEach: readonly,
        beforeAll: readonly,
        afterAll: readonly,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    files: [
      "src/**/*.controller.ts",
      "src/**/*.service.ts",
      "src/**/*.model.ts",
    ],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
    },
  },
  prettier,
];
