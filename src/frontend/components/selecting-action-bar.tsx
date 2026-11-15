import { ActionBar, Button, Text } from "@mantine/core";
import { CursorClickIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { listLabel, useOnshapeSelection } from "../lib/selection";
import { IconSize, PrimaryColor } from "../lib/style-constants";
import styles from "../lib/styles.module.css";
import { m } from "../paraglide/messages";
import { AppIcon } from "./app-icon";

/**
 * Floats over the bottom of the panel while a query list limits what the
 * Onshape window lets be picked: which list, and the button to stop.
 */
export function SelectingActionBar(): ReactNode {
    const isFiltering = useOnshapeSelection(
        (state) => state.filtering !== undefined
    );
    const label = useOnshapeSelection((state) => listLabel(state.focused));
    const finish = () => useOnshapeSelection.getState().finishSelecting();

    return (
        <ActionBar opened={isFiltering} onClose={finish}>
            <AppIcon
                icon={CursorClickIcon}
                size={IconSize.MEDIUM}
                color={PrimaryColor.FILLED}
                className={styles.noShrink}
            />
            <Text size="sm" truncate>
                {label === undefined
                    ? m.selectingBarFiltered()
                    : m.selectingBarSelecting({ label })}
            </Text>
            <ActionBar.Divider />
            <Button size="compact-sm" onClick={finish}>
                {m.selectingBarFinish()}
            </Button>
        </ActionBar>
    );
}
