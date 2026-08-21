import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { Info } from "@phosphor-icons/react";
import type { InsertableOut } from "@backend/features/library/contract";
import { type ParameterValues } from "@backend/features/configurations/models";
import { IconSize } from "../../lib/style-constants";
import {
    type NotificationAction,
    renderNotification
} from "../../lib/notifications";
import { InsertMenuContent, InsertMenuTitle } from "./components/insert-menu";

interface OpenInsertMenuProps {
    insertable: InsertableOut;
    defaultConfiguration?: ParameterValues;
}

export function openInsertMenu(props: OpenInsertMenuProps) {
    const { insertable, defaultConfiguration } = props;
    let didInsert = false;
    // Minted here so the content can address the modal it lives in, which is
    // what lets the header follow the selected configuration.
    const id = crypto.randomUUID();
    modals.open({
        modalId: id,
        title: <InsertMenuTitle name={insertable.name} />,
        size: 500,
        centered: true,
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

    notifications.show({
        message: renderNotification(
            `Cancelled ${insertable.name}.`,
            restoreButton
        ),
        color: "blue",
        icon: <Info size={IconSize.MEDIUM} />,
        autoClose: 3000
    });
}
