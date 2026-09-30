import { ReactNode } from "react";
import { Status, STATUS_COLOR, STATUS_ICON } from "../lib/status";
import { AppIcon, type AppIconProps } from "./app-icon";

interface StatusIconProps extends Omit<AppIconProps, "icon"> {
    status: Status;
}

/**
 * A status as the app draws it everywhere: a check, info, warning or stop sign,
 * in its color unless the caller gives another.
 */
export function StatusIcon(props: StatusIconProps): ReactNode {
    const { status, color = STATUS_COLOR[status], ...others } = props;
    return <AppIcon icon={STATUS_ICON[status]} color={color} {...others} />;
}
