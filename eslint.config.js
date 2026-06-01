import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    globalIgnores(["dist"]),
    {
        files: ["**/*.{ts,tsx}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommendedTypeChecked,
            tseslint.configs.stylisticTypeChecked,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
            reactX.configs["recommended-typescript"],
            reactDom.configs.recommended
        ],
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                projectService: {
                    allowDefaultProject: [
                        "drizzle.config.ts",
                        "worker-configuration.d.ts"
                    ]
                },
                tsconfigRootDir: import.meta.dirname
            }
        }
    }
]);
