import { ActionIcon, Tooltip } from "@mantine/core";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { Favorite } from "@backend/features/favorites/contract";
import type { ConfigurationKey } from "@backend/features/configurations/contract";
import { IconSize } from "../../../lib/style-constants";
import { sameSelection } from "@backend/features/configurations/selection";
import type { SelectionReport } from "../../insert/components/configurations";
import { useSetDefaultConfigurationMutation } from "../queries";

interface SaveFavoriteConfigurationButtonProps {
    favorite: Favorite;
    /** The configuration on screen. */
    report: SelectionReport;
    configurationKey: ConfigurationKey;
}

/** Makes the configuration on screen the one the favorite opens with. */
export function SaveFavoriteConfigurationButton(
    props: SaveFavoriteConfigurationButtonProps
): ReactNode {
    const { favorite, report, configurationKey } = props;
    const mutation = useSetDefaultConfigurationMutation(favorite.id);
    // Compared as entered: saving "(2 + 3) in" over "5 in" changes what is stored.
    // A favorite with no selection opens on the defaults.
    const isSaved = favorite.defaultSelection
        ? sameSelection(report.stored, favorite.defaultSelection)
        : Object.keys(report.overrides).length === 0;

    return (
        <Tooltip
            label={
                isSaved
                    ? "This is the favorite default configuration"
                    : "Update favorite default configuration"
            }
        >
            <ActionIcon
                size="input-sm"
                disabled={isSaved}
                loading={mutation.isPending}
                onClick={() =>
                    mutation.mutate({
                        selection: report.selection,
                        configurationKey
                    })
                }
            >
                <FloppyDiskIcon size={IconSize.CONTROL} />
            </ActionIcon>
        </Tooltip>
    );
}
