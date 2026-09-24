/** The index options, shared so the backend and frontend agree exactly. */
import { Options } from "minisearch";
import { Vendor } from "../library/vendors";
import { SearchRecord } from "../configurations/contract";
import { processTerm, tokenize } from "./tokenize";
import {
    GROUP_NAME_FIELD,
    NAME_FIELD,
    PART_NAME_FIELD,
    PART_NUMBER_FIELD
} from "./fields";

export interface SearchDocument {
    id: string;
    groupId: string;
    isVisible: boolean;
    vendors: Vendor[];
    name: string;
    groupName: string;
    // Space-joined and deduped; empty when none are indexed.
    partNumbers: string;
    // Space-joined and deduped; empty when none are indexed.
    partNames: string;
    // Stored, not indexed: picks a hit's configuration for the insert menu.
    records: SearchRecord[];
}

/** What the insertable itself is called, and where it lives. */
export const INSERTABLE_FIELDS = [NAME_FIELD, GROUP_NAME_FIELD];

/** Separate so a surface showing one configuration can leave them out. */
const CONFIGURATION_FIELDS = [PART_NUMBER_FIELD, PART_NAME_FIELD];

export const SEARCH_OPTIONS: Options<SearchDocument> = {
    fields: [...INSERTABLE_FIELDS, ...CONFIGURATION_FIELDS],
    storeFields: [
        "id",
        "groupId",
        "isVisible",
        "vendors",
        "name",
        "groupName",
        "records"
    ],
    searchOptions: {
        // The title outranks part names and the group name.
        boost: { partNames: 0.7, groupName: 0.5 },
        prefix: true
    },
    // Custom tokenizer to split on special characters
    tokenize,
    processTerm
};
