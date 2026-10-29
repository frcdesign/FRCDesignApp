import { Alert, Button, Group, Loader, Text } from "@mantine/core";
import { ReactNode } from "react";
import { Status, STATUS_COLOR, statusWash } from "../lib/status";
import { IconSize } from "../lib/style-constants";
import styles from "../lib/styles.module.css";
import { StatusIcon } from "./status-icon";

interface CalloutProps {
    /** A whole sentence, ending in a period. */
    text: string;
    /** A `CalloutButton`; omitted for a note that only reports something. */
    action?: ReactNode;
    /** Sets the color and the {@link StatusIcon}. @default Status.INFO */
    status?: Status;
    /** A spinner in place of the icon, for something still going. */
    loading?: boolean;
}

/** Info by default, so it reads as a remark rather than library content. */
export function Callout(props: CalloutProps): ReactNode {
    const { text, action, status = Status.INFO, loading = false } = props;
    const color = STATUS_COLOR[status];
    const foreground = `light-dark(var(--mantine-color-${color}-light-color), var(--mantine-color-${color}-4))`;

    return (
        <Alert
            color={color}
            py="xs"
            px="sm"
            icon={
                loading ? (
                    <Loader
                        size={IconSize.MEDIUM}
                        color="var(--alert-color)"
                        className={styles.titleIcon}
                    />
                ) : (
                    <StatusIcon
                        status={status}
                        size={IconSize.MEDIUM}
                        // Phosphor fills its check into a square.
                        weight={status === Status.SUCCESS ? "bold" : "fill"}
                        color="var(--alert-color)"
                    />
                )
            }
            vars={() => ({
                root: {
                    "--alert-bg": statusWash(status),
                    "--alert-color": foreground
                }
            })}
            styles={{
                body: { minWidth: 0 },
                wrapper: { alignItems: "center" }
            }}
        >
            {/* Wraps rather than squeezing: on a narrow panel the button drops
                under the text instead of running off the edge. */}
            <Group justify="space-between" gap="xs" wrap="wrap">
                <Text flex="1 1 12rem" c="var(--alert-color)">
                    {text}
                </Text>
                {action}
            </Group>
        </Alert>
    );
}

interface CalloutButtonProps {
    /** A verb or a destination, e.g. "Instructions". */
    children: string;
    icon: ReactNode;
    onClick: () => void;
    /** Matches the callout it sits in. @default Status.INFO */
    status?: Status;
}

export function CalloutButton(props: CalloutButtonProps): ReactNode {
    const { children, icon, onClick, status = Status.INFO } = props;
    return (
        <Button
            variant="outline"
            color={STATUS_COLOR[status]}
            size="compact-sm"
            leftSection={icon}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}
