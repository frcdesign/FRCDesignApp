/**
 * The Part Studios robot-code generates from FeatureScript, as synced into
 * `studios.gen.ts` for Quick fastener: each one's configuration parameters,
 * parsed as any element's are, and where it's released. A load reads a
 * library's from the manifest released beside them instead (`manifest.ts`). A
 * leaf module: the client reads it.
 */
import { type ConfigurationParameter } from "../configurations/contract";
import { parseOnshapeConfiguration } from "../load/parse-configuration";
import { type OnshapeConfigurationResponse } from "../../lib/onshape/types";
import { GENERATED_SOURCE, GENERATED_STUDIOS } from "./studios.gen";

/** Where a studio is released; null until its Part Studio is made. */
export interface StudioLocation {
    documentId: string;
    versionId: string;
    elementId: string;
}

export interface GeneratedStudio {
    /** The set it's generated in, such as `fasteners`. */
    set: string;
    /** Its key within the set, such as `screw`. */
    key: string;
    /** The feature the studio holds, by the constant robot-code exports it as. */
    feature: string;
    location?: StudioLocation;
    parameters: ConfigurationParameter[];
}

interface SyncedStudio {
    set: string;
    key: string;
    feature: string;
    configuration: Omit<OnshapeConfigurationResponse, "btType">;
    location: StudioLocation | null;
}

/** The robot-code commit the studios were synced from, as `owner/repo@sha`. */
export const GENERATED_PARTS_SOURCE = GENERATED_SOURCE;

const STUDIOS: GeneratedStudio[] = (
    GENERATED_STUDIOS as unknown as SyncedStudio[]
).map((studio) => ({
    set: studio.set,
    key: studio.key,
    feature: studio.feature,
    location: studio.location ?? undefined,
    // As Onshape answers it, which robot-code sends as an update call
    parameters: parseOnshapeConfiguration({
        ...studio.configuration,
        btType: "BTConfigurationResponse-2019"
    })
}));

export function getGeneratedStudio(
    set: string,
    key: string
): GeneratedStudio | undefined {
    return STUDIOS.find((studio) => studio.set === set && studio.key === key);
}
