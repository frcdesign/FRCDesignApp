import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    jsonRequest,
    MockOnshapeApi,
    seedGroup
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { events } from "../analytics/schema";
import { EventType } from "../analytics/usage";
import type { OnshapeBom, OnshapePartMetadata } from "../../lib/onshape/types";
import {
    type MassAssembly,
    MassNodeKind,
    type MassReportOut,
    type PartPropertiesIn
} from "./contract";

const onshapeApi = new MockOnshapeApi();
const app = createTestApp({ onshapeApi });
const db = getDb(env.DB);

const ASSEMBLY = {
    documentId: "robot",
    instanceType: "w",
    instanceId: "main",
    elementId: "top"
} as const;

/** `seedGroup`'s document. */
const LIBRARY_DOCUMENT = "doc-test-group";

const BOM: OnshapeBom = {
    headers: [
        { id: "name", name: "Name" },
        { id: "mass", name: "Mass" }
    ],
    rows: [
        {
            rowId: "gearbox",
            indentLevel: 0,
            itemSource: {
                documentId: LIBRARY_DOCUMENT,
                wvmType: "v",
                wvmId: "v1",
                elementId: "gearbox-asm"
            },
            headerIdToValue: { name: "Gearbox" }
        },
        {
            rowId: "gear",
            indentLevel: 1,
            itemSource: {
                documentId: LIBRARY_DOCUMENT,
                wvmType: "v",
                wvmId: "v1",
                elementId: "gear-studio",
                partId: "JHD"
            },
            headerIdToValue: { name: "Gear", mass: "1 lb" }
        },
        {
            rowId: "plate",
            indentLevel: 0,
            itemSource: {
                documentId: ASSEMBLY.documentId,
                wvmType: "w",
                wvmId: ASSEMBLY.instanceId,
                elementId: "plate-studio",
                partId: "JFD"
            },
            headerIdToValue: { name: "Plate" }
        }
    ]
};

const METADATA: OnshapePartMetadata = {
    properties: [
        { name: "Material", propertyId: "material-id", value: null },
        { name: "Mass override", propertyId: "mass-id", value: null }
    ]
};

const OWN_PART = {
    documentId: ASSEMBLY.documentId,
    instanceType: "w",
    instanceId: ASSEMBLY.instanceId,
    elementId: "plate-studio",
    partId: "JFD",
    configuration: ""
} as const;

const OTHER_PART = {
    ...OWN_PART,
    documentId: "elsewhere",
    instanceType: "v",
    instanceId: "v3"
} as const;

function post(body: PartPropertiesIn) {
    return app.request(
        "/api/mass-analysis/part",
        jsonRequest("POST", body),
        env
    );
}

function loggedTypes(): Promise<EventType[]> {
    return db
        .select({ type: events.type })
        .from(events)
        .all()
        .then((rows) => rows.map((row) => row.type));
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("GET /api/mass-analysis", () => {
    it("reads the BOM into a tree, marking a library's assembly", async () => {
        await seedGroup(db);
        const get = vi.spyOn(onshapeApi, "get").mockResolvedValue(BOM);

        const res = await app.request(
            "/api/mass-analysis?documentId=robot&instanceType=w&instanceId=main&elementId=top",
            {},
            env
        );

        expect(res.status).toBe(200);
        expect(get.mock.calls[0][0]).toBe(
            "/assemblies/d/robot/w/main/e/top/bom"
        );
        const report = await res.json<MassReportOut>();
        const gearbox = report.children[0] as MassAssembly;
        expect(gearbox).toMatchObject({
            kind: MassNodeKind.ASSEMBLY,
            isLibrary: true
        });
        expect(gearbox.children[0]).toMatchObject({
            name: "Gear",
            canSetMass: false
        });
        expect(report.children[1]).toMatchObject({
            name: "Plate",
            canSetMaterial: true,
            canSetMass: true
        });
        expect(report.children[1]).not.toHaveProperty("mass");
        expect(await loggedTypes()).toEqual([EventType.MASS_REPORT]);
    });
});

describe("POST /api/mass-analysis/part", () => {
    it("sets a part's material and mass override in one write", async () => {
        const get = vi.spyOn(onshapeApi, "get").mockResolvedValue(METADATA);
        const write = vi
            .spyOn(onshapeApi, "postNone")
            .mockResolvedValue(undefined);

        const res = await post({
            assembly: ASSEMBLY,
            part: OWN_PART,
            material: "Aluminum - 6061",
            mass: 0.5
        });

        expect(res.status).toBe(200);
        expect(get.mock.calls[0][0]).toBe(
            "/metadata/d/robot/w/main/e/plate-studio/p/JFD"
        );
        const [path, options] = write.mock.calls[0];
        expect(path).toBe("/metadata/d/robot/w/main/e/plate-studio/p/JFD");
        expect(options?.body).toMatchObject({
            partId: "JFD",
            properties: [
                {
                    propertyId: "material-id",
                    value: { displayName: "Aluminum - 6061" }
                },
                { propertyId: "mass-id", value: "0.5 kg" }
            ]
        });
        expect((await loggedTypes()).sort()).toEqual(
            [EventType.MASS_OVERRIDE_SET, EventType.MATERIAL_SET].sort()
        );
    });

    it("reaches another document's part through the assembly's", async () => {
        const get = vi.spyOn(onshapeApi, "get").mockResolvedValue(METADATA);
        vi.spyOn(onshapeApi, "postNone").mockResolvedValue(undefined);

        const res = await post({
            assembly: ASSEMBLY,
            part: OTHER_PART,
            mass: 2
        });

        expect(res.status).toBe(200);
        expect(get.mock.calls[0][1]?.query).toMatchObject({
            linkDocumentId: "robot"
        });
    });

    it("refuses a material for another document's part", async () => {
        const write = vi.spyOn(onshapeApi, "postNone");

        const res = await post({
            assembly: ASSEMBLY,
            part: OTHER_PART,
            material: "Steel"
        });

        expect(res.status).toBe(400);
        expect(write).not.toHaveBeenCalled();
    });

    it("refuses a library's part", async () => {
        await seedGroup(db);
        const write = vi.spyOn(onshapeApi, "postNone");

        const res = await post({
            assembly: ASSEMBLY,
            part: { ...OTHER_PART, documentId: LIBRARY_DOCUMENT },
            mass: 1
        });

        expect(res.status).toBe(400);
        expect(write).not.toHaveBeenCalled();
    });

    it("refuses a property Onshape says can't be edited", async () => {
        vi.spyOn(onshapeApi, "get").mockResolvedValue({
            properties: [
                {
                    name: "Mass override",
                    propertyId: "mass-id",
                    value: null,
                    editable: false
                }
            ]
        } satisfies OnshapePartMetadata);
        const write = vi.spyOn(onshapeApi, "postNone");

        const res = await post({ assembly: ASSEMBLY, part: OWN_PART, mass: 1 });

        expect(res.status).toBe(409);
        expect(write).not.toHaveBeenCalled();
    });

    it("refuses a material not on the list", async () => {
        const res = await post({
            assembly: ASSEMBLY,
            part: OWN_PART,
            material: "Unobtainium"
        });

        expect(res.status).toBe(400);
    });
});
