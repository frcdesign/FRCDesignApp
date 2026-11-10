import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../../__test_utils__";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { getDb } from "../../db/client";
import { OnshapeApiError } from "../../lib/onshape/client";
import { ElementType } from "../../lib/onshape/element-type";
import { events } from "../analytics/schema";
import { EventType } from "../analytics/usage";
import { type DesignCheckOut, DesignIssueType } from "./contract";

const db = getDb(env.DB);
const TAB = "/d/doc/w/work/e/tab";

function checkUrl(elementType: ElementType): string {
    return `/api/design-check?documentId=doc&instanceId=work&elementId=tab&elementType=${elementType}`;
}

/** A Part Studio with no Origin Cube and one under-defined sketch. */
function mockPartStudio(sketches: () => Promise<unknown>) {
    const onshapeApi = new MockOnshapeApi();
    const get = vi
        .spyOn(onshapeApi, "get")
        .mockImplementation((path: string) => {
            switch (path) {
                case `/partstudios${TAB}/features`:
                    return Promise.resolve({
                        features: [
                            {
                                featureType: "newSketch",
                                featureId: "S1",
                                name: "Sketch 1",
                                suppressed: false
                            }
                        ],
                        featureStates: { S1: { featureStatus: "OK" } }
                    });
                case `/partstudios${TAB}/sketches`:
                    return sketches();
                case `/parts${TAB}`:
                    return Promise.resolve([]);
                default:
                    return Promise.reject(
                        new OnshapeApiError("unexpected", 404)
                    );
            }
        });
    return { onshapeApi, get };
}

function check(onshapeApi: MockOnshapeApi, elementType: ElementType) {
    return createTestApp({ onshapeApi }).request(
        checkUrl(elementType),
        {},
        env
    );
}

afterEach(() => vi.restoreAllMocks());

describe("checking a tab", () => {
    it("needs someone signed in", async () => {
        const res = await createTestApp({ signedIn: false }).request(
            checkUrl(ElementType.PART_STUDIO),
            {},
            env
        );

        expect(res.status).toBe(401);
    });

    it("reads a Part Studio in three calls and answers what it breaks", async () => {
        const { onshapeApi, get } = mockPartStudio(() =>
            Promise.resolve({
                sketches: [{ featureId: "S1", status: "UNDERDEFINED" }]
            })
        );

        const res = await check(onshapeApi, ElementType.PART_STUDIO);

        expect(res.status).toBe(200);
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
        const body = await res.json<DesignCheckOut>();
        expect(body).toMatchObject({
            elementType: ElementType.PART_STUDIO,
            sketchStatusUnknown: false,
            issues: [
                { type: DesignIssueType.ORIGIN_CUBE_MISSING },
                {
                    type: DesignIssueType.SKETCH_UNDERDEFINED,
                    subject: "Sketch 1",
                    featureId: "S1"
                }
            ]
        });
        expect(get).toHaveBeenCalledTimes(3);
    });

    it("still checks the rest when the sketches can't be read", async () => {
        const { onshapeApi } = mockPartStudio(() =>
            Promise.reject(new OnshapeApiError("broken", 500))
        );

        const res = await check(onshapeApi, ElementType.PART_STUDIO);

        expect(res.status).toBe(200);
        const body = await res.json<DesignCheckOut>();
        expect(body.sketchStatusUnknown).toBe(true);
        expect(body.issues.map((issue) => issue.type)).toEqual([
            DesignIssueType.ORIGIN_CUBE_MISSING
        ]);
    });

    it("passes on Onshape refusing the caller", async () => {
        const { onshapeApi } = mockPartStudio(() =>
            Promise.reject(new OnshapeApiError("no access", 403))
        );

        const res = await check(onshapeApi, ElementType.PART_STUDIO);

        expect(res.status).toBe(403);
    });

    it("reads an Assembly in two calls", async () => {
        const onshapeApi = new MockOnshapeApi();
        const get = vi
            .spyOn(onshapeApi, "get")
            .mockImplementation((path: string) => {
                switch (path) {
                    case `/assemblies${TAB}`:
                        return Promise.resolve({
                            rootAssembly: {
                                instances: [
                                    { id: "a", name: "Plate <1>", type: "Part" }
                                ],
                                occurrences: [
                                    { path: ["a"], transform: [], fixed: true }
                                ],
                                features: []
                            },
                            parts: [],
                            subAssemblies: []
                        });
                    case `/assemblies${TAB}/features`:
                        return Promise.resolve({ features: [] });
                    default:
                        return Promise.reject(
                            new OnshapeApiError("unexpected", 404)
                        );
                }
            });

        const res = await check(onshapeApi, ElementType.ASSEMBLY);

        const body = await res.json<DesignCheckOut>();
        expect(body.issues).toEqual([
            {
                type: DesignIssueType.INSTANCE_FIXED,
                subject: "Plate <1>",
                instanceId: "a"
            }
        ]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("records the check", async () => {
        const { onshapeApi } = mockPartStudio(() =>
            Promise.resolve({ sketches: [] })
        );

        await check(onshapeApi, ElementType.PART_STUDIO);

        const recorded = await db
            .select()
            .from(events)
            .where(eq(events.type, EventType.DESIGN_CHECK))
            .all();
        expect(recorded).toMatchObject([
            {
                userId: "test-user",
                libraryId: null,
                documentId: null,
                checkedElementType: ElementType.PART_STUDIO,
                designIssueCounts: { [DesignIssueType.ORIGIN_CUBE_MISSING]: 1 }
            }
        ]);
    });
});
