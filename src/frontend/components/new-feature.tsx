import { Badge } from "@mantine/core";
import { ReactNode } from "react";
import { StatusColor } from "../lib/style-constants";
import { DotIndicator, type DotIndicatorProps } from "./dot-indicator";

/** The blue dot on something worth finding, for somebody who hasn't yet. */
export function NewIndicator(props: DotIndicatorProps): ReactNode {
    return <DotIndicator {...props} />;
}

/** The badge beside a new feature's name, in the dot's color. */
export function NewBadge(): ReactNode {
    return <Badge color={StatusColor.INFO}>New</Badge>;
}
