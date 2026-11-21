/** How usage spreads across people, all time: aggregates only, as every analytics read. */
import { count, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import { favorites } from "../../db/schema";
import { userStats } from "./schema";
import { type DistributionsOut } from "./contract";
import { toHistogram } from "./histogram";

/** Among everybody who used a part: their uses, and how many favorites they keep. */
export async function getDistributions(db: Db): Promise<DistributionsOut> {
    const [uses, favoriteCounts] = await Promise.all([
        db
            .select({
                userId: userStats.userId,
                uses: sum(userStats.useCount).mapWith(Number)
            })
            .from(userStats)
            .groupBy(userStats.userId)
            .all(),
        db
            .select({ userId: favorites.userId, favorites: count() })
            .from(favorites)
            .groupBy(favorites.userId)
            .all()
    ]);
    const favoritesByUser = new Map(
        favoriteCounts.map((row) => [row.userId, row.favorites])
    );
    return {
        users: uses.length,
        usesPerUser: toHistogram(
            uses.map((row) => row.uses),
            true
        ),
        favoritesPerUser: toHistogram(
            uses.map((row) => favoritesByUser.get(row.userId) ?? 0),
            true
        )
    };
}
