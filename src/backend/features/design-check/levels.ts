/** Each person's Design Check levels, applied by the page, so changing one costs no Onshape call. */
import { eq } from "drizzle-orm";
import { type Db } from "../../db/client";
import {
    DESIGN_ISSUE_LEVELS,
    type DesignIssueLevels,
    DesignIssueType
} from "./contract";
import { designCheckLevels } from "./schema";

const ISSUE_TYPES = new Set<string>(Object.values(DesignIssueType));
const LEVELS = new Set<string>(DESIGN_ISSUE_LEVELS);

export async function getLevels(
    db: Db,
    userId: string
): Promise<DesignIssueLevels> {
    const row = await db.query.designCheckLevels.findFirst({
        where: eq(designCheckLevels.userId, userId)
    });
    return row ? knownLevels(row.levels) : {};
}

/** Replaces the caller's levels; none left puts them back on FRCDesign's. */
export async function setLevels(
    db: Db,
    userId: string,
    levels: DesignIssueLevels
): Promise<void> {
    if (Object.keys(levels).length === 0) {
        await db
            .delete(designCheckLevels)
            .where(eq(designCheckLevels.userId, userId));
        return;
    }
    const updatedAt = new Date();
    await db
        .insert(designCheckLevels)
        .values({ userId, levels, updatedAt })
        .onConflictDoUpdate({
            target: designCheckLevels.userId,
            set: { levels, updatedAt }
        });
}

/** Drops a type or level this version no longer has. */
function knownLevels(stored: Record<string, string>): DesignIssueLevels {
    return Object.fromEntries(
        Object.entries(stored).filter(
            ([type, level]) => ISSUE_TYPES.has(type) && LEVELS.has(level)
        )
    );
}
