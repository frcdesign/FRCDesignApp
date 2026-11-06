import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db/client";
import * as TranslationEndpoints from "../../lib/onshape/endpoints/translations";
import {
    OnshapeTranslationState,
    type OnshapeTranslation
} from "../../lib/onshape/endpoints/translations";
import { ElementType } from "../../lib/onshape/element-type";
import {
    MOCK_ONSHAPE_API,
    TEST_PART_STUDIO_ID,
    TEST_PART_STUDIO_PATH,
    createTestApp,
    jsonRequest,
    resetDb,
    seedConfiguration,
    seedPartStudio
} from "../../../__test_utils__";
import { StepExportState, stepExportFilePath } from "./contract";
import { events } from "../analytics/schema";
import { EventType, UseSource } from "../analytics/usage";
import { OnshapeApiError } from "../../lib/onshape/client";

const db = getDb(env.DB);

function translation(
    overrides: Partial<OnshapeTranslation> = {}
): OnshapeTranslation {
    return {
        id: "tr-1",
        requestState: OnshapeTranslationState.ACTIVE,
        documentId: TEST_PART_STUDIO_PATH.documentId,
        requestElementId: TEST_PART_STUDIO_PATH.elementId,
        ...overrides
    };
}

function mockTranslation(overrides: Partial<OnshapeTranslation> = {}) {
    return vi
        .spyOn(TranslationEndpoints, "getTranslation")
        .mockResolvedValue(translation(overrides));
}

describe("step export routes", () => {
    beforeEach(async () => {
        await resetDb(db);
        await seedPartStudio(db);
    });

    afterEach(() => vi.restoreAllMocks());

    it("starts an export of the version-pinned tab, at the selection's overrides", async () => {
        await seedConfiguration(db);
        const start = vi
            .spyOn(TranslationEndpoints, "startStepExport")
            .mockResolvedValue(translation());

        const res = await createTestApp().request(
            `/api/step-export/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", { selection: { boolean: "false" } }),
            env
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ translationId: "tr-1" });
        expect(start).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            TEST_PART_STUDIO_PATH,
            ElementType.PART_STUDIO,
            {
                configuration: "boolean=false",
                destinationName: `Test ${ElementType.PART_STUDIO}`
            }
        );
    });

    it("records the download as a use, with where it started", async () => {
        await seedConfiguration(db);
        vi.spyOn(TranslationEndpoints, "startStepExport").mockResolvedValue(
            translation()
        );

        await createTestApp().request(
            `/api/step-export/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {
                selection: { boolean: "false" },
                isFavorite: true,
                source: UseSource.FAVORITES
            }),
            env
        );

        expect(await db.select().from(events).all()).toMatchObject([
            {
                type: EventType.DOWNLOAD,
                insertableId: TEST_PART_STUDIO_ID,
                selection: { boolean: "false" },
                isFavorite: true,
                source: UseSource.FAVORITES
            }
        ]);
    });

    it("records nothing when Onshape refuses the export", async () => {
        vi.spyOn(TranslationEndpoints, "startStepExport").mockRejectedValue(
            new OnshapeApiError("Forbidden", 403)
        );

        const res = await createTestApp().request(
            `/api/step-export/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {}),
            env
        );

        expect(res.status).toBe(403);
        expect(await db.select().from(events).all()).toEqual([]);
    });

    it("exports the default without naming a configuration", async () => {
        await seedConfiguration(db);
        const start = vi
            .spyOn(TranslationEndpoints, "startStepExport")
            .mockResolvedValue(translation());

        await createTestApp().request(
            `/api/step-export/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {}),
            env
        );

        expect(start.mock.calls[0][3].configuration).toBe("");
    });

    it("refuses a signed-out caller before asking Onshape", async () => {
        const start = vi.spyOn(TranslationEndpoints, "startStepExport");

        const res = await createTestApp({ signedIn: false }).request(
            `/api/step-export/insertable/${TEST_PART_STUDIO_ID}`,
            jsonRequest("POST", {}),
            env
        );

        expect(res.status).toBe(401);
        expect(start).not.toHaveBeenCalled();
    });

    it.each([
        [OnshapeTranslationState.ACTIVE, StepExportState.ACTIVE],
        [OnshapeTranslationState.DONE, StepExportState.DONE],
        [OnshapeTranslationState.FAILED, StepExportState.FAILED]
    ])("reports Onshape's %s as %s", async (requestState, state) => {
        mockTranslation({ requestState });
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        const res = await createTestApp().request(
            "/api/step-export/tr-1",
            {},
            env
        );

        expect(await res.json()).toEqual({ state });
    });

    it("won't report on an export of a document outside the library", async () => {
        mockTranslation({ documentId: "someone-elses" });

        const res = await createTestApp().request(
            "/api/step-export/tr-1",
            {},
            env
        );

        expect(res.status).toBe(404);
    });

    it("streams the finished file as an attachment named after the tab", async () => {
        mockTranslation({
            requestState: OnshapeTranslationState.DONE,
            resultExternalDataIds: ["file-1"]
        });
        const download = vi
            .spyOn(TranslationEndpoints, "downloadExternalData")
            .mockResolvedValue(new Response("ISO-10303-21;"));

        const res = await createTestApp().request(
            stepExportFilePath("tr-1"),
            {},
            env
        );

        expect(res.status).toBe(200);
        expect(new TextDecoder().decode(await res.arrayBuffer())).toBe(
            "ISO-10303-21;"
        );
        expect(res.headers.get("Content-Disposition")).toContain(
            `filename="Test ${ElementType.PART_STUDIO}.step"`
        );
        expect(download).toHaveBeenCalledWith(
            MOCK_ONSHAPE_API,
            TEST_PART_STUDIO_PATH.documentId,
            "file-1"
        );
    });

    it("refuses the file before Onshape has it", async () => {
        mockTranslation();
        const download = vi.spyOn(TranslationEndpoints, "downloadExternalData");

        const res = await createTestApp().request(
            stepExportFilePath("tr-1"),
            {},
            env
        );

        expect(res.status).toBe(409);
        expect(download).not.toHaveBeenCalled();
    });
});
