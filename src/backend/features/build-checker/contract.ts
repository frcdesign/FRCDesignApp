import { BuildIssue } from "./issues";
import { ConfigurationParameter } from "../configurations/models";
import { ElementType } from "../../lib/onshape/element-type";
import { Vendor } from "../library/vendors";

export interface ConfigurationBuildStatus {
    /** The insertable's id, which a configuration row is keyed by. */
    id: string;
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
