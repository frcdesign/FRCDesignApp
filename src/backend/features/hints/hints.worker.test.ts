import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, jsonRequest } from "../../../__test_utils__";
import { type AccessData } from "../auth/access-level";
import { Hint } from "./contract";

async function seenHints(
    app: ReturnType<typeof createTestApp>
): Promise<Hint[]> {
    const res = await app.request(
        "/api/access-data/library/frc-design-lib",
        jsonRequest("GET"),
        env
    );
    const data: AccessData = await res.json();
    return data.seenHints;
}

async function markSeen(
    app: ReturnType<typeof createTestApp>,
    hint: string
): Promise<Response> {
    return await app.request(
        "/api/seen-hints",
        jsonRequest("POST", { hint }),
        env
    );
}

beforeEach(async () => {
    await env.KV.delete("seen-hints:test-user");
});

describe("hints", () => {
    it("are recorded once seen, and carried with access", async () => {
        const app = createTestApp();
        expect(await seenHints(app)).toEqual([]);

        for (let i = 0; i < 2; i++) {
            const seen = await markSeen(app, Hint.OPENED_INSERT_LOCATION);
            expect(seen.status).toBe(200);
        }

        expect(await seenHints(app)).toEqual([Hint.OPENED_INSERT_LOCATION]);
        // Another computer is the same user.
        expect(await seenHints(createTestApp())).toEqual([
            Hint.OPENED_INSERT_LOCATION
        ]);
    });

    it("refuses a hint it does not know", async () => {
        const res = await markSeen(createTestApp(), "not-a-hint");
        expect(res.status).toBe(400);
    });

    it("are none while signed out", async () => {
        await env.KV.put(
            "seen-hints:test-user",
            JSON.stringify([Hint.OPENED_VERSION_MANAGER])
        );
        expect(await seenHints(createTestApp({ signedIn: false }))).toEqual([]);
    });
});
