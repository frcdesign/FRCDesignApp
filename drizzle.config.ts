import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: "d68c107e-2e40-407f-837b-eccdaa0ee3eb",
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
