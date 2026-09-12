import { modals } from "@mantine/modals";
import type { ReactNode } from "react";
import { BORDER, FRAME_BACKGROUND } from "../lib/style-constants";

const COLUMN = { display: "flex", flexDirection: "column" } as const;

/** Passes the card's capped height down to the body, which is what scrolls. */
const FILL_COLUMN = { ...COLUMN, flex: 1, minHeight: 0 } as const;

interface OpenAppModalProps {
    title: ReactNode;
    children: ReactNode;
    /** Pass one minted by the caller to update the modal while it is open. */
    modalId?: string;
    size?: string | number;
    onClose?: () => void;
}

/**
 * Opens a modal framed like the rest of the app. Its body is unpadded, so content
 * belongs in an `AppModalBody` and actions in an `AppModalFooter`.
 */
export function openAppModal(props: OpenAppModalProps): void {
    const { title, children, modalId, size, onClose } = props;
    modals.open({
        modalId,
        title,
        size,
        // Takes the focus the trap would otherwise land on the close button,
        // which reads as that button being pre-selected.
        children: (
            <div
                data-autofocus
                tabIndex={-1}
                style={{ outline: "none", ...FILL_COLUMN }}
            >
                {children}
            </div>
        ),
        onClose,
        centered: true,
        styles: {
            // Drawn, not just shadowed, so the card reads as one panel.
            // A column that clips rather than scrolls: Mantine scrolls the
            // whole card by default, which carries the footer away with it, so
            // the scrolling is left to the body alone.
            content: { border: BORDER, overflow: "hidden", ...COLUMN },
            header: {
                background: FRAME_BACKGROUND,
                borderBottom: BORDER,
                padding: "var(--mantine-spacing-sm)",
                // Otherwise a Mantine minimum, not the padding, sets the height.
                minHeight: 0
            },
            // Shrinkable, so a long title ellipsizes rather than running under
            // the close button.
            title: { minWidth: 0 },
            body: { padding: 0, ...FILL_COLUMN }
        }
    });
}
