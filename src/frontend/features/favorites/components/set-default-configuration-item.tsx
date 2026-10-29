import { Menu } from "@mantine/core";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { Favorite } from "@backend/features/favorites/contract";
import { Hint } from "@backend/features/hints/contract";
import type { SelectionReport } from "../../insert/components/configurations";
import { NewIndicator } from "../../../components/new-feature";
import { useHasSeenHint } from "../../hints/queries";
import { useSetDefaultConfigurationMutation } from "../queries";
import { isDefaultConfiguration } from "../default-configuration";

interface SetDefaultConfigurationItemProps {
    favorite: Favorite;
    /** The configuration on screen. */
    report: SelectionReport;
}

/** Makes the configuration on screen the one the favorite opens with. */
export function SetDefaultConfigurationItem(
    props: SetDefaultConfigurationItemProps
): ReactNode {
    const { favorite, report } = props;
    const mutation = useSetDefaultConfigurationMutation(favorite.id);
    const hasOpened = useHasSeenHint(Hint.OPENED_SET_DEFAULT_CONFIGURATION);
    return (
        <Menu.Item
            leftSection={
                <NewIndicator shown={!hasOpened} offset={-1}>
                    {/* Inline, it sits on a line of text above the label's center */}
                    <FloppyDiskIcon style={{ display: "block" }} />
                </NewIndicator>
            }
            disabled={isDefaultConfiguration(favorite, report)}
            onClick={() =>
                mutation.mutate({
                    selection: report.selection,
                    configurationKey: report.configurationKey
                })
            }
        >
            Set as default configuration
        </Menu.Item>
    );
}
