import { modals } from "@mantine/modals";
import { openAppModal } from "../../components/open-app-modal";

import type { InsertableOut } from "@backend/features/library/contract";
import { type ParameterValues } from "@backend/features/configurations/models";

import {
    type NotificationAction,
    renderNotification,
    showInfoToast
} from "../../lib/notifications";
import { InsertMenuContent } from "./components/insert-menu";
import { MenuTitle } from "../../components/app-title";

interface OpenInsertMenuProps {
    insertable: InsertableOut;
    defaultConfiguration?: ParameterValues;
}

export function openInsertMenu(props: OpenInsertMenuProps) {
    const { insertable, defaultConfiguration } = props;
    let didInsert = false;
    // How quickly the insert follows is what says whether the menu was worth
    // opening, so the quick insert tip is timed from here.
    const openedAt = Date.now();
    // Minted here so the content can address the modal it lives in, which is
    // what lets the header follow the selected configuration.
    const id = crypto.randomUUID();
    openAppModal({
        modalId: id,
        title: <MenuTitle name={insertable.name} />,
        size: 500,
        onClose: () => {
            if (!didInsert) {
                showRestoreToast(insertable, defaultConfiguration);
            }
        },
        children: (
            <InsertMenuContent
                insertable={insertable}
                modalId={id}
                defaultConfiguration={defaultConfiguration}
                openedAt={openedAt}
                onInsert={() => {
                    didInsert = true;
                    modals.close(id);
                }}
            />
        )
    });
}

/**
 * Both are shown: the element name is how the part was found, the part number
 * and name are what gets inserted.
 */

function showRestoreToast(
    insertable: InsertableOut,
    configuration?: ParameterValues
) {
    const restoreButton: NotificationAction = {
        text: "Restore",
        onClick: () =>
            openInsertMenu({ insertable, defaultConfiguration: configuration })
    };

    // Keyed on the insertable, so opening and cancelling the same one repeatedly
    // refreshes one toast rather than stacking up a column of them.
    showInfoToast(
        renderNotification(`Cancelled ${insertable.name}.`, restoreButton),
        { id: "restore-" + insertable.id, autoClose: 3000 }
    );
}
