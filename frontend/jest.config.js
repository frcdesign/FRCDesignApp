export default {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    roots: ["<rootDir>/src"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    testMatch: [
        "**/__tests__/**/*.(ts|tsx|js)",
        "**/?(*.)+(spec|test).(ts|tsx|js)"
    ]
};
