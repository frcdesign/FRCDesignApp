import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../../__test_utils__";
import { MockOnshapeApi } from "../../../__test_utils__/mock-onshape-api";
import { getDb } from "../../db/client";
import { OnshapeApiError, OnshapeTimeoutError } from "../../lib/onshape/client";
import { ElementType } from "../../lib/onshape/element-type";
import {
    type OnshapeElement,
    OnshapeElementType,
    OnshapeFolderEntryType
} from "../../lib/onshape/types";
import { events } from "../analytics/schema";
import { EventType } from "../analytics/usage";
import { type DesignCheckOut, DesignIssueType } from "./contract";

const db = getDb(env.DB);
const WORKSPACE = "/d/doc/w/work";
const CHECK_URL = "/api/design-check?documentId=doc&instanceId=work";

const PART_STUDIO: OnshapeElement = {
    id: "ps",
    name: "Part Studio 1",
    elementType: OnshapeElementType.PART_STUDIO,
    microversionId: "m1"
};
const ASSEMBLY: OnshapeElement = {
    id: "asm",
    name: "Assembly 1",
    elementType: OnshapeElementType.ASSEMBLY,
    microversionId: "m1"
};
const DRAWING: OnshapeElement = {
    id: "dwg",
    name: "Drawing 1",
    elementType: OnshapeElementType.DRAWING,
    microversionId: "m1"
};

/** A document's contents, its tabs shown in the order given. */
function contents(elements: OnshapeElement[]) {
    return {
        folders: {
            btType: OnshapeFolderEntryType.GROUP,
            groups: elements.map((element) => ({
                btType: OnshapeFolderEntryType.ELEMENT,
                elementId: element.id
            }))
        },
        // Listed out of tab order, which the check doesn't follow.
        elements: elements.toReversed()
    };
}

/** A Part Studio with no Origin Cube and one under-defined sketch. */
function partStudioAnswers(
    sketches: () => Promise<unknown> = () =>
        Promise.resolve({
            sketches: [{ featureId: "S1", sketchSolveStatus: "UNDERDEFINED" }]
        })
): Record<string, () => Promise<unknown>> {
    const tab = `${WORKSPACE}/e/${PART_STUDIO.id}`;
    return {
        [`/partstudios${tab}/features`]: () =>
            Promise.resolve({
                features: [
                    {
                        featureType: "newSketch",
                        featureId: "S1",
                        name: "Sketch 1",
                        suppressed: false
                    }
                ],
                featureStates: { S1: { featureStatus: "OK" } }
            }),
        [`/partstudios${tab}/sketches`]: sketches,
        [`/parts${tab}`]: () => Promise.resolve([])
    };
}

/** An Assembly with one fixed instance. */
function assemblyAnswers(): Record<string, () => Promise<unknown>> {
    const tab = `${WORKSPACE}/e/${ASSEMBLY.id}`;
    return {
        [`/assemblies${tab}`]: () =>
            Promise.resolve({
                rootAssembly: {
                    instances: [{ id: "a", name: "Plate <1>", type: "Part" }],
                    occurrences: [{ path: ["a"], transform: [], fixed: true }],
                    features: []
                },
                parts: [],
                subAssemblies: []
            }),
        [`/assemblies${tab}/features`]: () => Promise.resolve({ features: [] })
    };
}

/** Answers each path from `answers`, and anything else with a 404. */
function mockOnshape(
    elements: OnshapeElement[],
    answers: Record<string, () => Promise<unknown>>
) {
    const onshapeApi = new MockOnshapeApi();
    const get = vi
        .spyOn(onshapeApi, "get")
        .mockImplementation((path: string) => {
            if (path === `/documents${WORKSPACE}/contents`) {
                return Promise.resolve(contents(elements));
            }
            const answer = answers[path] as
                | (() => Promise<unknown>)
                | undefined;
            return answer
                ? answer()
                : Promise.reject(new OnshapeApiError("unexpected", 404));
        });
    return { onshapeApi, get };
}

async function check(onshapeApi: MockOnshapeApi) {
    const res = await createTestApp({ onshapeApi }).request(CHECK_URL, {}, env);
    return {
        res,
        body: res.ok ? await res.json<DesignCheckOut>() : undefined
    };
}

afterEach(() => vi.restoreAllMocks());

describe("checking a document", () => {
    it("needs someone signed in", async () => {
        const res = await createTestApp({ signedIn: false }).request(
            CHECK_URL,
            {},
            env
        );

        expect(res.status).toBe(401);
    });

    it("checks each Part Studio and Assembly in tab order, and nothing else", async () => {
        const { onshapeApi, get } = mockOnshape(
            [DRAWING, ASSEMBLY, PART_STUDIO],
            { ...partStudioAnswers(), ...assemblyAnswers() }
        );

        const { res, body } = await check(onshapeApi);

        expect(res.status).toBe(200);
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
        expect(body?.tabs).toEqual([
            {
                elementId: "asm",
                name: "Assembly 1",
                elementType: ElementType.ASSEMBLY,
                issues: [
                    {
                        type: DesignIssueType.INSTANCE_FIXED,
                        subject: "Plate <1>",
                        instanceId: "a"
                    }
                ],
                sketchStatusUnknown: false,
                failed: false
            },
            {
                elementId: "ps",
                name: "Part Studio 1",
                elementType: ElementType.PART_STUDIO,
                issues: [
                    { type: DesignIssueType.ORIGIN_CUBE_MISSING },
                    {
                        type: DesignIssueType.SKETCH_UNDERDEFINED,
                        subject: "Sketch 1",
                        featureId: "S1"
                    }
                ],
                sketchStatusUnknown: false,
                failed: false
            }
        ]);
        // The contents, three for the Part Studio and two for the Assembly.
        expect(get).toHaveBeenCalledTimes(6);
        // Without geometry ids, Onshape leaves out every feature's status.
        expect(get).toHaveBeenCalledWith(
            `/partstudios${WORKSPACE}/e/ps/features`,
            { query: { noSketchGeometry: "true", includeGeometryIds: "true" } }
        );
    });

    it("reuses a tab's result until its microversion moves", async () => {
        const first = mockOnshape([PART_STUDIO], partStudioAnswers());
        await check(first.onshapeApi);
        vi.restoreAllMocks();

        const unchanged = mockOnshape([PART_STUDIO], partStudioAnswers());
        const again = await check(unchanged.onshapeApi);

        expect(unchanged.get).toHaveBeenCalledTimes(1);
        expect(again.body?.tabs[0].issues).toHaveLength(2);
        vi.restoreAllMocks();

        const changed = mockOnshape(
            [{ ...PART_STUDIO, microversionId: "m2" }],
            partStudioAnswers()
        );
        await check(changed.onshapeApi);

        expect(changed.get).toHaveBeenCalledTimes(4);
    });

    it("marks a tab Onshape fails on, and checks the rest", async () => {
        const { onshapeApi } = mockOnshape([PART_STUDIO, ASSEMBLY], {
            ...partStudioAnswers(),
            [`/assemblies${WORKSPACE}/e/asm`]: () =>
                Promise.reject(new OnshapeTimeoutError(60_000))
        });

        const { res, body } = await check(onshapeApi);

        expect(res.status).toBe(200);
        expect(
            body?.tabs.map((tab) => [
                tab.elementId,
                tab.failed,
                tab.issues.length
            ])
        ).toEqual([
            ["ps", false, 2],
            ["asm", true, 0]
        ]);
    });

    it.each([
        ["fails", new OnshapeApiError("broken", 500)],
        ["times out", new OnshapeTimeoutError(60_000)]
    ])(
        "still checks the rest of a tab when listing its sketches %s",
        async (_, error) => {
            const { onshapeApi } = mockOnshape(
                [PART_STUDIO],
                partStudioAnswers(() => Promise.reject(error))
            );

            const { body } = await check(onshapeApi);

            expect(body?.tabs[0]).toMatchObject({
                sketchStatusUnknown: true,
                failed: false,
                issues: [{ type: DesignIssueType.ORIGIN_CUBE_MISSING }]
            });
        }
    );

    it("passes on Onshape refusing the caller, for the document or a tab", async () => {
        const refused = () =>
            Promise.reject(new OnshapeApiError("no access", 403));
        const forTab = mockOnshape([PART_STUDIO], partStudioAnswers(refused));
        expect((await check(forTab.onshapeApi)).res.status).toBe(403);
        vi.restoreAllMocks();

        const forDocument = new MockOnshapeApi();
        vi.spyOn(forDocument, "get").mockImplementation(refused);
        expect((await check(forDocument)).res.status).toBe(403);
    });

    it("records each tab it checks, and none it reuses", async () => {
        const answers = { ...partStudioAnswers(), ...assemblyAnswers() };
        await check(mockOnshape([PART_STUDIO, ASSEMBLY], answers).onshapeApi);
        vi.restoreAllMocks();
        await check(mockOnshape([PART_STUDIO, ASSEMBLY], answers).onshapeApi);

        const recorded = await db
            .select()
            .from(events)
            .where(eq(events.type, EventType.DESIGN_CHECK))
            .all();
        expect(
            recorded.map((row) => row.checkedElementType).toSorted()
        ).toEqual([ElementType.ASSEMBLY, ElementType.PART_STUDIO]);
        expect(recorded[0]).toMatchObject({
            userId: "test-user",
            libraryId: null,
            documentId: null
        });
    });
});
