import { Group, Text } from "@mantine/core";
import type { Icon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { formatTimeAgo } from "../lib/format-time";
import { IconSize, StatusColor } from "../lib/style-constants";
import styles from "../lib/styles.module.css";
import { AppIcon } from "./app-icon";

interface TimeAgoProps {
    /** Epoch ms; absent reads as "Unknown". */
    timestamp?: number;
    /** What the time is of: a version, a run. */
    icon: Icon;
}

/** How long ago something happened, small and dimmed beside what it is about. */
export function TimeAgo(props: TimeAgoProps): ReactNode {
    const { timestamp, icon } = props;
    return (
        <Group
            gap={4}
            c={StatusColor.DIMMED}
            className={styles.noShrink}
            style={{ whiteSpace: "nowrap" }}
        >
            <AppIcon icon={icon} size={IconSize.TINY} />
            <Text size="xs">
                {timestamp ? formatTimeAgo(timestamp) : "Unknown"}
            </Text>
        </Group>
    );
}
