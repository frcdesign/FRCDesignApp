/**
 * The Part Studios robot-code generates from FeatureScript, as a load reads
 * them from the manifest released beside them (`manifest.ts`). A leaf module:
 * the client reads it.
 */
import { type ConfigurationParameter } from "../configurations/contract";

/** Where a studio is released: the tab a library loaded it from. */
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
    parameters: ConfigurationParameter[];
}
