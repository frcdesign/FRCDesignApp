import { eq } from "drizzle-orm";
import { getApp } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getUnitInfo } from "../onshape-api/endpoints/documents";
import { configurations } from "../../shared/schema";
import {
    type ConfigurationResult,
    type UnitInfo,
    QuantityType,
    type Unit
} from "../../shared/configuration-models";
import { isInstancePath } from "../../shared/onshape-path";
import { HTTPException } from "hono/http-exception";

export const configurationRoutes = getApp();

/** GET /api/configuration/:configurationId */
configurationRoutes.get("/configuration/:configurationId", async (c) => {
    const configurationId = c.req.param("configurationId");
    if (!configurationId) {
        throw new HTTPException(400, {
            message: "configurationId is required"
        });
    }

    const db = getDb(c.env.DB);
    const config = await db
        .select({ parameters: configurations.parameters })
        .from(configurations)
        .where(eq(configurations.id, configurationId))
        .get();

    if (!config) {
        throw new HTTPException(404, {
            message: "Failed to find configuration"
        });
    }

    const result: ConfigurationResult = {
        parameters: config.parameters
    };
    return c.json(result);
});

/** GET /api/unit-info?documentId=X&instanceId=Y&instanceType=v */
configurationRoutes.get("/unit-info", async (c) => {
    const onshapeApi = await getOnshapeApi(c);
    const instancePath = {
        documentId: c.req.query("documentId"),
        instanceId: c.req.query("instanceId"),
        instanceType: c.req.query("instanceType")
    };
    if (!isInstancePath(instancePath)) {
        throw new HTTPException(400, {
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
