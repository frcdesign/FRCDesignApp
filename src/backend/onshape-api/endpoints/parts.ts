import { OnshapeApi } from "../onshape-api";
import { ElementPath, toElementApiPath } from "../../../shared/onshape-path";
import { apiPath } from "../api-path";
import { encodeConfigurationForQuery } from "../../../shared/configuration-utils";
import { Configuration } from "../../../shared/configuration-models";
import { ElementType } from "../../../shared/types";
import type { OnshapeAssemblyDefinition, OnshapePart } from "../onshape-types";
import {
    parseAssemblyPartNumber,
    parsePartStudioPartNumber
} from "../../parse/parse-part-number";

/**
 * Builds the `configuration` query for an element request. The value is the
 * raw `id=value;…` form; `createSearchParams` URL-encodes it.
 */
function configurationQuery(
    configuration: Configuration
): Record<string, string> {
    const encoded = encodeConfigurationForQuery(configuration);
    return encoded ? { configuration: encoded } : {};
}

/** Returns the parts of a part studio for a given configuration. */
export function getParts(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Configuration
): Promise<OnshapePart[]> {
    return client.get(apiPath("parts", elementPath, toElementApiPath), {
        query: configurationQuery(configuration)
    });
}

/** Returns the assembly definition for a given configuration. */
export function getAssemblyDefinition(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Configuration
): Promise<OnshapeAssemblyDefinition> {
    return client.get(apiPath("assemblies", elementPath, toElementApiPath), {
        query: configurationQuery(configuration)
    });
}

/**
 * Returns the part number Onshape reports for an element in a given
 * configuration, or `null` if none is set. A part studio insertable resolves to
 * a single part, so its part number is taken from that part; an assembly uses
 * the root assembly's part number. Extraction lives in
 * `parse/parse-part-number.ts`.
 */
export async function getPartNumber(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    configuration: Configuration
): Promise<string | null> {
    if (elementType === ElementType.ASSEMBLY) {
        return parseAssemblyPartNumber(
            await getAssemblyDefinition(client, elementPath, configuration)
        );
    }
    return parsePartStudioPartNumber(
        await getParts(client, elementPath, configuration)
    );
}
