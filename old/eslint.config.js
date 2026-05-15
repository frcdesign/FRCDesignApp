import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default [
    {
        ignores: ["**/dist/**", "src/routeTree.gen.ts"]
    },
    js.configs.recommended,
    ...tsPlugin.configs["flat/recommended"],
    reactHooks.configs.flat["recommended-latest"],
    {
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...globals.browser
            }
        },
        plugins: {
            "react-refresh": reactRefresh
        },
        rules: {
            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true }
            ],
            "@typescript-eslint/no-explicit-any": "off",
            // noFallthroughCasesInSwitch in tsconfig handles this
            "no-fallthrough": "off"
        }
    }
];
