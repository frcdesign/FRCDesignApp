import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessLevel } from "../features/auth/access-level";
import { LibraryId } from "../features/library/library-id";
import { ApiErrorKind } from "./api-error";
import { createTestApp, jsonRequest, resetDb } from "../../__test_utils__";
import { getDb } from "../db/client";

const db = getDb(env.DB);

describe("api error responses", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    // Written for the user, so the client shows it verbatim.
    it("marks a gate's refusal as handled", async () => {
        const app = createTestApp({ signedIn: false });

        const res = await app.request(
            `/api/reload-groups/library/${LibraryId.FRC_DESIGN_LIB}`,
            jsonRequest("POST"),
            env
        );

        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({
            kind: ApiErrorKind.HANDLED,
            message: expect.stringContaining("signed in")
        });
    });

    // A malformed request is our bug, so the client falls back to its own
    // wording rather than showing a validator's message.
    it("marks a rejected request as internal", async () => {
        const app = createTestApp({ accessLevel: AccessLevel.ADMIN });

        const res = await app.request(
            `/api/group-order/library/${LibraryId.FRC_DESIGN_LIB}`,
            jsonRequest("POST", { groupOrder: "not-an-array" }),
            env
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({
            kind: ApiErrorKind.INTERNAL
        });
    });

    it("marks an unknown library as internal rather than explaining it", async () => {
        const app = createTestApp();

        const res = await app.request(
            "/api/library-data/library/not-a-library?v=1",
            jsonRequest("GET"),
            env
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({
            kind: ApiErrorKind.INTERNAL
        });
    });
});
