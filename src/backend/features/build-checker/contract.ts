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
    versionCreatedAt: number | null;
}

export interface InsertableBuildStatus {
    buildIssues: BuildIssue[];
    /** The version-pinned tab, so an issue can link out to a configuration of it. */
    elementPath: ElementPath;
    elementType: ElementType;
    isVisible: boolean;
    supportsFasten: boolean;
    indexConfigurations: boolean;
    vendors: Vendor[];
    configuration?: ConfigurationBuildStatus;
    /** When Onshape cut the version this insertable is pinned to (epoch ms). */
    versionCreatedAt: number | null;
}

export interface LibraryBuildStatus {
    groups: Record<string, GroupBuildStatus>;
    insertables: Record<string, InsertableBuildStatus>;
}
