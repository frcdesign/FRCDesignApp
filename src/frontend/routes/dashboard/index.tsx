import { Stack } from "@mantine/core";
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
    firstPending
} from "../../features/dashboard/dashboard-queries";
import { DashboardState } from "../../features/dashboard/dashboard-state";
import { UsesByLibraryCard } from "../../features/dashboard/uses-chart";
import { UseSourceBreakdown } from "../../features/dashboard/use-mix";
import { toDayRange, useRangePreset } from "../../features/dashboard/range";
import { HeadlineTiles } from "../../features/dashboard/headline-tiles";
import { Section, SectionCard } from "../../components/section";
import { UsageTreemap } from "../../features/dashboard/usage-treemap";
import { VersionManagerTiles } from "../../features/dashboard/version-manager-tiles";
import { FeatureScriptUsageSection } from "../../features/dashboard/featurescript-usage";
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
    const preset = useRangePreset();
    const range = toDayRange(preset);
    const usage = useQuery(getOverviewUsageQuery(range));
    const series = useQuery(getOverviewSeriesQuery(range));
    const sources = useQuery(getOverviewSourcesQuery(range));
    const health = useQuery(getOverviewHealthQuery());
    const versionManager = useQuery(getVersionManagerQuery(range));
    const featureScripts = useQuery(getOverviewFeatureScriptsQuery(range));
    const reports = useQuery(getOverviewReportsQuery(range));
    const featureReach = useQuery(getOverviewFeatureReachQuery(range));
    const allParts = useAllParts(range);
    const pendingParts = firstPending(allParts);

    return (
        <Stack gap="xl">
            <Section title={m.dashboardOverviewOverall()}>
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

            {series.data ? (
                <UsesByLibraryCard series={series.data} />
            ) : (
                <DashboardState
                    query={series}
                    loading={m.dashboardLoadingUsesOverTime()}
                    title={m.dashboardUsesOverTime()}
                />
            )}

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
                <VersionManagerTiles totals={versionManager.data} />
            ) : (
                <DashboardState
                    query={versionManager}
                    loading={m.dashboardLoadingVersionManager()}
                    title={m.dashboardVersionManager()}
                />
            )}

            {featureScripts.data ? (
                <FeatureScriptUsageSection usage={featureScripts.data} />
            ) : (
                <DashboardState
                    query={featureScripts}
                    loading={m.dashboardLoadingFeatureScripts()}
                    title={m.dashboardFeatureScripts()}
                />
            )}

            {reports.data ? (
                <OverviewReports reports={reports.data} />
            ) : (
                <DashboardState
                    query={reports}
                    loading={m.dashboardLoadingReports()}
                    title={m.dashboardReports()}
                />
            )}

            {featureReach.data ? (
                <FeatureReachSection reach={featureReach.data} />
            ) : (
                <DashboardState
                    query={featureReach}
                    loading={m.dashboardLoadingFeatureReach()}
                    title={m.dashboardFeatureReach()}
                />
            )}

            <SectionCard title={m.dashboardOverviewHowUsed()}>
                {sources.data ? (
                    <UseSourceBreakdown sources={sources.data} />
                ) : (
                    <DashboardState
                        query={sources}
                        loading={m.dashboardLoadingSources()}
                    />
                )}
            </SectionCard>

            {pendingParts ? (
                <DashboardState
                    query={pendingParts}
                    loading={m.dashboardLoadingParts()}
                    title={m.dashboardTreemapTitle()}
                />
            ) : (
                <UsageTreemap
                    parts={allParts.flatMap((query) => query.data ?? [])}
                />
            )}
        </Stack>
    );
}
