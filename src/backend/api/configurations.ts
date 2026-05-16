import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { type Bindings } from "../app";
import { getDb } from "../db";
import { getOnshapeApi } from "../auth";
import { getUnitInfo } from "../onshape-api/endpoints/documents";
import { configurations } from "../../shared/schema";
import {
  type ConfigurationResult,
  type UnitInfo,
  QuantityType,
  type Unit,
} from "../../frontend/configurations/configuration-models";
import { type InstancePath } from "../onshape-api/path";

export const configurationRoutes = new Hono<{ Bindings: Bindings }>();

/** GET /api/configuration?library=X&documentId=Y&configurationId=Z */
configurationRoutes.get("/configuration", async (c) => {
  const configurationId = c.req.query("configurationId");
  if (!configurationId) return c.json({ error: "configurationId required" }, 400);

  const db = getDb(c.env.DB);
  const config = await db
    .select({ parameters: configurations.parameters })
    .from(configurations)
    .where(eq(configurations.id, configurationId))
    .get();

  if (!config) return c.json({ error: "Configuration not found" }, 404);

  const result: ConfigurationResult = {
    parameters: JSON.parse(config.parameters),
  };
  return c.json(result);
});

/** GET /api/unit-info?documentId=X&instanceId=Y&instanceType=v */
configurationRoutes.get("/unit-info", async (c) => {
  const onshapeApi = await getOnshapeApi(c);
  const instancePath: InstancePath = {
    documentId: c.req.query("documentId") ?? "",
    instanceId: c.req.query("instanceId") ?? "",
    instanceType: (c.req.query("instanceType") ?? "v") as "w" | "v" | "m",
  };

  const unitInfo = await getUnitInfo(onshapeApi, instancePath);
  const units: OnshapeUnit[] = unitInfo.defaultUnits.units;

  const angleUnit = getDefaultUnit(units, QuantityType.ANGLE);
  const lengthUnit = getDefaultUnit(units, QuantityType.LENGTH);

  const result: UnitInfo = {
    angleUnit,
    lengthUnit,
    anglePrecision: unitInfo.unitsDisplayPrecision[angleUnit],
    lengthPrecision: unitInfo.unitsDisplayPrecision[lengthUnit],
    realPrecision: 3,
  };
  return c.json(result);
});

interface OnshapeUnit {
  key: QuantityType;
  value: Unit;
}

function getDefaultUnit(units: OnshapeUnit[], quantityType: QuantityType): Unit {
  return units.find((u) => u.key === quantityType)?.value as Unit;
}
