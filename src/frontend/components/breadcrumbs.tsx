import { Breadcrumbs, type MantineSpacing } from "@mantine/core";
import { type ReactNode } from "react";

interface AppBreadcrumbsProps {
    /** Bare text is wrapped; elements keep their own typography. */
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
