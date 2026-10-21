import { ActionIcon, Tooltip } from "@mantine/core";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { IconSize, PrimaryColor } from "../lib/style-constants";

interface RefreshButtonProps {
    loading: boolean;
    onClick: () => void;
}

/** A navbar's refresh, spinning in the page's color while it works. */
export function RefreshButton(props: RefreshButtonProps): ReactNode {
    const { loading, onClick } = props;
    return (
        <Tooltip label="Refresh">
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
