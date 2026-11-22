import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createTestApp,
    MockOnshapeApi,
    seedGroup
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import { events } from "../analytics/schema";
import { EventType } from "../analytics/usage";
import type { OnshapeBom } from "../../lib/onshape/types";
import {
    type MassAssembly,
    MassNodeKind,
    type MassReportOut
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
        expect(gearbox.children[0]).toMatchObject({ name: "Gear" });
        expect(report.children[1]).toMatchObject({ name: "Plate" });
        expect(report.children[1]).not.toHaveProperty("mass");
        expect(await loggedTypes()).toEqual([EventType.MASS_REPORT]);
    });
});
