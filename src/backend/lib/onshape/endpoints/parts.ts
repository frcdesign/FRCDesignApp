import { OnshapeApi } from "../client";
import { ElementPath, toElementApiPath } from "../path";
import { type Selection } from "../../../features/configurations/contract";
import { encodeQueryConfiguration } from "../../../features/configurations/utils";
import type { OnshapeBodyDetails, OnshapePart } from "../types";

export function getParts(
    client: OnshapeApi,
    elementPath: ElementPath,
    configuration: Selection
): Promise<OnshapePart[]> {
    // The query form: this is escaped again on its way out.
    const encoded = encodeQueryConfiguration(configuration);
    return client.get(`/parts${toElementApiPath(elementPath)}`, {
        query: encoded ? { configuration: encoded } : {}
    });
}

/** One part's faces and edges; `configuration` is encoded, as an assembly instance carries it. */
export function getPartBodyDetails(
    client: OnshapeApi,
    elementPath: ElementPath,
    partId: string,
    configuration: string | undefined
): Promise<OnshapeBodyDetails> {
    return client.get(
        `/parts${toElementApiPath(elementPath)}/partid/${encodeURIComponent(partId)}/bodydetails`,
        { query: configuration ? { configuration } : {} }
    );
}
