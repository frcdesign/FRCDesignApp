import { ActionIcon, Tooltip } from "@mantine/core";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { PartialSelection } from "@backend/features/configurations/contract";
import type { Favorite } from "@backend/features/favorites/contract";
import { IconSize } from "../../../lib/style-constants";
import { isDefaultConfiguration } from "../../favorites/default-configuration";
import type { SelectionReport } from "./configurations";

interface ResetConfigurationButtonProps {
    favorite: Favorite | undefined;
    /** Undefined until the panel settles. */
    report: SelectionReport | undefined;
    onReset: (selection: PartialSelection) => void;
}

/** Puts the panel back on the default configuration. */
export function ResetConfigurationButton(
    props: ResetConfigurationButtonProps
): ReactNode {
    const { favorite, report, onReset } = props;
    const isDefault = !report || isDefaultConfiguration(favorite, report);
    return (
        <Tooltip label="Reset to default configuration" disabled={isDefault}>
            <ActionIcon
                size="input-sm"
                disabled={isDefault}
                // A favorite with no selection opens on the defaults.
                onClick={() => onReset(favorite?.defaultSelection ?? {})}
            >
                <ArrowCounterClockwiseIcon size={IconSize.CONTROL} />
            </ActionIcon>
        </Tooltip>
    );
}
