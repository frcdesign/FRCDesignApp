/**
 * A workspace's units, cached so each panel open needn't ask Onshape. A
 * transient webhook drops the entry when they change; since Onshape may drop
 * the webhook quietly, entries also expire, and the next miss watches again.
 */
import { HttpStatus } from "http-status-ts";
import type { AppContext } from "../../lib/context";
import { internalError } from "../../lib/api-error";
import { runInBackground } from "../../lib/background";
import { kvStore } from "../../lib/kv-store";
import { getUnitInfo } from "../../lib/onshape/endpoints/documents";
import type { InstancePath } from "../../lib/onshape/path";
import { watchWorkspaceUnits } from "../webhooks/transient";
import type { UnitInfo } from "./contract";
import { QuantityType, type Unit } from "./enums";
import { DEFAULT_QUANTITY_PRECISION } from "./utils";

const unitInfos = kvStore<UnitInfo>("unit-info", {
    ttlSeconds: 7 * 24 * 3600
});

function unitInfoId(path: InstancePath): string {
    return `${path.documentId}:${path.instanceType}:${path.instanceId}`;
}

/** One entry of Onshape's `defaultUnits`: which unit a quantity type is in. */
interface OnshapeUnit {
    key: QuantityType;
    value: Unit;
}

/** Onshape names a unit for every type, so a missing one is a response we don't understand. */
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

async function fetchUnitInfo(
    c: AppContext,
    path: InstancePath
): Promise<UnitInfo> {
    const raw = await getUnitInfo(await c.var.getOnshapeApi(), path);
    const units = raw.defaultUnits.units as OnshapeUnit[];
    const angleUnit = getDefaultUnit(units, QuantityType.ANGLE);
    const lengthUnit = getDefaultUnit(units, QuantityType.LENGTH);
    return {
        angleUnit,
        lengthUnit,
        anglePrecision: raw.unitsDisplayPrecision[angleUnit],
        lengthPrecision: raw.unitsDisplayPrecision[lengthUnit],
        // Onshape carries no display precision for a unitless real.
        realPrecision: DEFAULT_QUANTITY_PRECISION
    };
}

export async function getUnitInfoCached(
    c: AppContext,
    path: InstancePath
): Promise<UnitInfo> {
    const cached = await unitInfos.get(c.env.KV, unitInfoId(path));
    if (cached) {
        return cached;
    }
    const unitInfo = await fetchUnitInfo(c, path);
    await unitInfos.put(c.env.KV, unitInfoId(path), unitInfo);
    // A version's units never change, so only a workspace is watched.
    if (path.instanceType === "w") {
        await runInBackground(c, "watch workspace units", async () =>
            watchWorkspaceUnits(
                c.env,
                await c.var.getOnshapeApi(),
                path,
                new URL(c.req.url).origin
            )
        );
    }
    return unitInfo;
}

export function forgetUnitInfo(
    kv: KVNamespace,
    workspace: InstancePath
): Promise<void> {
    return unitInfos.delete(kv, unitInfoId(workspace));
}
