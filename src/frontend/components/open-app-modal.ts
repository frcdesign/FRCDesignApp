import { modals } from "@mantine/modals";
import type { ReactNode } from "react";
import {
    BORDER,
    CHROME_BACKGROUND,
    CHROME_PADDING
} from "../lib/style-constants";

interface OpenAppModalProps {
    title: ReactNode;
    children: ReactNode;
    /** Pass one minted by the caller to update the modal while it is open. */
    modalId?: string;
    size?: string | number;
    onClose?: () => void;
}

/**
 * Opens a modal wearing the app's chrome: a tight header on its own surface
 * over an unpadded body, so an `AppModalFooter` can sit flush at the bottom.
 * Content belongs in an `AppModalBody`, which supplies the padding instead.
 */
export function openAppModal(props: OpenAppModalProps): void {
    const { title, children, modalId, size, onClose } = props;
    modals.open({
        modalId,
        title,
        size,
        children,
        onClose,
        centered: true,
        // The default close button is what makes an otherwise tight header tall.
        closeButtonProps: { size: "sm" },
        styles: {
            // Drawn, not just shadowed, so the card reads as one panel against
            // the app behind it.
            content: { border: BORDER },
            header: {
                background: CHROME_BACKGROUND,
                borderBottom: BORDER,
                padding: CHROME_PADDING,
                minHeight: 0
            },
            body: { padding: 0 }
        }
    });
}
