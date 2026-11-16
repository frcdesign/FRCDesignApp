import { ActionBar, Button, Center, Text } from "@mantine/core";
import { CursorClickIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { listLabel, useOnshapeSelection } from "../lib/selection";
import { IconSize, PrimaryColor } from "../lib/style-constants";
import styles from "../lib/styles.module.css";
import { m } from "../paraglide/messages";
import { AppIcon } from "./app-icon";
import { PANEL_FOOTER_HEIGHT } from "./panel-footer";

/**
 * Floats over the bottom of the panel while a query list limits what the
 * Onshape window lets be picked: which list, and the button to stop.
 */
export function SelectingActionBar(): ReactNode {
    const isFiltering = useOnshapeSelection(
        (state) => state.filtering !== undefined
    );
    const label = useOnshapeSelection((state) => listLabel(state.focused));
    const stop = () => useOnshapeSelection.getState().finishSelecting();

    return (
        <ActionBar
            opened={isFiltering}
            onClose={stop}
            // Above a panel footer's main action, where there is one
            position={{
                bottom: `calc(var(${PANEL_FOOTER_HEIGHT}, 0px) + var(--mantine-spacing-md))`,
                left: 0,
                right: 0
            }}
        >
            {/* A box the icon's size, centred, so the glyph sits on the text's line */}
            <Center
                w={IconSize.MEDIUM}
                h={IconSize.MEDIUM}
                className={styles.noShrink}
            >
                <AppIcon
                    icon={CursorClickIcon}
                    size={IconSize.MEDIUM}
                    color={PrimaryColor.FILLED}
                    className={styles.block}
                />
            </Center>
            <Text size="sm" truncate>
                {label === undefined
                    ? m.selectingBarFiltered()
                    : m.selectingBarSelecting({ label })}
            </Text>
            <ActionBar.Divider />
            <Button size="compact-sm" onClick={stop}>
                {m.selectingBarStop()}
            </Button>
        </ActionBar>
    );
}
