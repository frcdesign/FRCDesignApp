import { BuildIssue } from "./issues";
import { ElementPath } from "../../lib/onshape/path";
import { ConfigurationParameter } from "../configurations/contract";
import { ElementType } from "../../lib/onshape/element-type";
import { Vendor } from "../library/vendors";

interface ConfigurationBuildStatus {
    parameters: ConfigurationParameter[];
}

export interface GroupBuildStatus {
    buildIssues: BuildIssue[];
    sortAlphabetically: boolean;
    insertableOrder: string[];
    /** When Onshape cut the version this group is pinned to (epoch ms). */
    versionCreatedAt?: number;
    /** A new version waits for an editor's approval. */
    isHeld: boolean;
}

export interface InsertableBuildStatus {
    buildIssues: BuildIssue[];
    /** The version-pinned tab, so an issue can link out to a configuration of it. */
    elementPath: ElementPath;
    elementType: ElementType;
    isVisible: boolean;
    /** Whether inserts place and fasten at its mate connector. */
    supportsFasten: boolean;
    /** The admin's choice; absent when detection decides. */
    fastenOverride?: boolean;
    /** A mate connector was found, whether or not inserts use it. */
    hasMateConnector: boolean;
    /** A part studio inserted into an assembly is grouped to move as one. */
    insertAsRigid: boolean;
    indexConfigurations: boolean;
    /** Parameters an admin left out of indexing. */
    excludedParameterIds: string[];
    vendors: Vendor[];
    configuration?: ConfigurationBuildStatus;
    /** When Onshape cut the version this insertable is pinned to (epoch ms). */
    versionCreatedAt?: number;
}

export interface LibraryBuildStatus {
    groups: Record<string, GroupBuildStatus>;
    insertables: Record<string, InsertableBuildStatus>;
}
