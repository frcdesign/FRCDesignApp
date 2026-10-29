import { eq } from "drizzle-orm";
import { CachePolicy, cacheMiddleware } from "../../lib/cache";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { getApp } from "../../lib/context";
import { getInsertableParam, insertableRoute } from "../../lib/route-params";
import { getDb } from "../../db/client";
import { configurations, insertables } from "../../db/schema";
import { type ConfigurationResult } from "./contract";
import { getUnitInfoCached } from "./units";
import { searchRecordsOf } from "../search/records";
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
        // The element's own part data is the fallback record, on the insertable.
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
            records: searchRecordsOf(config)
        };
        return c.json(result);
    }
);

/** GET /api/unit-info?documentId=X&instanceId=Y&instanceType=v */
configurationRoutes.get(
    "/unit-info",
    cacheMiddleware(),
    validate("query", instancePathQuery),
    async (c) => c.json(await getUnitInfoCached(c, c.req.valid("query")))
);
