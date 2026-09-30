/** The app's four statuses, each with the one icon and color it is drawn in. */
import {
    CheckIcon,
    InfoIcon,
    WarningIcon,
    WarningOctagonIcon,
    type Icon
} from "@phosphor-icons/react";
import { StatusColor } from "./style-constants";

export enum Status {
    SUCCESS = "success",
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}

export const STATUS_ICON: Record<Status, Icon> = {
    [Status.SUCCESS]: CheckIcon,
    [Status.INFO]: InfoIcon,
    [Status.WARNING]: WarningIcon,
    [Status.ERROR]: WarningOctagonIcon
};

export const STATUS_COLOR: Record<Status, StatusColor> = {
    [Status.SUCCESS]: StatusColor.SUCCESS,
    [Status.INFO]: StatusColor.INFO,
    [Status.WARNING]: StatusColor.WARNING,
    [Status.ERROR]: StatusColor.ERROR
};

/**
 * A faint tint of the status to set a callout on. Mantine's own dark-mode tint
 * is a solid shade, which its text all but disappears into.
 */
export function statusWash(status: Status): string {
    const color = STATUS_COLOR[status];
    return `light-dark(var(--mantine-color-${color}-light), color-mix(in srgb, var(--mantine-color-${color}-filled) 20%, transparent))`;
}
