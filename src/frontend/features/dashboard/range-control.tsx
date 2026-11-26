import { SegmentedControl } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
    CHART_RANGE_PRESETS,
    isRangePreset,
    RANGE_PRESETS,
    useChartPreset,
    useRangePreset,
    type ChartRangeKey
} from "./range";

export function RangeControl(): ReactNode {
    const navigate = useNavigate();
    const preset = useRangePreset();

    return (
        <SegmentedControl
            size="xs"
            value={preset}
            onChange={(value) => {
                // Narrows Mantine's string for the router.
                if (!isRangePreset(value)) return;
                void navigate({
                    to: ".",
                    search: { range: value },
                    resetScroll: false
                });
            }}
            data={Object.entries(RANGE_PRESETS).map(([value, { label }]) => ({
                value,
                label
            }))}
        />
    );
}

interface ChartRangeControlProps {
    searchKey: ChartRangeKey;
}

/** One overview chart's own range, beside its title. */
export function ChartRangeControl({
    searchKey
}: ChartRangeControlProps): ReactNode {
    const navigate = useNavigate();
    const preset = useChartPreset(searchKey);

    return (
        <SegmentedControl
            size="xs"
            value={preset}
            onChange={(value) => {
                if (!isRangePreset(value)) return;
                void navigate({
                    to: ".",
                    search: (search) => ({ ...search, [searchKey]: value }),
                    resetScroll: false
                });
            }}
            data={CHART_RANGE_PRESETS.map((value) => ({
                value,
                label: RANGE_PRESETS[value].label
            }))}
        />
    );
}
