import { Box } from "@mantine/core";
import { type ReactNode, useEffect, useRef } from "react";
import styles from "../lib/styles.module.css";
import classes from "./panel-footer.module.css";

/** Its height, on the document, so what floats over the panel's bottom sits above it. */
export const PANEL_FOOTER_HEIGHT = "--panel-footer-height";

interface PanelFooterProps {
    children: ReactNode;
}

/** Stuck to the bottom of the panel, over whatever scrolls under it: a page's main action. */
export function PanelFooter(props: PanelFooterProps): ReactNode {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const footer = ref.current;
        if (!footer) {
            return;
        }
        const root = document.documentElement.style;
        const observer = new ResizeObserver(() =>
            root.setProperty(PANEL_FOOTER_HEIGHT, `${footer.offsetHeight}px`)
        );
        observer.observe(footer);
        return () => {
            observer.disconnect();
            root.removeProperty(PANEL_FOOTER_HEIGHT);
        };
    }, []);

    return (
        <Box ref={ref} className={`${classes.footer} ${styles.dividerTop}`}>
            {props.children}
        </Box>
    );
}
