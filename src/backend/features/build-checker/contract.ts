import { BuildIssue } from "./issues";
import { ElementPath } from "../../lib/onshape/path";
import { ConfigurationParameter } from "../configurations/contract";
import { ElementType } from "../../lib/onshape/element-type";
import { Vendor } from "../library/vendors";

export interface GroupBuildStatus {
    buildIssues: BuildIssue[];
    sortAlphabetically: boolean;
    insertableOrder: string[];
    /** When Onshape cut the version this group is pinned to (epoch ms). */
    versionCreatedAt?: number;
    /** A new version waits for an editor's approval. */
    isHeld: boolean;
}

/** What an admin decided about indexing an insertable. */
export interface IndexingSettings {
    /** Index even past the automatic threshold. */
    indexConfigurations: boolean;
    /** Parameters an admin left out of indexing. */
    excludedParameterIds: string[];
}

export interface InsertableBuildStatus extends IndexingSettings {
    buildIssues: BuildIssue[];
    /** The version-pinned tab, so an issue can link out to a configuration of it. */
    elementPath: ElementPath;
    elementType: ElementType;
    isVisible: boolean;
    /** Inserts place and fasten at its mate connector. */
    supportsFasten: boolean;
    /** An admin turned fastening off; otherwise it is on wherever a connector is found. */
    fastenDisabled: boolean;
    /** The generated studio it is (`fasteners/screw`), which indexes every configuration itself. */
    generatedStudio?: string;
    vendors: Vendor[];
    /** Empty for an element without configurations. */
    parameters: ConfigurationParameter[];
    /** When Onshape cut the version this insertable is pinned to (epoch ms). */
    versionCreatedAt?: number;
}

export interface LibraryBuildStatus {
    groups: Record<string, GroupBuildStatus>;
    insertables: Record<string, InsertableBuildStatus>;
}
