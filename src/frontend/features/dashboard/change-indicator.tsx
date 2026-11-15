import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    ChangeUnavailable,
    type PeriodComparison
} from "@backend/features/analytics/contract";
import { IconSize, StatusColor } from "../../lib/style-constants";
import { formatCount } from "./format";

interface ChangeIndicatorProps {
    comparison: PeriodComparison;
    /** Rates need a decimal; counts do not. */
    format?: (value: number) => string;
}

/** Always names the baseline, since the tiles mix windows. */
export function ChangeIndicator({
    comparison,
    format = formatCount
}: ChangeIndicatorProps): ReactNode {
    if (comparison.changeRatio === undefined) {
        return (
            <Tooltip label={explain(comparison)}>
                <Text c="dimmed" w="fit-content" ta="right">
                    {shortReason(comparison)}
                </Text>
            </Tooltip>
        );
    }

    const rising = comparison.changeRatio >= 0;
    // A flat reading gets no arrow or color: calling 0% green would overstate it.
    const flat = Math.abs(comparison.changeRatio) < 0.005;
    const Arrow = rising ? ArrowUpIcon : ArrowDownIcon;
    const color = flat
        ? StatusColor.DIMMED
        : rising
          ? StatusColor.SUCCESS
          : StatusColor.ERROR;

    // The icon takes the text's color, and its direction is the only sign.
    const change = (
        <Group gap={4} c={color}>
            {!flat && <Arrow size={IconSize.TINY} weight="bold" />}
            <Text c={color}>{formatPercentChange(comparison.changeRatio)}</Text>
        </Group>
    );

    return (
        <Tooltip
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

/** Sits where the chip does, so it is kept as short; `explain` has the rest. */
function shortReason(comparison: PeriodComparison): string {
    switch (comparison.unavailable) {
        case ChangeUnavailable.ZERO_BASELINE:
            return "New";
        case ChangeUnavailable.NO_ACTIVITY:
            return "No activity";
        case ChangeUnavailable.PARTIAL_PRIOR_DATA:
            return "Partial baseline";
        default:
            return "No baseline";
    }
}

function explain(comparison: PeriodComparison): string {
    switch (comparison.unavailable) {
        case ChangeUnavailable.ZERO_BASELINE:
            return `Nothing in ${comparison.baselineLabel}, so there is no baseline to grow from.`;
        case ChangeUnavailable.NO_ACTIVITY:
            return `Neither ${comparison.label} nor ${comparison.baselineLabel} recorded any use.`;
        case ChangeUnavailable.PARTIAL_PRIOR_DATA:
            return `Tracking covers only part of ${comparison.baselineLabel}, so a change would overstate the growth.`;
        default:
            return `${comparison.baselineLabel} came before tracking started, so its zero means unmeasured rather than unused.`;
    }
}

/** A decimal only under 10%, where rounding to a whole number loses the move. */
function formatPercentChange(ratio: number): string {
    const percent = Math.abs(ratio * 100);
    return `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
}
