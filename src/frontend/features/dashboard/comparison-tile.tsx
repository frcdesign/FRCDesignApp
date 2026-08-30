import { Card, Text, Title } from "@mantine/core";
import { lazy, Suspense, type ReactNode } from "react";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { ChangeIndicator } from "./change-indicator";
import { formatCount } from "./series-utils";

const MiniSparkline = lazy(() =>
    import("./sparkline").then((module) => ({
        default: module.MiniSparkline
    }))
);

const SPARKLINE_HEIGHT = 40;

/**
 * A number and how it changed, or why it cannot say.
 *
 * Kept separate from `TrendTile` on purpose: that one always has a sparkline
 * and always has a value to show, while this one spends most of its first year
 * with no comparison to make. Folding both into one component would mean a
 * tile whose whole lower half is conditional.
 */
export function ComparisonTile({
    label,
    comparison,
    trackingSince,
    format = formatCount,
    spark
}: {
    label: string;
    comparison: PeriodComparison;
    trackingSince: string | null;
    /** Rates need a decimal; counts do not. */
    format?: (value: number) => string;
    /** The measure's shape across exactly the window it reports on. */
    spark?: number[];
}): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                {label}
            </Text>
            <Title order={2}>{format(comparison.current)}</Title>
            <ChangeIndicator
                comparison={comparison}
                trackingSince={trackingSince}
                format={format}
            />
            {spark && (
                <Suspense
                    fallback={<div style={{ height: SPARKLINE_HEIGHT }} />}
                >
                    <MiniSparkline data={spark} h={SPARKLINE_HEIGHT} />
                </Suspense>
            )}
        </Card>
    );
}
