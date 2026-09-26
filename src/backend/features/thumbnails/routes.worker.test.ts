import { env } from "cloudflare:workers";
import { introspectWorkflow } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    TEST_GROUP_ID,
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedPartStudio
} from "../../../__test_utils__";
import * as ThumbnailEndpoints from "../../lib/onshape/endpoints/thumbnails";
import { getDb } from "../../db/client";
import { groups } from "../../db/schema";
import { eq } from "drizzle-orm";
import { ThumbnailSize } from "./contract";
import {
    parseThumbnailKey,
    parseThumbnailUrl,
    thumbnailKey,
    thumbnailUrl
} from "./keys";
import { DEFAULT_CONFIGURATION_KEY } from "../configurations/contract";

const SIZE = ThumbnailSize.LARGE;
const MICROVERSION = "mv-1";
/** A configuration whose key differs from the default's. */
const CANONICAL_CONFIGURATION = "size=l";

const SESSION_ID = "test-session";
const INSERTABLE_ID = "test-insertable";

const db = getDb(env.DB);

function get(url: string, sessionId?: string) {
    const init = jsonRequest("GET");
    if (sessionId) {
        init.headers = {
            ...init.headers,
            Cookie: `frc-design-app-session=${sessionId}`
        };
    }
    // Signed in only with a session, as a real caller is.
    return createTestApp({ signedIn: !!sessionId }).request(url, init, env);
}

describe("thumbnailKey", () => {
    it("gives the element default its own prefix", () => {
        expect(thumbnailKey("e1", MICROVERSION, SIZE)).toBe(
            `thumbnails/default/e1/${MICROVERSION}/${SIZE}`
        );
    });

    // Otherwise two selections could name one key.
    it("encodes a configuration into a single segment", () => {
        const key = thumbnailKey("e1", MICROVERSION, SIZE, "a=1;b=2/3");
        expect(key).toBe(
            `thumbnails/config/e1/${MICROVERSION}/a%3D1%3Bb%3D2%2F3/${SIZE}`
        );
        expect(key.split("/")).toHaveLength(6);
    });

    it("gives different configurations different keys", () => {
        expect(thumbnailKey("e1", MICROVERSION, SIZE, "a=1")).not.toBe(
            thumbnailKey("e1", MICROVERSION, SIZE, "a=2")
        );
    });
});

// Reconciliation deletes by what these read back.
describe("reading a thumbnail address back", () => {
    const SUBJECT = { elementId: "e1", microversionId: MICROVERSION };

    it.each(Object.values(ThumbnailSize))(
        "round-trips a %s default key",
        (size) => {
            expect(
                parseThumbnailKey(
                    thumbnailKey(
                        SUBJECT.elementId,
                        SUBJECT.microversionId,
                        size
                    )
                )
            ).toEqual(SUBJECT);
        }
    );

    it("round-trips a configuration key, separators and all", () => {
        const key = thumbnailKey(
            SUBJECT.elementId,
            SUBJECT.microversionId,
            SIZE,
            "a=1;b=2/3"
        );
        expect(parseThumbnailKey(key)).toEqual(SUBJECT);
    });

    it.each([
        ["a key under another prefix", "search-index/frcDesignLib.json"],
        ["a key with too few segments", "thumbnails/default/e1/mv-1"],
        ["a key with too many", "thumbnails/default/e1/mv-1/70x40/extra"],
        ["an unknown kind", "thumbnails/other/e1/mv-1/70x40"]
    ])("does not resolve %s", (_name, key) => {
        expect(parseThumbnailKey(key)).toBeUndefined();
    });

    // A group records its document thumbnail only as these urls.
    it("round-trips the url a group stores", () => {
        const url = thumbnailUrl({
            ...SUBJECT,
            size: SIZE,
            configurationKey: DEFAULT_CONFIGURATION_KEY
        });
        expect(parseThumbnailUrl(url)).toEqual(SUBJECT);
    });

    it("round-trips a url carrying every optional parameter", () => {
        const url = thumbnailUrl({
            ...SUBJECT,
            size: SIZE,
            configurationKey: "a=1;b=2",
            insertableId: INSERTABLE_ID
        });
        expect(parseThumbnailUrl(url)).toEqual(SUBJECT);
    });

    it.each([
        ["a url naming no microversion", "/api/thumbnail/70x40/e1"],
        ["a url for another route", "/api/library/frcDesignLib?v=mv-1"],
        ["a url with a trailing segment", "/api/thumbnail/70x40/e1/x?v=mv-1"]
    ])("does not resolve %s", (_name, url) => {
        expect(parseThumbnailUrl(url)).toBeUndefined();
    });
});

describe("thumbnail serving", () => {
    afterEach(() => vi.restoreAllMocks());

    it("serves a stored thumbnail, cached immutably", async () => {
        const elementId = "stored-element";
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "gif-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: DEFAULT_CONFIGURATION_KEY
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("gif-bytes");
        expect(res.headers.get("Cache-Control")).toBe(
            "public, max-age=31536000, immutable"
        );
    });

    it("requires the microversion, which is part of the key", async () => {
        const res = await get(`/api/thumbnail/${SIZE}/some-element`);
        expect(res.status).toBe(400);
    });

    it("rejects a size that is not one we store", async () => {
        const res = await get(`/api/thumbnail/999x999/some-element?v=1`);
        expect(res.status).toBe(400);
    });

    // The element's default would show a part nobody asked for.
    it("misses rather than standing the element default in", async () => {
        const elementId = "unrendered-configuration";
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(404);
        // Not cached: the render can land at any moment.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("serves the configuration that is stored", async () => {
        const elementId = "exact-hit";
        await env.BLOB.put(
            thumbnailKey(
                elementId,
                MICROVERSION,
                SIZE,
                CANONICAL_CONFIGURATION
            ),
            "config-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("config-bytes");
    });

    it("404s when neither the configuration nor the default exists", async () => {
        const res = await get(
            thumbnailUrl({
                elementId: "does-not-exist",
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: DEFAULT_CONFIGURATION_KEY
            })
        );
        expect(res.status).toBe(404);
        // A thumbnail uploaded later must not be shadowed by a cached miss.
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("prefers the configuration's own thumbnail once it exists", async () => {
        const elementId = "configured-element";
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );
        await env.BLOB.put(
            thumbnailKey(
                elementId,
                MICROVERSION,
                SIZE,
                CANONICAL_CONFIGURATION
            ),
            "configured-bytes"
        );

        const res = await get(
            thumbnailUrl({
                elementId,
                microversionId: MICROVERSION,
                size: SIZE,
                configurationKey: CANONICAL_CONFIGURATION
            })
        );
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("configured-bytes");
        expect(res.headers.get("Cache-Control")).toContain("immutable");
    });
});

describe("rendering a configuration's thumbnail", () => {
    afterEach(() => vi.restoreAllMocks());

    /** Seeds only the default, so a configuration request always misses. */
    async function seedDefaultOnly(elementId: string) {
        await env.BLOB.put(
            thumbnailKey(elementId, MICROVERSION, SIZE),
            "default-bytes"
        );
    }

    function renderUrl(elementId: string) {
        return thumbnailUrl({
            elementId,
            microversionId: MICROVERSION,
            size: SIZE,
            configurationKey: CANONICAL_CONFIGURATION,
            insertableId: TEST_PART_STUDIO_ID
        });
    }

    /** Onshape resolving the configuration to a render id. */
    function mockThumbnailId() {
        return vi
            .spyOn(ThumbnailEndpoints, "getThumbnailId")
            .mockResolvedValue("thumbnail-id");
    }

    /** Workflows started while `run` is called, with their steps stubbed out. */
    async function startedDuring(run: () => Promise<unknown>) {
        await using workflows = await introspectWorkflow(
            env.RENDER_THUMBNAIL_WORKFLOW
        );
        await workflows.modifyAll(async (m) => {
            for (const size of Object.values(ThumbnailSize)) {
                await m.mockStepResult({ name: `store-${size}` }, null);
            }
        });
        await run();
        return (await workflows.get()).length;
    }

    beforeEach(async () => {
        await resetDb(db);
        await seedPartStudio(db);
    });

    it("starts one render on a miss, however often it is asked", async () => {
        await seedDefaultOnly("warm-element");
        const thumbnailId = mockThumbnailId();

        const started = await startedDuring(async () => {
            expect(
                (await get(renderUrl("warm-element"), SESSION_ID)).status
            ).toBe(404);
            await get(renderUrl("warm-element"), SESSION_ID);
        });

        expect(started).toBe(1);
        expect(thumbnailId).toHaveBeenCalledTimes(2);
    });

    it("renders from the group's thumbnail workspace", async () => {
        await db
            .update(groups)
            .set({ thumbnailWorkspaceId: "w-branch" })
            .where(eq(groups.id, TEST_GROUP_ID));
        const thumbnailId = mockThumbnailId();

        await startedDuring(async () => {
            await get(renderUrl("branched-element"), SESSION_ID);
        });

        expect(thumbnailId.mock.calls[0][1]).toMatchObject({
            instanceId: "w-branch",
            instanceType: "w"
        });
    });

    // The client words "still rendering" and "never will" differently.
    it("answers a configuration Onshape cannot resolve with its own status", async () => {
        vi.spyOn(ThumbnailEndpoints, "getThumbnailId").mockResolvedValue(
            undefined
        );

        const started = await startedDuring(async () => {
            expect(
                (await get(renderUrl("invalid-element"), SESSION_ID)).status
            ).toBe(422);
        });
        expect(started).toBe(0);
    });

    it("starts nothing when there is no session to render under", async () => {
        const thumbnailId = mockThumbnailId();

        const started = await startedDuring(async () => {
            expect((await get(renderUrl("sessionless-element"))).status).toBe(
                404
            );
        });

        expect(started).toBe(0);
        expect(thumbnailId).not.toHaveBeenCalled();
    });

    // One cold search mustn't start a render per row.
    it("starts nothing when no insertable is named", async () => {
        const started = await startedDuring(async () => {
            const res = await get(
                thumbnailUrl({
                    elementId: "cold-element",
                    microversionId: MICROVERSION,
                    size: SIZE,
                    configurationKey: CANONICAL_CONFIGURATION
                }),
                SESSION_ID
            );
            expect(res.status).toBe(404);
        });
        expect(started).toBe(0);
    });
});
