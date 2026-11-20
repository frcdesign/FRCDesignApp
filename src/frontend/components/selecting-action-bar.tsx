import { type ReactNode } from "react";
import { usePanelFooter } from "./panel-footer-store";
import { SelectingBar } from "./selecting-bar";
import classes from "./selecting-action-bar.module.css";

/**
 * The selecting bar at the bottom of a page with no panel footer, which shows
 * it in its place. Stuck there but in the flow, so the page scrolls clear of it.
 */
export function SelectingActionBar(): ReactNode {
    const hasFooter = usePanelFooter((state) => state.count > 0);
    if (hasFooter) {
        return null;
    }
    return (
        <div className={classes.dock}>
            <SelectingBar />
        </div>
    );
}
