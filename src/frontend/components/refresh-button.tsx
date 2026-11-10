import { ActionIcon, Tooltip } from "@mantine/core";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { IconSize, PrimaryColor } from "../lib/style-constants";

interface RefreshButtonProps {
    loading: boolean;
    onClick: () => void;
    /** @default "Refresh" */
    label?: string;
}

/** A navbar's refresh, spinning in the page's color while it works. */
export function RefreshButton(props: RefreshButtonProps): ReactNode {
    const { loading, onClick, label = "Refresh" } = props;
    return (
        <Tooltip label={label}>
            <ActionIcon
                my="auto"
                loading={loading}
                loaderProps={{ color: PrimaryColor.FILLED }}
                onClick={onClick}
            >
                <ArrowClockwiseIcon size={IconSize.MEDIUM} />
            </ActionIcon>
        </Tooltip>
    );
}
