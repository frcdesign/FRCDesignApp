import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessLevel } from "./access-level";
import { createTestApp, jsonRequest, resetDb } from "../../../__test_utils__";
import { getDb } from "../../db/client";

const db = getDb(env.DB);

describe("GET /access-data", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("returns the caller's access level", async () => {
        const app = createTestApp({ accessLevel: AccessLevel.EDITOR });

        const res = await app.request(
            "/api/access-data",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            maxAccessLevel: AccessLevel.EDITOR,
            signedIn: true
        });
    });

    it("reports signedIn: false when not signed in", async () => {
        const app = createTestApp({
            signedIn: false,
            accessLevel: AccessLevel.USER
        });

        const res = await app.request(
            "/api/access-data",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            maxAccessLevel: AccessLevel.USER,
            signedIn: false
        });
    });
});
