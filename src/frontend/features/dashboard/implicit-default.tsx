import { Badge, Tooltip, type BadgeProps } from "@mantine/core";
import { type ReactNode } from "react";

/** Why an option nobody declared as the default is one. */
const REASON =
    "This option is the default because it is the first visible option and the default option is not present.";

interface ImplicitDefaultBadgeProps {
    /** Matches the badges beside it. */
    color?: BadgeProps["color"];
    size?: BadgeProps["size"];
    variant?: BadgeProps["variant"];
}

/** The badge, with what makes it a default on hover. */
export function ImplicitDefaultBadge(
    props: ImplicitDefaultBadgeProps
): ReactNode {
    return (
        <Tooltip label={REASON}>
            <Badge {...props}>Implicit default</Badge>
        </Tooltip>
    );
}
