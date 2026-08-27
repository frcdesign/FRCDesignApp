import { Card, Group, Text, Title, Tooltip } from "@mantine/core";
import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { IconSize } from "../../lib/style-constants";
import { formatCount } from "./series-utils";

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
    format = formatCount
}: {
    label: string;
    comparison: PeriodComparison;
    trackingSince: string | null;
    /** Rates need a decimal; counts do not. */
    format?: (value: number) => string;
}): ReactNode {
    return (
        <Card withBorder padding="lg" radius="md">
            <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
                {label}
            </Text>
            <Title order={2}>{format(comparison.current)}</Title>
            <Change
                comparison={comparison}
                trackingSince={trackingSince}
                format={format}
            />
        </Card>
    );
}

function Change({
    comparison,
    trackingSince,
    format
}: {
    comparison: PeriodComparison;
    trackingSince: string | null;
    format: (value: number) => string;
}): ReactNode {
    if (comparison.changeRatio === null) {
        return (
            <Tooltip
                withArrow
                multiline
                w={260}
                label={explain(comparison, trackingSince)}
            >
                <Text size="sm" c="dimmed" w="fit-content">
                    {shortReason(comparison)}
                </Text>
            </Tooltip>
        );
    }

    const rising = comparison.changeRatio >= 0;
    // A flat reading gets neither color: calling 0% green would overstate it.
    const flat = Math.abs(comparison.changeRatio) < 0.005;
    const Arrow = flat ? Minus : rising ? ArrowUp : ArrowDown;
    const color = flat ? "dimmed" : rising ? "green" : "red";

    return (
        <Tooltip
            withArrow
            label={`${format(comparison.previous)} in ${comparison.baselineLabel}`}
        >
            <Group gap={4} w="fit-content">
                <Arrow size={IconSize.TINY} weight="bold" color={color} />
                <Text size="sm" c={color}>
                    {formatPercentChange(comparison.changeRatio)}
                </Text>
                <Text size="sm" c="dimmed">
                    vs {comparison.baselineLabel}
                </Text>
            </Group>
        </Tooltip>
    );
}

/** One decimal, because a rate rounded to a whole number loses the change. */
export function formatRate(value: number): string {
    return value.toFixed(1);
}

function shortReason(comparison: PeriodComparison): string {
    switch (comparison.unavailable) {
        case "zero-baseline":
            return "New";
        case "no-activity":
            return "No uses in either period";
        case "partial-prior-data":
            return "Part of the earlier period is untracked";
        default:
            return "No earlier period to compare";
    }
}

function explain(
    comparison: PeriodComparison,
    trackingSince: string | null
): string {
    const since = trackingSince
        ? `Tracking started ${trackingSince}.`
        : "Nothing has been recorded yet.";
    switch (comparison.unavailable) {
        case "zero-baseline":
            return `Nothing in ${comparison.baselineLabel}, so there is no baseline to grow from.`;
        case "no-activity":
            return `Neither ${comparison.label} nor ${comparison.baselineLabel} recorded any use.`;
        case "partial-prior-data":
            return `${since} It covers only part of ${comparison.baselineLabel}, so a change would overstate the growth.`;
        default:
            return `${since} ${comparison.baselineLabel} came before that, so its zero means unmeasured rather than unused.`;
    }
}

function formatPercentChange(ratio: number): string {
    const sign = ratio > 0 ? "+" : "";
    return `${sign}${(ratio * 100).toFixed(ratio >= 1 || ratio <= -1 ? 0 : 1)}%`;
}
