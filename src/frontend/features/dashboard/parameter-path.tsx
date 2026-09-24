import { Text } from "@mantine/core";
import { type ReactNode } from "react";
import { AppBreadcrumbs } from "../../components/breadcrumbs";
import { StatusColor } from "../../lib/style-constants";

interface ParameterPathProps {
    /** The controlling choices, outermost first. */
    path: string[];
    /** Supplied by the caller, so a card can title it. */
    children: ReactNode;
}

/** "Generic › Tube size", with the choices dimmed. */
export function ParameterPath({
    path,
    children
}: ParameterPathProps): ReactNode {
    if (path.length === 0) {
        return children;
    }

    return (
        <AppBreadcrumbs>
            {path.map((label) => (
                <Text key={label} size="sm" c={StatusColor.DIMMED}>
                    {label}
                </Text>
            ))}
            {children}
        </AppBreadcrumbs>
    );
}
