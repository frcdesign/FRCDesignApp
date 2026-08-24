import { eq } from "drizzle-orm";
import { CachePolicy, cacheMiddleware } from "../../lib/cache";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { getApp } from "../../lib/context";
import { getInsertableParam, insertableRoute } from "../../lib/route-params";
import { getDb } from "../../db/client";
import { getUnitInfo } from "../../lib/onshape/endpoints/documents";
import { configurations, insertables } from "../../db/schema";
import { type ConfigurationResult, type UnitInfo } from "./models";
import { toSearchRecords } from "../search/search-index";
import { toRecords } from "./utils";
import { QuantityType, type Unit } from "./enums";
import { INSTANCE_TYPES } from "../../lib/onshape/path";
import { internalError } from "../../lib/api-error";
import { HttpStatus } from "http-status-ts";

export const configurationRoutes = getApp();

const instancePathQuery = z.object({
    documentId: z.string().min(1),
    instanceId: z.string().min(1),
    instanceType: z.enum(INSTANCE_TYPES)
});

/** GET /api/configuration/insertable/:insertableId?v=:microversionId */
configurationRoutes.get(
    "/configuration" + insertableRoute(),
    cacheMiddleware(CachePolicy.PUBLIC_CACHE),
    async (c) => {
        const insertableId = getInsertableParam(c);
        const db = getDb(c.env.DB);
        // Left join: the element's own part data is the fallback record, and it
        // lives on the insertable whether or not it is configurable.
        const config = await db
            .select({
                partMetadata: insertables.partMetadata,
                vendors: insertables.vendors,
                parameters: configurations.parameters,
                records: configurations.records
            })
            .from(insertables)
            .leftJoin(configurations, eq(configurations.id, insertables.id))
            .where(eq(insertables.id, insertableId))
            .get();

        if (!config) {
            throw internalError(
                "Failed to find configuration",
                HttpStatus.NOT_FOUND
            );
        }

        const result: ConfigurationResult = {
            parameters: config.parameters ?? [],
            records: toSearchRecords(
                toRecords(config.partMetadata, config.records ?? []),
                config.vendors
            )
        };
        return c.json(result);
    }
);

/** GET /api/unit-info?documentId=X&instanceId=Y&instanceType=v */
configurationRoutes.get(
    "/unit-info",
    cacheMiddleware(),
    validate("query", instancePathQuery),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const instancePath = c.req.valid("query");

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
    }
);

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
