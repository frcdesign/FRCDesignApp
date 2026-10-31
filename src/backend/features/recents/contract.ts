import {
    type ConfigurationKey,
    type SearchRecord,
    type Selection
} from "../configurations/contract";

/** How many a user keeps per library; older ones are dropped on insert. */
export const MAX_RECENTS = 100;

export interface RecentInsert {
    insertableId: string;
    /** What was last inserted; absent for an insertable with nothing to configure. */
    selection?: Selection;
    /** Derived per response, since a reload can move the defaults. */
    configurationKey?: ConfigurationKey;
    /** Derived like the key, so the part number matches the selection. */
    record?: SearchRecord;
    /** Milliseconds since the epoch. */
    insertedAt: number;
}

export interface RecentsData {
    /** Most recent first. */
    recents: RecentInsert[];
}
