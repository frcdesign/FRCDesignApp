import { Badge, Tooltip } from "@mantine/core";
import { type ReactNode } from "react";
import styles from "../lib/styles.module.css";
import { m } from "../paraglide/messages";

interface ChangesBadgeProps {
    /** Edits since the last version; omitted for a tab, which Onshape doesn't count. */
    changes?: number;
}

/** What a document or tab has changed since a version, which is what cutting one picks up. */
export function ChangesBadge(props: ChangesBadgeProps): ReactNode {
    const { changes } = props;
    const badge = (
        <Badge className={styles.noShrink}>
            {changes === undefined
                ? m.changesBadgeChanged()
                : m.changesBadge({ count: changes })}
        </Badge>
    );
    // "Changed" says all there is to say about a tab.
    if (changes === undefined) {
        return badge;
    }
    return (
        <Tooltip label={m.changesBadgeTooltip({ count: changes })}>
            {badge}
        </Tooltip>
    );
}
