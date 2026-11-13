import { Card, Group, Progress, Stack, Text } from "@mantine/core";
import { type ReactNode } from "react";
import {
    type AnalyticsTotals,
    insertsOf,
    type UseSourceUsage
} from "@backend/features/analytics/contract";
import { UseSource } from "@backend/features/analytics/usage";
import { FontWeight } from "../../lib/style-constants";
import { formatCount, formatFraction } from "./format";
import { DashboardEmpty } from "./dashboard-state";
import { m } from "../../paraglide/messages";

function sourceLabel(source: UseSource): string {
    switch (source) {
        case UseSource.SEARCH:
            return m.dashboardSourceSearch();
        case UseSource.GROUP_SEARCH:
            return m.dashboardSourceGroupSearch();
        case UseSource.BROWSE:
            return m.dashboardSourceBrowse();
        case UseSource.FAVORITES:
            return m.dashboardSourceFavorites();
        case UseSource.RECENTS:
            return m.dashboardSourceRecents();
        case UseSource.AUTO_ASSEMBLY:
            return m.dashboardAutoAssembly();
        case UseSource.EDIT:
            return m.dashboardSourceEdit();
    }
}

/** One bar of a breakdown: its share of the bars' sum. */
interface Share {
    label: string;
    count: number;
}

interface ShareBarsProps {
    shares: Share[];
    empty: string;
}

/** Each share as a fraction of their sum. */
function ShareBars({ shares, empty }: ShareBarsProps): ReactNode {
    const total = shares.reduce((sum, share) => sum + share.count, 0);

    if (total === 0) {
        return <DashboardEmpty title={empty} />;
    }

    return (
        <Stack gap="xs">
            {shares.map((share) => (
                <div key={share.label}>
                    <Group justify="space-between" gap="xs" mb={4}>
                        <Text>{share.label}</Text>
                        <Text c="dimmed">
                            {formatCount(share.count)} (
                            {formatFraction(share.count, total)})
                        </Text>
                    </Group>
                    <Progress value={(share.count / total) * 100} size="sm" />
                </div>
            ))}
        </Stack>
    );
}

interface UseSourceBreakdownProps {
    sources: UseSourceUsage[];
}

/** Where uses started from, each as a fraction of every use. */
export function UseSourceBreakdown({
    sources
}: UseSourceBreakdownProps): ReactNode {
    return (
        <ShareBars
            shares={sources.map((source) => ({
                label: sourceLabel(source.source),
                count: source.count
            }))}
            empty={m.dashboardSourcesEmpty()}
        />
    );
}

interface ShareCardProps {
    title: string;
    /** What the shares are of, where the title doesn't say. */
    description?: string;
    shares: Share[];
}

function ShareCard({ title, description, shares }: ShareCardProps): ReactNode {
    return (
        <Card>
            <Stack gap="xs">
                <div>
                    <Text fw={FontWeight.SEMI_BOLD}>{title}</Text>
                    {description && (
                        <Text size="sm" c="dimmed">
                            {description}
                        </Text>
                    )}
                </div>
                <ShareBars shares={shares} empty={m.dashboardSharesEmpty()} />
            </Stack>
        </Card>
    );
}

interface TotalsBreakdownProps {
    totals: AnalyticsTotals;
}

/** Every insert, by the way it was made; downloads aren't inserts. */
export function InsertMethodBreakdown({
    totals
}: TotalsBreakdownProps): ReactNode {
    const { quickInserts, autoAssemblyInserts } = totals;
    const inserts = insertsOf(totals.targets);
    return (
        <ShareCard
            title={m.dashboardInsertMethodTitle()}
            shares={[
                {
                    label: m.dashboardInsertMethodMenu(),
                    count: Math.max(
                        0,
                        inserts - quickInserts - autoAssemblyInserts
                    )
                },
                { label: m.dashboardInsertMethodQuick(), count: quickInserts },
                { label: m.dashboardAutoAssembly(), count: autoAssemblyInserts }
            ]}
        />
    );
}

/** A part offering insert and fasten, inserted into an assembly, by how it was placed. */
export function FastenMethodBreakdown({
    totals
}: TotalsBreakdownProps): ReactNode {
    const { fastenableInserts, preselectedInserts, autoAssemblyInserts } =
        totals;
    return (
        <ShareCard
            title={m.dashboardFastenMethodTitle()}
            description={m.dashboardFastenMethodDescription()}
            shares={[
                {
                    label: m.dashboardFastenMethodNormal(),
                    count: Math.max(
                        0,
                        fastenableInserts -
                            preselectedInserts -
                            autoAssemblyInserts
                    )
                },
                {
                    label: m.dashboardFastenMethodPreselected(),
                    count: preselectedInserts
                },
                { label: m.dashboardAutoAssembly(), count: autoAssemblyInserts }
            ]}
        />
    );
}
