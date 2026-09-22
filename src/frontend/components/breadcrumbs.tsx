import { Breadcrumbs, type MantineSpacing } from "@mantine/core";
import { type ReactNode } from "react";

interface AppBreadcrumbsProps {
    /** The trail in order, separated where they meet. Bare text is wrapped for
     * you; an element keeps its own typography. */
    children: ReactNode;
    /** Spacing off whatever the trail sits above. */
    mb?: MantineSpacing;
}

/** A trail of crumbs, so every one in the app is separated the same way. */
export function AppBreadcrumbs({
    children,
    mb
}: AppBreadcrumbsProps): ReactNode {
    return (
        <Breadcrumbs separator="›" mb={mb}>
            {children}
        </Breadcrumbs>
    );
}
