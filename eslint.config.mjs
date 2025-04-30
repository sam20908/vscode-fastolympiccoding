import js from "@eslint/js";
import tseslint from "typescript-eslint";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";


export default defineConfig([
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    }
  },
  markdown.configs.recommended,
  { files: ["src/**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
]);