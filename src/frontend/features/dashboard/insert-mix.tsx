import { Card, Group, Progress, Stack, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type {
    AnalyticsTotals,
    InsertSourceUsage
} from "@backend/features/analytics/contract";
import { InsertSource } from "@backend/features/analytics/usage";
import { FontWeight } from "../../lib/style-constants";
import { formatCount, formatFraction } from "./format";

const SOURCE_LABELS: Record<InsertSource, string> = {
    [InsertSource.SEARCH]: "Search results",
    [InsertSource.GROUP_SEARCH]: "Search within a group",
    [InsertSource.BROWSE]: "Browsing a group",
    [InsertSource.FAVORITES]: "Favorites list",
    [InsertSource.QUICK_FASTENER]: "Quick fastener"
};

/** One bar of a breakdown: its share of the bars' sum. */
interface Share {
    label: string;
    count: number;
}

interface ShareBreakdownProps {
    title: string;
    /** What the shares are of, where the title doesn't say. */
    description?: string;
    shares: Share[];
}

/** Each share as a fraction of their sum, in a card of its own. */
function ShareBreakdown(props: ShareBreakdownProps): ReactNode {
    const { title, description, shares } = props;
    const total = shares.reduce((sum, share) => sum + share.count, 0);

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
                {total === 0 ? (
                    <Text c="dimmed" py="md" ta="center">
                        None recorded yet.
                    </Text>
                ) : (
                    shares.map((share) => (
                        <div key={share.label}>
                            <Group justify="space-between" gap="xs" mb={4}>
                                <Text>{share.label}</Text>
                                <Text c="dimmed">
                                    {formatCount(share.count)} (
                                    {formatFraction(share.count, total)})
                                </Text>
                            </Group>
                            <Progress
                                value={(share.count / total) * 100}
                                size="sm"
                            />
                        </div>
                    ))
                )}
            </Stack>
        </Card>
    );
}

interface InsertSourceBreakdownProps {
    sources: InsertSourceUsage[];
}

/** Where inserts started from, each as a fraction of every insert. */
export function InsertSourceBreakdown(
    props: InsertSourceBreakdownProps
): ReactNode {
    return (
        <ShareBreakdown
            title="Where inserts start"
            shares={props.sources.map((source) => ({
                label: SOURCE_LABELS[source.source],
                count: source.count
            }))}
        />
    );
}

interface TotalsBreakdownProps {
    totals: AnalyticsTotals;
}

/** Every insert, by the way it was made. */
export function InsertMethodBreakdown(props: TotalsBreakdownProps): ReactNode {
    return (
        <ShareBreakdown
            title="How parts are inserted"
            shares={insertMethodShares(props.totals)}
        />
    );
}

/** A part offering insert and fasten, inserted into an assembly, by how it was placed. */
export function FastenMethodBreakdown(props: TotalsBreakdownProps): ReactNode {
    return (
        <ShareBreakdown
            title="How insert and fasten parts are placed"
            description="Inserts into an assembly of a part offering insert and fasten."
            shares={fastenMethodShares(props.totals)}
        />
    );
}

function insertMethodShares(totals: AnalyticsTotals): Share[] {
    const { inserts, quickInserts, quickFastenerInserts } = totals;
    return [
        {
            label: "Insert menu",
            count: Math.max(0, inserts - quickInserts - quickFastenerInserts)
        },
        { label: "Quick insert", count: quickInserts },
        { label: "Quick fastener", count: quickFastenerInserts }
    ];
}

function fastenMethodShares(totals: AnalyticsTotals): Share[] {
    const { fastenableInserts, preselectedInserts, quickFastenerInserts } =
        totals;
    return [
        {
            label: "Inserted normally",
            count: Math.max(
                0,
                fastenableInserts - preselectedInserts - quickFastenerInserts
            )
        },
        { label: "Fastened to preselected edges", count: preselectedInserts },
        { label: "Quick fastener", count: quickFastenerInserts }
    ];
}
