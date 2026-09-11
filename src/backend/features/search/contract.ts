/**
 * What the index holds and how it is queried. The backend builds the index with
 * these options and the frontend deserializes it with the same ones, so they
 * are the one thing both ends must agree on exactly.
 */
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
    // Space-joined, deduped part numbers (a searchable field); empty when the
    // insertable has no indexed part numbers.
    partNumbers: string;
    // Space-joined, deduped configuration (part) names (a searchable field);
    // empty when the insertable has no indexed records.
    partNames: string;
    // Stored, not indexed: picks the best-matching configuration for a hit and
    // launches it in the insert menu.
    records: SearchRecord[];
}

/** What the insertable itself is called, and where it lives. */
export const INSERTABLE_FIELDS = [NAME_FIELD, GROUP_NAME_FIELD];

/**
 * What its individual configurations are called and numbered. Separated so a
 * surface can leave them out: they describe every configuration at once, which
 * a list showing one specific configuration has no way to represent.
 */
export const CONFIGURATION_FIELDS = [PART_NUMBER_FIELD, PART_NAME_FIELD];

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
        // The insertable's own title leads; part names and the group name are
        // weaker signals, so a title match outranks them.
        boost: { partNames: 0.7, groupName: 0.5 },
        prefix: true
    },
    // Custom tokenizer to split on special characters
    tokenize,
    processTerm
};
