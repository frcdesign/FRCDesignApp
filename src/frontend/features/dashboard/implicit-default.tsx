import { Badge, Tooltip, type BadgeProps } from "@mantine/core";
import { type ReactNode } from "react";

/** Why an option nobody declared as the default is one. */
const REASON =
    "This option is the default because it is the first visible option and the default option is not present.";

/** Wide enough for the reason to wrap rather than run out as one ribbon. */
const TOOLTIP_WIDTH = 260;

interface ImplicitDefaultBadgeProps {
    /** Taken from the badges it stands beside, which differ between the
     * breakdown cards and the low-usage table. */
    color?: BadgeProps["color"];
    size?: BadgeProps["size"];
    variant?: BadgeProps["variant"];
}

/** The badge, with what makes it a default on hover. */
export function ImplicitDefaultBadge(
    props: ImplicitDefaultBadgeProps
): ReactNode {
    return (
        <Tooltip withArrow multiline w={TOOLTIP_WIDTH} label={REASON}>
            <Badge {...props}>Implicit default</Badge>
        </Tooltip>
    );
}
