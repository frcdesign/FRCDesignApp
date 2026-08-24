import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuantityType, Unit } from "./enums";
import {
    TEST_PART_STUDIO_ID,
    createTestApp,
    jsonRequest,
    resetDb,
    seedConfiguration,
    seedPartStudio,
    TEST_INSTANCE_PATH,
    TEST_PARAMETERS
} from "../../../__test_utils__";
import { getDb } from "../../db/client";
import * as DocumentEndpoints from "../../lib/onshape/endpoints/documents";

const db = getDb(env.DB);

describe("configuration routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    afterEach(() => vi.restoreAllMocks());

    it("GET /configuration/insertable/:insertableId returns the stored parameters", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        const app = createTestApp();

        const res = await app.request(
            `/api/configuration/insertable/${TEST_PART_STUDIO_ID}?v=abc123`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toEqual({ parameters: TEST_PARAMETERS, records: [] });
    });

    // The element's own part data is the record an unset configuration falls
    // back to, and it lives on the insertable, not in a configurations row.
    it("GET /configuration/insertable/:insertableId serves the element's own part data as a record", async () => {
        await seedPartStudio(db, {
            partMetadata: {
                partNumber: "WCP-0405",
                name: "2x1 Tube",
                description: undefined,
                material: undefined,
                vendor: undefined,
                hasMultipleParts: false,
                isOpenComposite: false
            }
        });
        const app = createTestApp();

        const res = await app.request(
            `/api/configuration/insertable/${TEST_PART_STUDIO_ID}?v=abc123`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        expect(await res.json()).toEqual({
            parameters: [],
            records: [
                {
                    partNumber: "WCP-0405",
                    name: "2x1 Tube",
                    url: "https://wcproducts.com/products/wcp-0405",
                    configuration: {}
                }
            ]
        });
    });

    it("GET /configuration/insertable/:insertableId 404s for an unknown id", async () => {
        const app = createTestApp();
        const res = await app.request(
            "/api/configuration/insertable/missing?v=abc123",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(404);
    });

    it("GET /unit-info parses Onshape unit info", async () => {
        vi.spyOn(DocumentEndpoints, "getUnitInfo").mockResolvedValue({
            defaultUnits: {
                units: [
                    { key: QuantityType.ANGLE, value: Unit.DEGREE },
                    { key: QuantityType.LENGTH, value: Unit.MILLIMETER }
                ]
            },
            unitsDisplayPrecision: {
                [Unit.DEGREE]: 3,
                [Unit.MILLIMETER]: 4
            }
        });
        const app = createTestApp();

        const { documentId, instanceId, instanceType } = TEST_INSTANCE_PATH;
        const res = await app.request(
            `/api/unit-info?documentId=${documentId}&instanceId=${instanceId}&instanceType=${instanceType}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toEqual({
            angleUnit: Unit.DEGREE,
            lengthUnit: Unit.MILLIMETER,
            anglePrecision: 3,
            lengthPrecision: 4,
            realPrecision: 3
        });
    });
});
