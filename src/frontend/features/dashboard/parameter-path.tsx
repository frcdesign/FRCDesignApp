import { Text } from "@mantine/core";
import { type ReactNode } from "react";
import { StatusColor } from "../../lib/style-constants";

interface ParameterPathProps {
    /** The controlling choices, outermost first; nothing renders for a
     * parameter no other choice conditions. */
    path: string[];
}

/**
 * The choices a parameter is shown under, as a prefix to its name — "Generic ›"
 * in front of the list a Generic vendor offers. Dimmed and inline, so the
 * parameter's own name is still what the eye lands on.
 */
export function ParameterPath({ path }: ParameterPathProps): ReactNode {
    if (path.length === 0) {
        return null;
    }

    return (
        <Text span size="sm" c={StatusColor.DIMMED}>
            {path.join(" › ")} ›
        </Text>
    );
}
