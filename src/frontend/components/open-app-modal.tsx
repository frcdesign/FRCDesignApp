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

/** The body is unpadded: put content in `AppModalBody` and actions in `AppModalFooter`. */
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
