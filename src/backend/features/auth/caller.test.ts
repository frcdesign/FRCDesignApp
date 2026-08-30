import { env } from "cloudflare:workers";
import { env as processEnv } from "process";
import { afterEach, describe, expect, it } from "vitest";
import { AccessLevel } from "./access-level";
import { productionCaller } from "./caller";
import { createApp } from "../../app";
import { jsonRequest } from "../../../__test_utils__";

const app = createApp(productionCaller);

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
