import { ActionBar, Button, Center, Divider, Paper, Text } from "@mantine/core";
import { CursorClickIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { listLabel, useOnshapeSelection } from "../lib/selection";
import { IconSize, PrimaryColor } from "../lib/style-constants";
import styles from "../lib/styles.module.css";
import { m } from "../paraglide/messages";
import { AppIcon } from "./app-icon";

/**
 * While a query list limits what the Onshape window lets be picked: which
 * list, and the button to stop. Mantine's action bar's look, in the page's flow.
 */
export function SelectingBar(): ReactNode {
    const isFiltering = useOnshapeSelection(
        (state) => state.filtering !== undefined
    );
    const label = useOnshapeSelection((state) => listLabel(state.focused));
    if (!isFiltering) {
        return null;
    }
    const stop = () => useOnshapeSelection.getState().finishSelecting();

    return (
        <Paper
            withBorder
            shadow="md"
            className={ActionBar.classes.root}
            role="group"
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
            <Divider orientation="vertical" />
            <Button
                size="compact-sm"
                className={styles.noShrink}
                onClick={stop}
            >
                {m.selectingBarStop()}
            </Button>
        </Paper>
    );
}
