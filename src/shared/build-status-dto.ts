import { BuildIssue } from "./build-issues";
import { ConfigurationParameter } from "./configuration-models";
import { ElementType } from "./element-type";
import { Vendor } from "./vendors";

export interface ConfigurationBuildStatus {
    buildIssues: BuildIssue[];
    parameters: ConfigurationParameter[];
}

export interface GroupBuildStatus {
    buildIssues: BuildIssue[];
    sortAlphabetically: boolean;
    insertableOrder: string[];
    /** When this group was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
}

export interface InsertableBuildStatus {
    buildIssues: BuildIssue[];
    elementType: ElementType;
    isVisible: boolean;
    supportsFasten: boolean;
    indexConfigurations: boolean;
    vendors: Vendor[];
    configuration?: ConfigurationBuildStatus;
    /** When this insertable was last successfully loaded (epoch ms); null if never. */
    lastLoadedAt: number | null;
}

export interface LibraryBuildStatus {
    groups: Record<string, GroupBuildStatus>;
    insertables: Record<string, InsertableBuildStatus>;
}
