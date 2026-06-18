import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { QuantityType, Unit } from "../../shared/configuration-models";
import {
    TEST_PART_STUDIO_ID,
    MockOnshapeApi,
    createTestApp,
    jsonRequest,
    resetDb,
    seedConfiguration,
    seedPartStudio,
    TEST_INSTANCE_PATH,
    TEST_PARAMETERS
} from "../../__test_utils__";
import { getDb } from "../db";

const db = getDb(env.DB);

describe("configuration routes", () => {
    beforeEach(async () => {
        await resetDb(db);
    });

    it("GET /configuration/:id returns the stored parameters", async () => {
        await seedPartStudio(db);
        await seedConfiguration(db);
        const app = createTestApp();

        const res = await app.request(
            `/api/configuration/${TEST_PART_STUDIO_ID}`,
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toEqual({ parameters: TEST_PARAMETERS });
    });

    it("GET /configuration/:id 404s for an unknown id", async () => {
        const app = createTestApp();
        const res = await app.request(
            "/api/configuration/missing",
            jsonRequest("GET"),
            env
        );
        expect(res.status).toBe(404);
    });

    it("GET /unit-info parses Onshape unit info", async () => {
        const onshapeApi = new MockOnshapeApi().on("/unitinfo", {
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
        const app = createTestApp({ onshapeApi });

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
