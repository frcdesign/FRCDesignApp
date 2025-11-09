export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "jsdom",
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    globals: {
        "ts-jest": { useESM: true, tsconfig: "tsconfig.json" }
    },
    roots: ["<rootDir>/src"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    transform: {
        "^.+\\.(ts|tsx)$": [
            "ts-jest",
            { useESM: true, tsconfig: "tsconfig.json" }
        ]
    },
    testMatch: [
        "**/__tests__/**/*.(ts|tsx|js)",
        "**/?(*.)+(spec|test).(ts|tsx|js)"
    ]
};
