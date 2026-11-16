import { and, countDistinct, gte, lte, sum } from "drizzle-orm";
import { type Db } from "../../db/client";
import { featureScripts } from "../featurescripts/schema";
import { dailyFeatureScriptMetrics, dailyFeatureScriptUsers } from "./schema";
import type { FeatureScriptUsage, FeatureScriptUsageOut } from "./contract";
import { type DayRange } from "./day";

/** Adds and users per feature over the range, and the distinct users in all. */
export async function getFeatureScriptUsage(
    db: Db,
    range: DayRange
): Promise<FeatureScriptUsageOut> {
    const inAddRange = and(
        gte(dailyFeatureScriptMetrics.day, range.from),
        lte(dailyFeatureScriptMetrics.day, range.to)
    );
    const inUserRange = and(
        gte(dailyFeatureScriptUsers.day, range.from),
        lte(dailyFeatureScriptUsers.day, range.to)
    );
    const [features, adds, users, total] = await Promise.all([
        db
            .select({
                featureType: featureScripts.featureType,
                name: featureScripts.name
            })
            .from(featureScripts)
            .all(),
        db
            .select({
                featureType: dailyFeatureScriptMetrics.featureType,
                adds: sum(dailyFeatureScriptMetrics.adds).mapWith(Number)
            })
            .from(dailyFeatureScriptMetrics)
            .where(inAddRange)
            .groupBy(dailyFeatureScriptMetrics.featureType)
            .all(),
        db
            .select({
                featureType: dailyFeatureScriptUsers.featureType,
                users: countDistinct(dailyFeatureScriptUsers.userId)
            })
            .from(dailyFeatureScriptUsers)
            .where(inUserRange)
            .groupBy(dailyFeatureScriptUsers.featureType)
            .all(),
        db
            .select({ users: countDistinct(dailyFeatureScriptUsers.userId) })
            .from(dailyFeatureScriptUsers)
            .where(inUserRange)
            .get()
    ]);

    const usersByType = new Map(users.map((row) => [row.featureType, row]));
    const byType = new Map<string, FeatureScriptUsage>();
    for (const feature of features) {
        byType.set(feature.featureType, { ...feature, adds: 0, users: 0 });
    }
    // A feature since removed from the document keeps its adds, by its constant.
    for (const row of adds) {
        const usage = byType.get(row.featureType) ?? {
            featureType: row.featureType,
            adds: 0,
            users: 0
        };
        usage.adds = row.adds;
        usage.users = usersByType.get(row.featureType)?.users ?? 0;
        byType.set(row.featureType, usage);
    }

    const rows = [...byType.values()].sort(
        (a, b) =>
            b.adds - a.adds ||
            (a.name ?? a.featureType).localeCompare(b.name ?? b.featureType)
    );
    return {
        adds: rows.reduce((added, row) => added + row.adds, 0),
        users: total?.users ?? 0,
        features: rows
    };
}
