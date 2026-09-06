import { eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import { configurations } from "../../db/schema";
import { type Selection } from "./models";
import { appliedValues } from "./selection";

/**
 * Reads of a stored configuration. Apart from `selection.ts` so that stays a
 * leaf module the frontend can import.
 */

/**
 * What Onshape applied for a selection: the values it did not hide, against the
 * part's parameters as they stand now rather than a copy the caller carried.
 * Null when the part declares no parameters to apply.
 */
export async function appliedSelection(
    db: Db,
    insertableId: string,
    selection: Selection | undefined
): Promise<Selection | null> {
    if (!selection) return null;

    const row = await db
        .select({ parameters: configurations.parameters })
        .from(configurations)
        .where(eq(configurations.id, insertableId))
        .get();

    const parameters = row?.parameters ?? [];
    return parameters.length === 0
        ? null
        : appliedValues(selection, parameters);
}
