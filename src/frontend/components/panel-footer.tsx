import { Box, Stack } from "@mantine/core";
import { type ReactNode, useEffect } from "react";
import styles from "../lib/styles.module.css";
import classes from "./panel-footer.module.css";
import { usePanelFooter } from "./panel-footer-store";
import { SelectingBar } from "./selecting-bar";

interface PanelFooterProps {
    children: ReactNode;
}

/**
 * Stuck to the bottom of the panel, over whatever scrolls under it: a page's
 * main action, and above it the selecting bar while a list limits picks.
 */
export function PanelFooter(props: PanelFooterProps): ReactNode {
    useEffect(() => {
        usePanelFooter.setState((state) => ({ count: state.count + 1 }));
        return () =>
            usePanelFooter.setState((state) => ({ count: state.count - 1 }));
    }, []);

    return (
        <Box className={`${classes.footer} ${styles.dividerTop}`}>
            <Stack gap="sm">
                <SelectingBar />
                {props.children}
            </Stack>
        </Box>
    );
}
