import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FAKE_STEP, TEST_LIBRARY_ID } from "../../../__test_utils__";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import * as RequestAuth from "../auth/request-auth";
import * as AdminSessions from "../auth/admin-sessions";
import { createLoadContext, getOnshapeApiFromContext } from "./context";

const REQUESTER = new MockOnshapeApi();
const ADMIN = new MockOnshapeApi();

const context = (sessionId?: string) =>
    createLoadContext(env, TEST_LIBRARY_ID, sessionId, FAKE_STEP);

describe("the session a load calls Onshape with", () => {
    afterEach(() => vi.restoreAllMocks());

    it("is the requester's while it works", async () => {
        vi.spyOn(RequestAuth, "getOnshapeApiFromSessionId").mockResolvedValue(
            REQUESTER
        );
        expect(await getOnshapeApiFromContext(context("s"))).toBe(REQUESTER);
    });

    it("is an admin's once the requester's stops working", async () => {
        vi.spyOn(RequestAuth, "getOnshapeApiFromSessionId").mockRejectedValue(
            new Error("expired")
        );
        const admin = vi
            .spyOn(AdminSessions, "getAdminOnshapeApi")
            .mockResolvedValue(ADMIN);

        expect(await getOnshapeApiFromContext(context("s"))).toBe(ADMIN);
        expect(admin).toHaveBeenCalledWith(env, [TEST_LIBRARY_ID]);
    });

    // A webhook's load has no requester.
    it("is an admin's when nobody asked, found once a run", async () => {
        const admin = vi
            .spyOn(AdminSessions, "getAdminOnshapeApi")
            .mockResolvedValue(ADMIN);
        const ctx = context();

        await getOnshapeApiFromContext(ctx);
        expect(await getOnshapeApiFromContext(ctx)).toBe(ADMIN);
        expect(admin).toHaveBeenCalledOnce();
    });

    // So the step's retry looks again, rather than repeat the same failure.
    it("fails without an admin session, and looks again next time", async () => {
        const admin = vi
            .spyOn(AdminSessions, "getAdminOnshapeApi")
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(ADMIN);
        const ctx = context();

        await expect(getOnshapeApiFromContext(ctx)).rejects.toThrow();
        expect(await getOnshapeApiFromContext(ctx)).toBe(ADMIN);
        expect(admin).toHaveBeenCalledTimes(2);
    });
});
