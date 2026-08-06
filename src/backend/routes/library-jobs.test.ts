import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { libraryJobs } from "../../shared/schema";
import { TEST_LIBRARY_ID, createTestApp, resetDb } from "../../__test_utils__";
import { getDb } from "../db";
import { AccessLevel, LibraryId } from "../../shared/types";
import type { LibraryJobsData } from "../../shared/library-job-models";

const db = getDb(env.DB);

interface SeedJobOptions {
    id: string;
    status?: "running" | "complete" | "partial" | "errored";
    libraryId?: LibraryId;
    instanceId?: string;
    createdAt?: number;
}

async function seedJob(options: SeedJobOptions): Promise<void> {
    await db.insert(libraryJobs).values({
        id: options.id,
        instanceId: options.instanceId ?? `wf-${options.id}`,
        type: "load-library",
        libraryId: options.libraryId ?? TEST_LIBRARY_ID,
        status: options.status ?? "complete",
        label: "Reload all documents",
        createdAt: options.createdAt ?? Date.now()
    });
}

describe("GET /library-jobs", () => {
    beforeEach(() => resetDb(db));
    afterEach(() => vi.restoreAllMocks());

    it("returns the library's jobs newest-first, without the internal instance id", async () => {
        await seedJob({ id: "older", createdAt: 1000 });
        await seedJob({ id: "newer", createdAt: 2000 });
        // A job in a different library must not leak in.
        await seedJob({
            id: "other-lib",
            libraryId: LibraryId.MKCAD,
            createdAt: 3000
        });

        const res = await createTestApp().request(
            `/api/library-jobs/library/${TEST_LIBRARY_ID}`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryJobsData = await res.json();
        expect(body.libraryJobs.map((j) => j.id)).toEqual(["newer", "older"]);
        expect(body.libraryJobs[0]).not.toHaveProperty("instanceId");
    });

    it("forbids non-editors", async () => {
        const res = await createTestApp({
            accessLevel: AccessLevel.USER
        }).request(
            `/api/library-jobs/library/${TEST_LIBRARY_ID}`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(403);
    });

    it("reconciles a running job whose workflow has errored", async () => {
        await seedJob({ id: "stuck", status: "running", instanceId: "wf-1" });

        vi.spyOn(env.LOAD_LIBRARY_WORKFLOW, "get").mockResolvedValue({
            status: () =>
                Promise.resolve({
                    status: "errored",
                    error: { name: "Error", message: "boom" }
                })
        } as never);

        const res = await createTestApp().request(
            `/api/library-jobs/library/${TEST_LIBRARY_ID}`,
            { method: "GET" },
            env
        );
        expect(res.status).toBe(200);

        const body: LibraryJobsData = await res.json();
        const job = body.libraryJobs.find((j) => j.id === "stuck");
        expect(job?.status).toBe("errored");
        expect(job?.error).toBe("boom");

        // The correction is persisted, not just reflected in the response.
        const row = await db
            .select()
            .from(libraryJobs)
            .where(eq(libraryJobs.id, "stuck"))
            .get();
        expect(row?.status).toBe("errored");
        expect(row?.finishedAt).not.toBeNull();
    });
});
