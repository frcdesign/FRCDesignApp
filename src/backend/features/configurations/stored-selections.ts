import { eq, inArray } from "drizzle-orm";
import { type Db } from "../../db/client";
import { chunkForInArray } from "../../db/chunk";
import { configurations, insertables } from "../../db/schema";
import { searchRecordsOf } from "../search/records";
import {
    type ConfigurationKey,
    type ConfigurationParameter,
    type PartialSelection,
    type SearchRecord,
    type Selection
} from "./contract";
import { findRecord, toKey, toSelection, toStoredSelection } from "./selection";

/** What a stored selection is read against. */
export interface InsertableConfiguration {
    /** What a stored selection is made whole against. */
    parameters: ConfigurationParameter[];
    /** Includes the element's own. */
    records: SearchRecord[];
}

/**
 * Joined with the insertable, whose vendors give a record its url. A left join,
 * since an unconfigurable insertable has no configurations row.
 */
export async function getInsertableConfigurations(
    db: Db,
    insertableIds: string[]
): Promise<Map<string, InsertableConfiguration>> {
    // Chunked: a user's rows can outnumber what one statement binds.
    const reads = await Promise.all(
        chunkForInArray(insertableIds).map((ids) =>
            db
                .select({
                    insertableId: insertables.id,
                    vendors: insertables.vendors,
                    partMetadata: insertables.partMetadata,
                    parameters: configurations.parameters,
                    records: configurations.records
                })
                .from(insertables)
                .leftJoin(
                    configurations,
                    eq(configurations.insertableId, insertables.id)
                )
                .where(inArray(insertables.id, ids))
                .all()
        )
    );
    return new Map(
        reads.flat().map((row) => [
            row.insertableId,
            {
                parameters: row.parameters ?? [],
                records: searchRecordsOf(row)
            }
        ])
    );
}

/** One insertable's parameters, for making a selection whole. */
export async function getParametersFor(
    db: Db,
    insertableId: string
): Promise<ConfigurationParameter[]> {
    return (
        (await getInsertableConfigurations(db, [insertableId])).get(
            insertableId
        )?.parameters ?? []
    );
}

/** A selection made whole and stripped of derivation variables, for a D1 row. */
export function toRowSelection(
    selection: PartialSelection,
    parameters: ConfigurationParameter[]
): PartialSelection {
    return toStoredSelection(toSelection(selection, parameters), parameters);
}

export interface ResolvedSelection {
    /** Absent when nothing was stored, which is the element's own defaults. */
    selection?: Selection;
    configurationKey?: ConfigurationKey;
    /** So a row never shows another configuration's part number. */
    record?: SearchRecord;
}

/**
 * Reads a stored selection against the insertable as it is now. The key and
 * record are derived, since a reload can move the defaults a key is measured against.
 */
export function resolveStoredSelection(
    stored: PartialSelection | undefined,
    configuration: InsertableConfiguration | undefined
): ResolvedSelection {
    const { parameters = [], records = [] } = configuration ?? {};
    // A row written before a parameter existed still has to be whole.
    const selection = stored
        ? toSelection(toStoredSelection(stored, parameters), parameters)
        : undefined;
    return {
        selection,
        configurationKey: selection ? toKey(selection, parameters) : undefined,
        record: findRecord(selection ?? toSelection({}, parameters), records)
    };
}
