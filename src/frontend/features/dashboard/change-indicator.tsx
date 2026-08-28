import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { IconSize } from "../../lib/style-constants";
import { formatCount } from "./series-utils";

/**
 * How a measure changed, or why it cannot be said.
 *
 * A percentage is never shown without what it is measured against: the tiles
 * that use this mix windows deliberately — an all-time value with a
 * season-over-season change — so a bare "+82%" would be unreadable.
 */
export function ChangeIndicator({
    comparison,
    trackingSince,
    format = formatCount,
    stacked = false
}: {
    comparison: PeriodComparison;
    trackingSince: string | null;
    /** Rates need a decimal; counts do not. */
    format?: (value: number) => string;
    /** Two right-aligned lines, for the corner a stat tile's icon vacated. */
    stacked?: boolean;
}): ReactNode {
    if (comparison.changeRatio === null) {
        return (
            <Tooltip
                withArrow
                multiline
                w={260}
                label={explain(comparison, trackingSince)}
            >
                <Text
                    size="sm"
                    c="dimmed"
                    w="fit-content"
                    ta={stacked ? "right" : undefined}
                >
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

    const change = (
        <Group gap={4} wrap="nowrap">
            <Arrow size={IconSize.TINY} weight="bold" color={color} />
            <Text size="sm" c={color}>
                {formatPercentChange(comparison.changeRatio)}
            </Text>
        </Group>
    );
    const against = (
        <Text
            size={stacked ? "xs" : "sm"}
            c="dimmed"
            ta={stacked ? "right" : undefined}
        >
            vs {comparison.baselineLabel}
        </Text>
    );
    const Layout = stacked ? Stack : Group;

    return (
        <Tooltip
            withArrow
            label={`${format(comparison.previous)} in ${comparison.baselineLabel}`}
        >
            <Layout
                gap={stacked ? 0 : 4}
                align={stacked ? "flex-end" : "center"}
                w="fit-content"
            >
                {change}
                {against}
            </Layout>
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
