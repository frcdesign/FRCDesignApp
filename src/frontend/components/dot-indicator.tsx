import { Indicator, type IndicatorProps } from "@mantine/core";
import { ReactNode } from "react";
import { StatusColor } from "../lib/style-constants";

interface DotIndicatorProps extends Omit<
    IndicatorProps,
    "disabled" | "color" | "size"
> {
    /** Whether there is anything to point out. */
    shown: boolean;
}

/** The app's blue dot, on something that wants a look: a new feature, unsaved edits. */
export function DotIndicator(props: DotIndicatorProps): ReactNode {
    const { shown, offset = 6, ...others } = props;
    return (
        <Indicator
            // No line of text to sit on, so a lone icon inside centres.
            lh={0}
            disabled={!shown}
            color={StatusColor.INFO}
            size={8}
            offset={offset}
            {...others}
        />
    );
}
