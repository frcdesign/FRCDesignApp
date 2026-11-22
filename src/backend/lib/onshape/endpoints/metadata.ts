import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { type Selection } from "../../../features/configurations/contract";
import { encodeQueryConfiguration } from "../../../features/configurations/utils";
import type { OnshapeMetadataObject, OnshapePartMetadata } from "../types";

/** Returns an element's metadata properties for a given configuration. */
export function getElementMetadata(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Selection
): Promise<OnshapeMetadataObject> {
    // Computed properties are slow, and indexing probes once per configuration.
    const query: Record<string, string> = {
        includeComputedProperties: "false"
    };
    // The query form: this is escaped again on its way out.
    const encoded = encodeQueryConfiguration(configuration);
    if (encoded) {
        query.configuration = encoded;
    }
    return client.get(`/metadata${toElementApiPath(elementPath)}`, {
        query
    });
}

/** A part, by the Part Studio it's in; `configuration` is as Onshape encoded it. */
export interface PartMetadataPath {
    studio: ElementPath;
    partId: string;
    configuration: string;
    /** The document it's reached through, when it's another's version. */
    linkDocumentId?: string;
}

function partMetadataQuery(part: PartMetadataPath): Record<string, string> {
    const query: Record<string, string> = {};
    if (part.configuration) {
        query.configuration = part.configuration;
    }
    if (part.linkDocumentId) {
        query.linkDocumentId = part.linkDocumentId;
    }
    return query;
}

function partMetadataApiPath(part: PartMetadataPath): string {
    return `/metadata${toElementApiPath(part.studio)}/p/${encodeURIComponent(part.partId)}`;
}

/** A part's own properties, without the computed ones. */
export function getPartMetadata(
    client: OnshapeApi,
    part: PartMetadataPath
): Promise<OnshapePartMetadata> {
    return client.get(partMetadataApiPath(part), {
        query: {
            ...partMetadataQuery(part),
            includeComputedProperties: "false"
        }
    });
}

export function updatePartMetadata(
    client: OnshapeApi,
    part: PartMetadataPath,
    properties: { propertyId: string; value: unknown }[]
): Promise<void> {
    return client.postNone(partMetadataApiPath(part), {
        query: partMetadataQuery(part),
        body: { jsonType: "metadata-part", partId: part.partId, properties }
    });
}
