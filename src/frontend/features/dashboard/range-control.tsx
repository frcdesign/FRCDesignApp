import { SegmentedControl } from "@mantine/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { DEFAULT_RANGE_PRESET, RANGE_PRESETS, type RangePreset } from "./range";

/** Reads the active range preset from the URL. */
export function useRangePreset(): RangePreset {
    const search = useSearch({ from: "/dashboard" });
    return search.range ?? DEFAULT_RANGE_PRESET;
}

export function RangeControl(): ReactNode {
    const navigate = useNavigate();
    const preset = useRangePreset();

    return (
        <SegmentedControl
            size="xs"
            value={preset}
            onChange={(value) => {
                void navigate({
                    to: ".",
                    search: (prev) => ({ ...prev, range: value })
                });
            }}
            data={Object.entries(RANGE_PRESETS).map(([value, { label }]) => ({
                value,
                label
            }))}
        />
    );
}
