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
import { DEFAULT_QUANTITY_PRECISION, toRecords } from "./utils";
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
            .leftJoin(
                configurations,
                eq(configurations.insertableId, insertables.id)
            )
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

/** One entry of Onshape's `defaultUnits`: which unit a quantity type is in. */
interface OnshapeUnit {
    key: QuantityType;
    value: Unit;
}

/**
 * The document's unit for a quantity type. Onshape names one for every type, so a
 * missing entry is a response we do not understand, not an absent preference.
 */
function getDefaultUnit(
    units: OnshapeUnit[],
    quantityType: QuantityType
): Unit {
    const unit = units.find((entry) => entry.key === quantityType);
    if (!unit) {
        throw internalError(
            `Onshape named no default unit for ${quantityType}`,
            HttpStatus.BAD_GATEWAY
        );
    }
    return unit.value;
}

/** GET /api/unit-info?documentId=X&instanceId=Y&instanceType=v */
configurationRoutes.get(
    "/unit-info",
    cacheMiddleware(),
    validate("query", instancePathQuery),
    async (c) => {
        const onshapeApi = await c.var.getOnshapeApi();
        const instancePath = c.req.valid("query");

        const rawUnitInfo = await getUnitInfo(onshapeApi, instancePath);
        // Onshape answers with strings; this is where the app decides they are
        // the quantity types and units it knows.
        const units = rawUnitInfo.defaultUnits.units as OnshapeUnit[];

        const angleUnit = getDefaultUnit(units, QuantityType.ANGLE);
        const lengthUnit = getDefaultUnit(units, QuantityType.LENGTH);

        const result: UnitInfo = {
            angleUnit,
            lengthUnit,
            anglePrecision: rawUnitInfo.unitsDisplayPrecision[angleUnit],
            lengthPrecision: rawUnitInfo.unitsDisplayPrecision[lengthUnit],
            // Onshape carries no display precision for a unitless real.
            realPrecision: DEFAULT_QUANTITY_PRECISION
        };
        return c.json(result);
    }
);
