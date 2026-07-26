import { OnshapeApi } from "../onshape-api";
import { ElementPath, toElementApiPath } from "../../../shared/onshape-path";
import { apiPath } from "../api-path";
import { encodeConfigurationForQuery } from "../../../shared/configuration-utils";
import { Configuration } from "../../../shared/configuration-models";
import { ElementType } from "../../../shared/types";

/** A part entry returned by the parts-metadata endpoint. */
interface OnshapePartMetadata {
    partId: string;
    partNumber?: string;
}

/** The subset of the assembly definition we read. */
interface OnshapeAssemblyDefinition {
    rootAssembly?: {
        partNumber?: string;
    };
}

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
function getParts(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Configuration
): Promise<OnshapePartMetadata[]> {
    return client.get(apiPath("parts", elementPath, toElementApiPath), {
        query: configurationQuery(configuration)
    });
}

/** Returns the assembly definition for a given configuration. */
function getAssemblyDefinition(
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
 * the root assembly's part number.
 */
export async function getPartNumber(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    configuration: Configuration
): Promise<string | null> {
    if (elementType === ElementType.ASSEMBLY) {
        const definition = await getAssemblyDefinition(
            client,
            elementPath,
            configuration
        );
        return definition.rootAssembly?.partNumber || null;
    }

    const parts = await getParts(client, elementPath, configuration);
    return parts.find((part) => part.partNumber)?.partNumber || null;
}
