import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    jsonRequest,
    seedGroup,
    seedPartStudio,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { configurations } from "../../db/schema";
import * as AssemblyEndpoints from "../../lib/onshape/endpoints/assemblies";
import {
    type OnshapeAssemblyDefinition,
    type OnshapeAssemblyInstance
} from "../../lib/onshape/types";
import { SelectedEntityType } from "../auto-assembly/contract";
import {
    type ConfigurationParameter,
    OptionVisibilityType,
    ParameterType,
    VisibilityType
} from "../configurations/contract";
import { alwaysShown } from "../../../__test_utils__/configuration-fixtures";
import { type EditCheckOut, type EditPartsOut } from "./contract";

const ASSEMBLY = {
    documentId: "doc-target",
    instanceType: "w",
    instanceId: "w-target",
    elementId: "target-element"
};

/** Length has no 2 in under the small size. */
const PARAMETERS: ConfigurationParameter[] = [
    {
        type: ParameterType.ENUM,
        id: "size",
        name: "Size",
        default: "small",
        options: [
            { id: "small", name: "Small" },
            { id: "large", name: "Large" }
        ],
        optionConditions: []
    },
    {
        type: ParameterType.ENUM,
        id: "length",
        name: "Length",
        default: "one",
        options: [
            { id: "one", name: "1 in" },
            { id: "two", name: "2 in" }
        ],
        optionConditions: [
            {
                type: OptionVisibilityType.LIST,
                controlledOptions: ["two"],
                condition: {
                    type: VisibilityType.EQUAL,
                    id: "size",
                    value: "large"
                }
            },
            alwaysShown(["one"])
        ]
    }
];

const copy = (id: string, configuration: string): OnshapeAssemblyInstance => ({
    id,
    type: "Part",
    documentId: TEST_PART_STUDIO_PATH.documentId,
    elementId: TEST_PART_STUDIO_PATH.elementId,
    documentVersion: "v-old",
    configuration
});

const at = (x: number) => [1, 0, 0, x, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const pick = (id: string) => ({
    occurrencePath: [id],
    entityId: "JHD",
    entityType: SelectedEntityType.BODY
});

function mockAssembly(instances: OnshapeAssemblyInstance[]) {
    const definition: OnshapeAssemblyDefinition = {
        rootAssembly: {
            features: [],
            instances,
            occurrences: instances.map((instance, index) => ({
                path: [instance.id],
                transform: at(index)
            }))
        },
        parts: [],
        subAssemblies: []
    };
    vi.spyOn(AssemblyEndpoints, "getAssembly").mockResolvedValue(definition);
}

function post(path: string, body: object) {
    return createTestApp().request(path, jsonRequest("POST", body), env);
}

describe("edit parts routes", () => {
    beforeEach(async () => {
        const db = getDb(env.DB);
        await seedGroup(db);
        await seedPartStudio(db);
        await db.insert(configurations).values({
            insertableId: TEST_PART_STUDIO_ID,
            parameters: PARAMETERS
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it("checks which part the picks are copies of, and how many are configured the same", async () => {
        mockAssembly([
            copy("a", "size=large"),
            copy("b", "size=large"),
            copy("c", "size=large;length=two"),
            { id: "other", type: "Part", documentId: "x", elementId: "y" }
        ]);

        const res = await post("/api/edit-parts/check", {
            assembly: ASSEMBLY,
            parts: [pick("a"), pick("other")]
        });

        expect(res.status).toBe(200);
        const body = await res.json<EditCheckOut>();
        expect(body).toMatchObject({
            insertableId: TEST_PART_STUDIO_ID,
            selection: { size: "large", length: "one" },
            pickedCount: 1,
            matchingCount: 2
        });
        expect(body.problems).toEqual([
            expect.objectContaining({
                key: "other|JHD",
                message: "A different part"
            })
        ]);
    });

    it("marks a pick whose configuration can't take the change", async () => {
        mockAssembly([copy("a", "size=large"), copy("b", "")]);

        const res = await post("/api/edit-parts/check", {
            assembly: ASSEMBLY,
            parts: [pick("a"), pick("b")],
            changes: { length: "two" }
        });

        const body = await res.json<EditCheckOut>();
        expect(body.problems).toEqual([
            expect.objectContaining({ key: "b|JHD" })
        ]);
    });

    it("answers nothing for a pick that is no library part", async () => {
        mockAssembly([
            { id: "other", type: "Part", documentId: "x", elementId: "y" }
        ]);
        const res = await post("/api/edit-parts/check", {
            assembly: ASSEMBLY,
            parts: [pick("other")]
        });
        expect(await res.json()).toEqual({
            pickedCount: 0,
            matchingCount: 0,
            problems: []
        });
    });

    it("inserts each matching copy again where it sits, then deletes the old ones", async () => {
        mockAssembly([
            copy("a", "size=large"),
            copy("b", "size=large"),
            copy("c", "")
        ]);
        const insert = vi
            .spyOn(AssemblyEndpoints, "insertTransformedInstances")
            .mockResolvedValue({});
        const remove = vi
            .spyOn(AssemblyEndpoints, "deleteAssemblyInstances")
            .mockResolvedValue();

        const res = await post("/api/edit-parts", {
            assembly: ASSEMBLY,
            parts: [pick("a")],
            changes: { length: "two" },
            applyToAll: true
        });

        expect(res.status).toBe(200);
        expect(await res.json<EditPartsOut>()).toEqual({ updated: 2 });
        const groups = insert.mock.calls[0][2];
        expect(groups.map((group) => group.transform)).toEqual([at(0), at(1)]);
        expect(groups[0].instances[0]).toMatchObject({
            elementId: TEST_PART_STUDIO_PATH.elementId,
            configuration: "size=large;length=two"
        });
        expect(remove.mock.calls[0][2]).toEqual(["a", "b"]);
        expect(insert.mock.invocationCallOrder[0]).toBeLessThan(
            remove.mock.invocationCallOrder[0]
        );
    });

    it("changes only the picks without apply to all, and refuses when none can change", async () => {
        mockAssembly([
            copy("a", "size=large"),
            copy("b", "size=large"),
            copy("c", "")
        ]);
        const insert = vi
            .spyOn(AssemblyEndpoints, "insertTransformedInstances")
            .mockResolvedValue({});
        const remove = vi
            .spyOn(AssemblyEndpoints, "deleteAssemblyInstances")
            .mockResolvedValue();

        const one = await post("/api/edit-parts", {
            assembly: ASSEMBLY,
            parts: [pick("b")],
            changes: { length: "two" },
            applyToAll: false
        });
        expect(await one.json<EditPartsOut>()).toEqual({ updated: 1 });
        expect(remove.mock.calls[0][2]).toEqual(["b"]);

        insert.mockClear();
        const none = await post("/api/edit-parts", {
            assembly: ASSEMBLY,
            parts: [pick("c")],
            changes: { length: "two" },
            applyToAll: true
        });
        expect(none.status).toBe(400);
        expect(insert).not.toHaveBeenCalled();
    });
});
