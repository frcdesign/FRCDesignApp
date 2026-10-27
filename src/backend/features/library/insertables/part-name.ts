/** What an inserted part is called, which the mates made for it are named after. */
import { eq } from "drizzle-orm";
import { type Db } from "../../../db/client";
import { configurations, insertables } from "../../../db/schema";
import {
    type ConfigurationParameter,
    type ConfigurationRecord,
    DEFAULT_CONFIGURATION_KEY,
    type PartMetadata,
    type Selection
} from "../../configurations/contract";
import { toKey, toSelection } from "../../configurations/selection";

export interface StoredParts {
    /** The tab's name, for a part nothing indexed. */
    tabName: string;
    partMetadata: PartMetadata | null;
    records: ConfigurationRecord[] | null;
    parameters: ConfigurationParameter[];
}

/**
 * The part `selection` inserts: its configuration's indexed record's name, the
 * element's own part's at the defaults, else the tab's.
 */
export function partName(
    stored: StoredParts,
    selection: Selection | undefined
): string {
    const { parameters } = stored;
    const key = selection
        ? toKey(selection, parameters)
        : DEFAULT_CONFIGURATION_KEY;
    const record =
        key === DEFAULT_CONFIGURATION_KEY
            ? stored.partMetadata
            : stored.records?.find(
                  (each) =>
                      toKey(
                          toSelection(each.values, parameters),
                          parameters
                      ) === key
              );
    return record?.name || stored.tabName;
}

/** An insertable's stored parts, as `partName` reads them; undefined when there's no such insertable. */
export async function readStoredParts(
    db: Db,
    insertableId: string
): Promise<StoredParts | undefined> {
    const row = await db
        .select({
            tabName: insertables.name,
            partMetadata: insertables.partMetadata,
            records: configurations.records,
            parameters: configurations.parameters
        })
        .from(insertables)
        .leftJoin(
            configurations,
            eq(configurations.insertableId, insertables.id)
        )
        .where(eq(insertables.id, insertableId))
        .get();
    return (
        row && {
            tabName: row.tabName,
            partMetadata: row.partMetadata,
            records: row.records,
            parameters: row.parameters ?? []
        }
    );
}
