import { Anchor, Breadcrumbs, Text, type MantineSpacing } from "@mantine/core";
import { type ReactNode } from "react";
import { StatusColor } from "../lib/style-constants";

export interface Crumb {
    label: string;
    /** Makes the crumb a link back to its level; without one it's dimmed text. */
    onClick?: () => void;
}

interface AppBreadcrumbsProps {
    /** Outermost first. */
    crumbs: Crumb[];
    /** Where the trail ends; a string is set as plain text. */
    current: ReactNode;
    mb?: MantineSpacing;
}

/** With no crumbs, just `current`. */
export function AppBreadcrumbs(props: AppBreadcrumbsProps): ReactNode {
    const { crumbs, current, mb } = props;
    const end =
        typeof current === "string" ? (
            <Text size="sm">{current}</Text>
        ) : (
            current
        );
    if (crumbs.length === 0) {
        return end;
    }
    return (
        <Breadcrumbs separator="›" mb={mb}>
            {crumbs.map((crumb) =>
                crumb.onClick ? (
                    <Anchor key={crumb.label} size="sm" onClick={crumb.onClick}>
                        {crumb.label}
                    </Anchor>
                ) : (
                    <Text key={crumb.label} size="sm" c={StatusColor.DIMMED}>
                        {crumb.label}
                    </Text>
                )
            )}
            {end}
        </Breadcrumbs>
    );
}
