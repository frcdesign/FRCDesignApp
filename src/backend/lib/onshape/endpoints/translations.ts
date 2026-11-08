import { OnshapeApi } from "../client";
import { assertInstanceType } from "../assertions";
import { ElementType } from "../element-type";
import { ElementPath, toElementApiPath } from "../path";

/** `BTTranslationRequestState`. */
export enum OnshapeTranslationState {
    ACTIVE = "ACTIVE",
    DONE = "DONE",
    FAILED = "FAILED"
}

/** As much of `BTTranslationRequestInfo` as anything reads. */
export interface OnshapeTranslation {
    id: string;
    requestState: OnshapeTranslationState;
    /** The document the translation ran against. */
    documentId: string;
    /** The tab it exported. */
    requestElementId?: string;
    /** Set once DONE; downloaded through {@link downloadExternalData}. */
    resultExternalDataIds?: string[];
    failureReason?: string;
}

function elementSegment(elementType: ElementType): string {
    switch (elementType) {
        case ElementType.PART_STUDIO:
            return "partstudios";
        case ElementType.ASSEMBLY:
            return "assemblies";
    }
}

/**
 * Starts an asynchronous STEP export to a data file outside the document,
 * polled with {@link getTranslation}. `configuration` is
 * `encodeConfiguration`'s form; empty exports the default.
 */
export function startStepExport(
    client: OnshapeApi,
    elementPath: ElementPath,
    elementType: ElementType,
    options: { configuration: string; destinationName: string }
): Promise<OnshapeTranslation> {
    assertInstanceType(elementPath, "w", "v");
    return client.post(
        `/${elementSegment(elementType)}${toElementApiPath(elementPath)}/translations`,
        {
            body: {
                formatName: "STEP",
                storeInDocument: false,
                // One file for the whole tab, not a zip of one per part.
                grouping: true,
                destinationName: options.destinationName,
                ...(options.configuration
                    ? { configuration: options.configuration }
                    : {})
            }
        }
    );
}

export function getTranslation(
    client: OnshapeApi,
    translationId: string
): Promise<OnshapeTranslation> {
    return client.get(`/translations/${translationId}`);
}

/** The finished export's bytes, unread, so they can be streamed on. */
export function downloadExternalData(
    client: OnshapeApi,
    documentId: string,
    externalDataId: string
): Promise<Response> {
    return client.getRaw(
        `/documents/d/${documentId}/externaldata/${externalDataId}`,
        { accept: "*/*" }
    );
}
