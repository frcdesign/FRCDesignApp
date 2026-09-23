import { modals } from "@mantine/modals";
import type { ReactNode } from "react";
import { APP_MODAL_CLASSES, AppModalContent } from "./app-modal";

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
        children: <AppModalContent>{children}</AppModalContent>,
        onClose,
        centered: true,
        classNames: APP_MODAL_CLASSES
    });
}
