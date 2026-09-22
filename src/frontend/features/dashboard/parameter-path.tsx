import { Text } from "@mantine/core";
import { type ReactNode } from "react";
import { AppBreadcrumbs } from "../../components/breadcrumbs";
import { StatusColor } from "../../lib/style-constants";

interface ParameterPathProps {
    /** The controlling choices, outermost first. */
    path: string[];
    /** The parameter's own name, which ends the trail. The caller supplies it
     * so a card can title it and a table cell can leave it as text. */
    children: ReactNode;
}

/**
 * A parameter under the choices it is shown beneath — "Generic › Tube size".
 * The choices are dimmed so the parameter's own name is what the eye lands on.
 */
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
