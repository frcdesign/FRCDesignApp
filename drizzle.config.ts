import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: [
        "./src/backend/db/schema.ts",
        "./src/backend/features/analytics/schema.ts"
    ],
    out: "./drizzle",
    dialect: "sqlite",
    driver: "d1-http",
    dbCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        // Database id shouldn't actually be used for anything except explicit drizzle commands, but set anyways
        databaseId: "659e919411f847529a0b0b8cb72ee61b",
        token: process.env.CLOUDFLARE_D1_TOKEN!
    }
});
