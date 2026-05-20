export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "jsdom",
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    roots: ["<rootDir>/src"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    transform: {
        "^.+\\.(ts|tsx)$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: {
                    module: "ESNext",
                    moduleResolution: "node"
                }
            }
        ]
    },
    testMatch: [
        "**/__tests__/**/*.(ts|tsx|js)",
        "**/?(*.)+(spec|test).(ts|tsx|js)"
    ]
};
