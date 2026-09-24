import { env } from "cloudflare:workers";
import { env as processEnv } from "process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessLevel } from "./access-level";
import { productionAuth } from "./request-auth";
import { createApp } from "../../app";
import { jsonRequest } from "../../../__test_utils__";
import { saveSession } from "./session";
import { getOwnerSessionId } from "./owner";
import * as Registration from "../webhooks/registration";

const app = createApp(productionAuth);

/** What the real caller resolves for a request carrying no Onshape session. */
async function getMaxAccessLevel(override?: AccessLevel): Promise<AccessLevel> {
    const res = await app.request("/api/access-data", jsonRequest("GET"), {
        ...env,
        VITE_ACCESS_LEVEL_OVERRIDE: override
    });
    const body: { maxAccessLevel: AccessLevel } = await res.json();
    return body.maxAccessLevel;
}

describe("the dev access-level override", () => {
    const nodeEnv = processEnv.NODE_ENV;
    afterEach(() => {
        processEnv.NODE_ENV = nodeEnv;
    });

    it("grants the level it names", async () => {
        expect(await getMaxAccessLevel(AccessLevel.ADMIN)).toBe(
            AccessLevel.ADMIN
        );
    });

    // It is the one thing standing between a stray env var and admin, so it
    // must not survive a production build.
    it("is ignored in production", async () => {
        processEnv.NODE_ENV = "production";
        expect(await getMaxAccessLevel(AccessLevel.ADMIN)).toBe(
            AccessLevel.USER
        );
    });

    it("leaves an unset override to the caller's own session", async () => {
        expect(await getMaxAccessLevel()).toBe(AccessLevel.USER);
    });
});

describe("the owner", () => {
    const OWNER = "owner-user-id";

    /** A signed-in session whose user is already resolved, so Onshape is not asked. */
    async function accessLevelOf(userId: string): Promise<AccessLevel> {
        const sessionId = crypto.randomUUID();
        await saveSession(env.KV, sessionId, {
            accessToken: "token",
            refreshToken: "refresh",
            expiresAt: Date.now() + 60_000,
            userId
        });
        const res = await app.request(
            "/api/access-data",
            {
                method: "GET",
                headers: { Cookie: `frc-design-app-cookie=${sessionId}` }
            },
            { ...env, OWNER_USER_ID: OWNER }
        );
        const body: { maxAccessLevel: AccessLevel } = await res.json();
        return body.maxAccessLevel;
    }

    it("is the user OWNER_USER_ID names, and their session is kept", async () => {
        const ensure = vi
            .spyOn(Registration, "ensureWebhook")
            .mockResolvedValue();
        expect(await accessLevelOf(OWNER)).toBe(AccessLevel.OWNER);
        expect(await getOwnerSessionId(env.KV)).not.toBeNull();
        // And the webhooks are kept registered on their behalf.
        expect(ensure).toHaveBeenCalledOnce();
    });
});
