import { createServerFn } from "@tanstack/react-start";
import { Library } from "../api-utils/client-models";
import { getUnitInfo } from "../onshape-api/endpoints/documents";
import { InstancePath } from "../onshape-api/path";
import { getLibrary } from "../connect/library";
import {
    ConfigurationResult,
    QuantityType,
    Unit,
    UnitInfo
} from "./configuration-models";
import { getOnshapeApi } from "../routes/auth/-auth.server";

/** Returns the stored configuration parameters for a given element. */
export const fetchConfiguration = createServerFn()
    .inputValidator(
        (data: {
            library: Library;
            documentId: string;
            configurationId: string;
        }) => data
    )
    .handler(async ({ data }): Promise<ConfigurationResult> => {
        const config = await getLibrary(data.library)
            .documents.document(data.documentId)
            .configurations.configuration(data.configurationId)
            .get();
        if (!config) throw new Error("Configuration not found");
        return config;
    });

/** Returns the default units and display precision for a given document instance. */
export const fetchUnitInfo = createServerFn()
    .inputValidator((data: { instancePath: InstancePath }) => data)
    .handler(async ({ data }): Promise<UnitInfo> => {
        const onshapeApi = await getOnshapeApi();
        const unitInfo = await getUnitInfo(onshapeApi, data.instancePath);

        const units: OnshapeUnit[] = unitInfo.defaultUnits.units;
        const angleUnit = getDefaultUnit(units, QuantityType.ANGLE);
        const lengthUnit = getDefaultUnit(units, QuantityType.LENGTH);

        return {
            angleUnit,
            lengthUnit,
            anglePrecision: unitInfo.unitsDisplayPrecision[angleUnit],
            lengthPrecision: unitInfo.unitsDisplayPrecision[lengthUnit],
            realPrecision: 3 // Onshape doesn't allow users to configure a precision
        };
    });

interface OnshapeUnit {
    key: QuantityType;
    value: Unit;
}

/**
 * Retrives the Unit set by a user associated with a given QuantityType.
 */
function getDefaultUnit(
    units: OnshapeUnit[],
    quantityType: QuantityType
): Unit {
    return units.find((u) => u.key === quantityType)?.value as Unit;
}
