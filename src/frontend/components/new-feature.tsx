import { Badge, Indicator, type IndicatorProps } from "@mantine/core";
import { ReactNode } from "react";
import { StatusColor } from "../lib/style-constants";

interface NewIndicatorProps extends Omit<
    IndicatorProps,
    "disabled" | "color" | "size"
> {
    /** Whether there is anything to point out. */
    shown: boolean;
}

/** The blue dot on something worth finding, for somebody who hasn't yet. */
export function NewIndicator(props: NewIndicatorProps): ReactNode {
    const { shown, offset = 6, ...others } = props;
    return (
        <Indicator
            disabled={!shown}
            color={StatusColor.INFO}
            size={8}
            offset={offset}
            {...others}
        />
    );
}

/** The badge beside a new feature's name, in the dot's color. */
export function NewBadge(): ReactNode {
    return <Badge color={StatusColor.INFO}>New</Badge>;
}
