import { Checkbox, Group, Tooltip } from "@mantine/core";
import { type ReactNode } from "react";
import { NAVBAR_ROW_HEIGHT } from "../../../lib/style-constants";
import { updateUiState, useGetUiState } from "../../../lib/ui-state";

/**
 * The version manager's own second navbar row, in place of the search and
 * filters, which belong to a library.
 *
 * It holds one setting, because one setting is the difference between the two
 * ways this page is used: pushing to see a change downstream, and cutting a
 * version somebody will look for by name later.
 */
export function VersionManagerNavbar(): ReactNode {
    const isQuickPush = useGetUiState().isQuickPush;

    return (
        <Group gap="xs" px="sm" h={NAVBAR_ROW_HEIGHT} wrap="nowrap">
            <Tooltip
                withArrow
                multiline
                w={260}
                label="Pushes straight away, under the name Onshape would give the version. Unchecked, a push asks for a name first. A pull has nothing to name, so it always runs."
            >
                <Checkbox
                    size="xs"
                    label="Quick push"
                    checked={isQuickPush}
                    onChange={(event) =>
                        updateUiState({
                            isQuickPush: event.currentTarget.checked
                        })
                    }
                />
            </Tooltip>
        </Group>
    );
}
