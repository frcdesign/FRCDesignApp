/** The index options, shared so the backend and frontend agree exactly. */
import { Options } from "minisearch";
import { Vendor } from "../library/vendors";
import { SearchRecord } from "../configurations/contract";
import { tokenize } from "./tokenize";
import { GROUP_NAME_FIELD, NAME_FIELD, PART_NUMBER_FIELD } from "./fields";

export interface SearchDocument {
    id: string;
    groupId: string;
    isVisible: boolean;
    vendors: Vendor[];
    name: string;
    groupName: string;
    // Space-joined and deduped; empty when none are indexed.
    partNumbers: string;
    // Stored, not indexed: picks a hit's configuration for the insert menu.
    records: SearchRecord[];
}

/** What the insertable itself is called, and where it lives. */
export const INSERTABLE_FIELDS = [NAME_FIELD, GROUP_NAME_FIELD];

export const SEARCH_OPTIONS: Options<SearchDocument> = {
    // Part numbers apart, so a surface showing one configuration can leave them out.
    fields: [...INSERTABLE_FIELDS, PART_NUMBER_FIELD],
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
        // The title outranks the group name.
        boost: { groupName: 0.5 },
        prefix: true
    },
    tokenize,
    // Terms come out of `tokenize` already lowercased and split.
    processTerm: (term) => term
};
