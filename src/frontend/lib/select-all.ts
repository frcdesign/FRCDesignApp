import { type FocusEvent, type MouseEvent, useRef } from "react";

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** Spread onto a field so focusing it, by click or by tab, selects its text. */
export function useSelectAllOnFocus() {
    const wasFocused = useRef(false);
    return {
        onFocus: (event: FocusEvent<TextField>) => event.currentTarget.select(),
        onMouseDown: (event: MouseEvent<TextField>) => {
            wasFocused.current = document.activeElement === event.currentTarget;
        },
        // The mouseup of the click that focused the field would collapse the
        // selection; later clicks place the caret normally.
        onMouseUp: (event: MouseEvent<TextField>) => {
            if (!wasFocused.current) {
                event.preventDefault();
            }
        }
    };
}
