import { eq } from "drizzle-orm";
import { CachePolicy, cacheMiddleware, getApp } from "../app";
import { getDb } from "../db";
import { getUnitInfo } from "../onshape-api/endpoints/documents";
import { configurations } from "../../shared/schema";
import {
    type ConfigurationResult,
    type UnitInfo
} from "../../shared/configuration-models";
import { toSearchRecords } from "../../shared/search";
import { QuantityType, type Unit } from "../../shared/configuration-enums";
import { isInstancePath } from "../../shared/onshape-path";
import { HTTPException } from "hono/http-exception";
import { HttpStatus } from "http-status-ts";

export const configurationRoutes = getApp();

/** GET /api/configuration/:configurationId?v=:microversionId */
configurationRoutes.get(
    "/configuration/:configurationId",
    cacheMiddleware(CachePolicy.PUBLIC_CACHE),
    async (c) => {
        const configurationId = c.req.param("configurationId");
        if (!configurationId) {
            throw new HTTPException(HttpStatus.BAD_REQUEST, {
                message: "configurationId is required"
            });
        }

        const db = getDb(c.env.DB);
        const config = await db
            .select({
                parameters: configurations.parameters,
                records: configurations.records
            })
            .from(configurations)
            .where(eq(configurations.id, configurationId))
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
