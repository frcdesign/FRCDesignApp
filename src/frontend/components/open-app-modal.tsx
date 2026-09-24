import { modals } from "@mantine/modals";
import { randomId } from "@mantine/hooks";
import { createContext, type ReactNode, use, useMemo } from "react";
import { APP_MODAL_CLASSES, AppModalContent } from "./app-modal";

interface OpenAppModalProps {
    title: ReactNode;
    children: ReactNode;
    size?: string | number;
    onClose?: () => void;
}

const ModalIdContext = createContext<string | undefined>(undefined);

/** The body is unpadded: put content in `AppModalBody` and actions in `AppModalFooter`. */
export function openAppModal(props: OpenAppModalProps): void {
    const { title, children, size, onClose } = props;
    const modalId = randomId();
    modals.open({
        modalId,
        title,
        size,
        children: (
            <ModalIdContext value={modalId}>
                <AppModalContent>{children}</AppModalContent>
            </ModalIdContext>
        ),
        onClose,
        centered: true,
        classNames: APP_MODAL_CLASSES
    });
}

interface AppModalControls {
    setTitle: (title: ReactNode) => void;
    close: () => void;
}

/** For content opened by `openAppModal`, to change the modal around it. */
export function useAppModal(): AppModalControls {
    const modalId = use(ModalIdContext);
    return useMemo(
        () => ({
            setTitle: (title) => {
                if (modalId) modals.updateModal({ modalId, title });
            },
            close: () => {
                if (modalId) modals.close(modalId);
            }
        }),
        [modalId]
    );
}
