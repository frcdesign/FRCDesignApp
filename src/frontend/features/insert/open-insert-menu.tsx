import { modals } from "@mantine/modals";
import { openAppModal } from "../../components/open-app-modal";

import type { InsertableOut } from "@backend/features/library/contract";
import {
    type ConfigurationKey,
    type Selection
} from "@backend/features/configurations/contract";
import { updateUiState } from "../../lib/ui-state";

import {
    type NotificationAction,
    renderNotification,
    showInfoToast
} from "../../lib/notifications";
import { InsertMenuContent } from "./components/insert-menu";
import { MenuTitle } from "../../components/app-title";
import { InsertSource } from "@backend/features/analytics/usage";

interface OpenInsertMenuProps {
    insertable: InsertableOut;
    initialSelection?: Selection;
    /** That selection's key, when the caller knows it; the menu reports its
     * own once the parameters load, which is what keeps the url current. */
    configurationKey?: ConfigurationKey;
    /** The favorite this was opened from, so a relaunch can reopen it as one. */
    favoriteId?: string;
    source: InsertSource;
}

/** Nothing is open, which is what closing the menu leaves behind. */
const NO_OPEN_MENU = {
    openInsertableId: undefined,
    openConfigurationKey: undefined,
    openFavoriteId: undefined
};

export function openInsertMenu(props: OpenInsertMenuProps) {
    const {
        insertable,
        initialSelection,
        configurationKey,
        favoriteId,
        source
    } = props;
    let didInsert = false;
    // Recorded rather than merely rendered: the url mirrors this, and a
    // relaunch — an Onshape tab switch among them — reopens what it names.
    updateUiState({
        openInsertableId: insertable.id,
        openConfigurationKey: configurationKey,
        openFavoriteId: favoriteId
    });
    // Minted here so the content can address the modal it lives in, which is
    // what lets the header follow the selected configuration.
    const id = crypto.randomUUID();
    openAppModal({
        modalId: id,
        title: <MenuTitle name={insertable.name} />,
        size: 500,
        onClose: () => {
            updateUiState(NO_OPEN_MENU);
            if (!didInsert) {
                showRestoreToast(insertable, source, initialSelection);
            }
        },
        children: (
            <InsertMenuContent
                insertable={insertable}
                modalId={id}
                initialSelection={initialSelection}
                initialConfigurationKey={configurationKey}
                source={source}
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
    source: InsertSource,
    selection?: Selection
) {
    const restoreButton: NotificationAction = {
        text: "Restore",
        onClick: () =>
            openInsertMenu({
                insertable,
                initialSelection: selection,
                source
            })
    };

    // Keyed on the insertable, so opening and cancelling the same one repeatedly
    // refreshes one toast rather than stacking up a column of them.
    showInfoToast(
        renderNotification(`Cancelled ${insertable.name}.`, restoreButton),
        { id: "restore-" + insertable.id, autoClose: 3000 }
    );
}
