import { SegmentedControl } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { isRangePreset, RANGE_PRESETS, useRangePreset } from "./range";

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
                void navigate({ to: ".", search: { range: value } });
            }}
            data={Object.entries(RANGE_PRESETS).map(([value, { label }]) => ({
                value,
                label
            }))}
        />
    );
}
