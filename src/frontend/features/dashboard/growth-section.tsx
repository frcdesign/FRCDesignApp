import { Grid, SimpleGrid, Text } from "@mantine/core";
import { lazy, Suspense, type ReactNode } from "react";
import type { GrowthOut } from "@backend/features/analytics/contract";
import { ComparisonTile, formatRate } from "./comparison-tile";
import { perUnit } from "./derived";
import { Section, SectionCard } from "./section";

const SeasonCurveChart = lazy(() =>
    import("./trend-chart").then((module) => ({
        default: module.SeasonCurveChart
    }))
);

/** Tall enough for two seasons of curve to separate visibly. */
const CURVE_HEIGHT = 260;

/**
 * The trailing month against the month before it.
 *
 * The one section that says something useful from the first weeks of tracking,
 * which is why it leads rather than the season comparison below it.
 */
export function RecentSection({
    growth,
    withOpens = false
}: {
    growth: GrowthOut;
    /** Opens follow the selected library, so the rate is app-level only. */
    withOpens?: boolean;
}): ReactNode {
    const { recent, trackingSince } = growth;
    const perBuilder = perUnit(recent.inserts, recent.activeUsers);
    const perOpen = perUnit(recent.inserts, recent.appOpens);

    return (
        <Section title="Right now" window={recent.inserts.label}>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: withOpens ? 4 : 3 }}>
                <ComparisonTile
                    label="Uses"
                    comparison={recent.inserts}
                    trackingSince={trackingSince}
                />
                <ComparisonTile
                    label="Active builders"
                    comparison={recent.activeUsers}
                    trackingSince={trackingSince}
                />
                <ComparisonTile
                    label="Uses per builder"
                    comparison={perBuilder}
                    trackingSince={trackingSince}
                    format={formatRate}
                />
                {withOpens && (
                    <ComparisonTile
                        label="Uses per app open"
                        comparison={perOpen}
                        trackingSince={trackingSince}
                        format={formatRate}
                    />
                )}
            </SimpleGrid>
        </Section>
    );
}

/**
 * Season against season, which is the comparison that means anything here: a
 * library for a January competition is quiet in July for reasons that are not
 * about the library.
 */
export function SeasonSection({ growth }: { growth: GrowthOut }): ReactNode {
    const { season, seasonCurve, trackingSince } = growth;
    const noBaseline = season.unavailable === "no-prior-data";

    return (
        <Section title="Season over season" window={season.label}>
            <Grid align="flex-start">
                <Grid.Col span={{ base: 12, md: 3 }}>
                    <ComparisonTile
                        label="Uses this season"
                        comparison={season}
                        trackingSince={trackingSince}
                    />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 9 }}>
                    <SectionCard
                        title="Season pace"
                        window={
                            noBaseline
                                ? seasonCurve.label
                                : `${seasonCurve.label} against ${seasonCurve.baselineLabel}, week by week`
                        }
                    >
                        {noBaseline ? (
                            <NoPriorSeason
                                baselineLabel={seasonCurve.baselineLabel}
                            />
                        ) : (
                            <Suspense
                                fallback={
                                    <div style={{ height: CURVE_HEIGHT }} />
                                }
                            >
                                <SeasonCurveChart
                                    curve={seasonCurve}
                                    h={CURVE_HEIGHT}
                                />
                            </Suspense>
                        )}
                    </SectionCard>
                </Grid.Col>
            </Grid>
        </Section>
    );
}

/**
 * What this card is for its first year: drawing a flat zero for a season that
 * predates tracking would read as a season nobody used the app in.
 */
function NoPriorSeason({
    baselineLabel
}: {
    baselineLabel: string;
}): ReactNode {
    return (
        <Text size="sm" c="dimmed" py="xl" ta="center">
            {baselineLabel} finished before tracking started, so there is
            nothing to lay this season over yet.
        </Text>
    );
}
