import { eq } from "drizzle-orm";
import { CachePolicy, cacheMiddleware } from "../../lib/cache";
import { getApp } from "../../lib/context";
import { getDb } from "../../db/client";
import { getUnitInfo } from "../../lib/onshape/endpoints/documents";
import { configurations } from "../../db/schema";
import { type ConfigurationResult, type UnitInfo } from "./models";
import { toSearchRecords } from "../search/search-index";
import { QuantityType, type Unit } from "./enums";
import { isInstancePath } from "../../lib/onshape/path";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";

export const configurationRoutes = getApp();

/** GET /api/configuration/:insertableId?v=:microversionId — parameters and records */
configurationRoutes.get(
    "/configuration/:insertableId",
    cacheMiddleware(CachePolicy.PUBLIC_CACHE),
    async (c) => {
        const insertableId = c.req.param("insertableId");
        if (!insertableId) {
            throw new HTTPException(HttpStatus.BAD_REQUEST, {
                message: "insertableId is required"
            });
        }

        const db = getDb(c.env.DB);
        const config = await db
            .select({
                parameters: configurations.parameters,
                records: configurations.records
            })
            .from(configurations)
            .where(eq(configurations.id, insertableId))
            .get();

        if (!config) {
            throw new HTTPException(HttpStatus.NOT_FOUND, {
                message: "Failed to find configuration"
            });
        }

        const result: ConfigurationResult = {
            parameters: config.parameters,
            records: toSearchRecords(config.records)
        };
        return c.json(result);
    }
);

/** GET /api/unit-info?documentId=X&instanceId=Y&instanceType=v */
configurationRoutes.get("/unit-info", cacheMiddleware(), async (c) => {
    const onshapeApi = await c.var.getOnshapeApi();
    const instancePath = {
        documentId: c.req.query("documentId"),
        instanceId: c.req.query("instanceId"),
        instanceType: c.req.query("instanceType")
    };
    if (!isInstancePath(instancePath)) {
        throw new HTTPException(HttpStatus.BAD_REQUEST, {
            message: "instancePath is required"
        });
    }

    const rawUnitInfo = await getUnitInfo(onshapeApi, instancePath);
    const units: OnshapeUnit[] = rawUnitInfo.defaultUnits.units;

    const angleUnit = getDefaultUnit(units, QuantityType.ANGLE);
    const lengthUnit = getDefaultUnit(units, QuantityType.LENGTH);

    const result: UnitInfo = {
        angleUnit,
        lengthUnit,
        anglePrecision: rawUnitInfo.unitsDisplayPrecision[angleUnit],
        lengthPrecision: rawUnitInfo.unitsDisplayPrecision[lengthUnit],
        realPrecision: 3
    };
    return c.json(result);
});

interface OnshapeUnit {
    key: QuantityType;
    value: Unit;
}

function getDefaultUnit(
    units: OnshapeUnit[],
    quantityType: QuantityType
): Unit {
    return units.find((u) => u.key === quantityType)!.value;
}
