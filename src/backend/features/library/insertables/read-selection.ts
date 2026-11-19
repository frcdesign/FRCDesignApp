import { eq } from "drizzle-orm";
import { NO_PREFERENCES, type VendorPreferences } from "../../teams/contract";
import { applyVendorPreferences } from "../../teams/vendor-policy";
import z from "zod";
import { type Db } from "../../../db/client";
import { configurations } from "../../../db/schema";
import {
    type ConfigurationParameter,
    type Selection
} from "../../configurations/contract";
import { toSelection } from "../../configurations/selection";

/** A request's selection, before {@link readSelection} makes it whole. */
export const selectionSchema = z.record(z.string(), z.string()).optional();

/** Every request goes through here, so nothing past it holds a partial selection. */
export async function readSelection(
    db: Db,
    insertableId: string,
    requested: Selection | undefined,
    preferences: VendorPreferences = NO_PREFERENCES
): Promise<{
    selection: Selection | undefined;
    parameters: ConfigurationParameter[];
}> {
    const row = await db
        .select({ parameters: configurations.parameters })
        .from(configurations)
        .where(eq(configurations.insertableId, insertableId))
        .get();

    const parameters = row?.parameters ?? [];
    return {
        selection:
            parameters.length === 0
                ? undefined
                : applyVendorPreferences(
                      toSelection(requested ?? {}, parameters),
                      parameters,
                      preferences,
                      // A part asked for at its defaults, as a quick insert from a list.
                      Object.keys(requested ?? {}).length === 0
                  ),
        parameters
    };
}
