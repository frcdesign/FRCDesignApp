import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { PeriodComparison } from "@backend/features/analytics/contract";
import { IconSize } from "../../lib/style-constants";
import { formatCount } from "./format";

/**
 * How a measure changed, always beside the number and never without naming the
 * baseline: these tiles mix windows, so a bare "+82%" would be unreadable.
 */
export function ChangeIndicator({
    comparison,
    trackingSince,
    format = formatCount
}: {
    comparison: PeriodComparison;
    trackingSince: string | null;
    /** Rates need a decimal; counts do not. */
    format?: (value: number) => string;
}): ReactNode {
    if (comparison.changeRatio === null) {
        return (
            <Tooltip
                withArrow
                multiline
                w={260}
                label={explain(comparison, trackingSince)}
            >
                <Text size="sm" c="dimmed" w="fit-content" ta="right">
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

    return (
        <Tooltip
            withArrow
            label={`${format(comparison.previous)} in ${comparison.baselineLabel}`}
        >
            <Stack gap={0} align="flex-end" w="fit-content">
                {change}
                <Text size="xs" c="dimmed" ta="right">
                    vs {comparison.baselineShort}
                </Text>
            </Stack>
        </Tooltip>
    );
}

/** One decimal, because a rate rounded to a whole number loses the change. */
export function formatRate(value: number): string {
    return value.toFixed(1);
}

/** Sits where the chip does, so it is kept as short; `explain` has the rest. */
function shortReason(comparison: PeriodComparison): string {
    switch (comparison.unavailable) {
        case "zero-baseline":
            return "New";
        case "no-activity":
            return "No activity";
        case "partial-prior-data":
            return "Partial baseline";
        default:
            return "No baseline";
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

/** A decimal only under 10%, where rounding to a whole number loses the move. */
function formatPercentChange(ratio: number): string {
    const percent = ratio * 100;
    const sign = percent > 0 ? "+" : "";
    return `${sign}${percent.toFixed(Math.abs(percent) < 10 ? 1 : 0)}%`;
}
