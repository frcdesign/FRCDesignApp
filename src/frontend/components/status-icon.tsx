import { ReactNode } from "react";
import { Status, STATUS_COLOR, STATUS_ICON } from "../lib/status";
import styles from "../lib/styles.module.css";
import { AppIcon, type AppIconProps } from "./app-icon";

export interface StatusIconProps extends Omit<AppIconProps, "icon"> {
    status: Status;
    /**
     * Off where something else places it: a title that raises its own icon, or
     * a badge or circle it is centred in. @default true
     */
    raised?: boolean;
}

/**
 * A status as the app draws it everywhere: a check, info, warning or stop sign,
 * in its color unless the caller gives another. Raised a pixel, as a title's
 * icon is, since it almost always sits beside text.
 */
export function StatusIcon(props: StatusIconProps): ReactNode {
    const {
        status,
        color = STATUS_COLOR[status],
        className,
        raised = true,
        ...others
    } = props;
    return (
        <AppIcon
            icon={STATUS_ICON[status]}
            color={color}
            className={`${raised ? styles.titleIcon : ""} ${className ?? ""}`}
            {...others}
        />
    );
}
