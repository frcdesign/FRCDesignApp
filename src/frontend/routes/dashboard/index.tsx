import { SimpleGrid, Stack } from "@mantine/core";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { type DayRange } from "@backend/features/analytics/day";
import {
    getOverviewFeatureReachQuery,
    getOverviewFeatureScriptsQuery,
    getOverviewHealthQuery,
    getOverviewReportsQuery,
    getOverviewSeriesQuery,
    getOverviewSourcesQuery,
    getOverviewUsageQuery,
    getPartsQuery,
    getVersionManagerQuery,
    getDesignCheckQuery,
    firstPending
} from "../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../features/dashboard/dashboard-state";
import { UsesByLibraryChart } from "../../features/dashboard/uses-chart";
import { ChartRangeControl } from "../../features/dashboard/range-control";
import {
    FastenMethodBreakdown,
    InsertMethodBreakdown,
    UseSourceBreakdown
} from "../../features/dashboard/use-mix";
import {
    OVERVIEW_TOTALS_PRESET,
    RANGE_PRESETS,
    RangePreset,
    toDayRange,
    useChartPreset
} from "../../features/dashboard/range";
import { HeadlineTiles } from "../../features/dashboard/headline-tiles";
import { Section, SectionCard } from "../../components/section";
import { UsageTreemap } from "../../features/dashboard/usage-treemap";
import { VersionManagerTiles } from "../../features/dashboard/version-manager-tiles";
import { FeatureScriptUsageSection } from "../../features/dashboard/featurescript-usage";
import { DesignCheckTiles } from "../../features/dashboard/design-check-tiles";
import { OverviewReports } from "../../features/dashboard/report-summary";
import { HealthTiles } from "../../features/dashboard/health-report";
import { FeatureReachSection } from "../../features/dashboard/feature-reach-section";
import { m } from "../../paraglide/messages";

export const Route = createFileRoute("/dashboard/")({
    component: DashboardOverview
});

/** Every library's parts, so the treemap can start above all of them. */
function useAllParts(range: DayRange) {
    return useQueries({
        queries: Object.values(LibraryId).map((libraryId) =>
            getPartsQuery(libraryId, range)
        )
    });
}

function DashboardOverview(): ReactNode {
    // Totals and breakdowns cover one fixed window; the two charts pick their own.
    const range = toDayRange(OVERVIEW_TOTALS_PRESET);
    // The headline is all time, its changes and sparklines the recent window.
    const allTime = toDayRange(RangePreset.ALL);
    const caption = m.dashboardRangeLastDays({
        days: RANGE_PRESETS[OVERVIEW_TOTALS_PRESET].days ?? 0
    });
    const usesRange = toDayRange(useChartPreset("usesRange"));
    const featureRange = toDayRange(useChartPreset("featureRange"));
    const usage = useQuery(getOverviewUsageQuery(allTime, range));
    const series = useQuery(getOverviewSeriesQuery(usesRange));
    const sources = useQuery(getOverviewSourcesQuery(range));
    const health = useQuery(getOverviewHealthQuery());
    // Rare enough that a month of them says little
    const versionManager = useQuery(getVersionManagerQuery(allTime));
    const featureScripts = useQuery(getOverviewFeatureScriptsQuery(allTime));
    const designCheck = useQuery(getDesignCheckQuery(allTime));
    const reports = useQuery(getOverviewReportsQuery(allTime));
    const allTimeCaption = m.dashboardRangeAllTime();
    const featureReach = useQuery(getOverviewFeatureReachQuery(featureRange));
    const allParts = useAllParts(range);
    const pendingParts = firstPending(allParts);

    return (
        <Stack gap="xl">
            <Section
                title={m.dashboardOverviewOverall()}
                caption={m.dashboardRangeAllTime()}
            >
                {usage.data ? (
                    <HeadlineTiles
                        totals={usage.data.totals}
                        growth={usage.data.growth}
                        series={usage.data.metricSeries}
                        withOpens
                    />
                ) : (
                    <DashboardState
                        query={usage}
                        loading={m.dashboardLoadingUsage()}
                    />
                )}
            </Section>

            <SectionCard
                title={m.dashboardUsesOverTime()}
                aside={<ChartRangeControl searchKey="usesRange" />}
            >
                {series.data ? (
                    <UsesByLibraryChart series={series.data} />
                ) : (
                    <DashboardState
                        query={series}
                        loading={m.dashboardLoadingUsesOverTime()}
                    />
                )}
            </SectionCard>

            <FeatureReachSection query={featureReach} />

            <Section title={m.dashboardHealthLibraries()}>
                {health.data ? (
                    <HealthTiles counts={health.data} />
                ) : (
                    <DashboardState
                        query={health}
                        loading={m.dashboardLoadingHealth()}
                    />
                )}
            </Section>

            {versionManager.data ? (
                <VersionManagerTiles
                    totals={versionManager.data}
                    caption={allTimeCaption}
                />
            ) : (
                <DashboardState
                    query={versionManager}
                    loading={m.dashboardLoadingVersionManager()}
                    title={m.dashboardVersionManager()}
                    caption={allTimeCaption}
                />
            )}

            {featureScripts.data ? (
                <FeatureScriptUsageSection
                    usage={featureScripts.data}
                    caption={allTimeCaption}
                />
            ) : (
                <DashboardState
                    query={featureScripts}
                    loading={m.dashboardLoadingFeatureScripts()}
                    title={m.dashboardFeatureScripts()}
                    caption={allTimeCaption}
                />
            )}

            {designCheck.data ? (
                <DesignCheckTiles
                    totals={designCheck.data}
                    caption={allTimeCaption}
                />
            ) : (
                <DashboardState
                    query={designCheck}
                    loading={m.dashboardLoadingDesignCheck()}
                    title={m.dashboardDesignCheck()}
                    caption={allTimeCaption}
                />
            )}

            {reports.data ? (
                <OverviewReports
                    reports={reports.data}
                    caption={allTimeCaption}
                />
            ) : (
                <DashboardState
                    query={reports}
                    loading={m.dashboardLoadingReports()}
                    title={m.dashboardReports()}
                    caption={allTimeCaption}
                />
            )}

            <SectionCard title={m.dashboardOverviewHowUsed()} caption={caption}>
                {sources.data ? (
                    <UseSourceBreakdown sources={sources.data} />
                ) : (
                    <DashboardState
                        query={sources}
                        loading={m.dashboardLoadingSources()}
                    />
                )}
            </SectionCard>
            {usage.data && (
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <InsertMethodBreakdown totals={usage.data.totals} />
                    <FastenMethodBreakdown totals={usage.data.totals} />
                </SimpleGrid>
            )}

            {pendingParts ? (
                <DashboardState
                    query={pendingParts}
                    loading={m.dashboardLoadingParts()}
                    title={m.dashboardTreemapTitle()}
                    caption={caption}
                />
            ) : (
                <UsageTreemap
                    parts={allParts.flatMap((query) => query.data ?? [])}
                    caption={caption}
                />
            )}
        </Stack>
    );
}
