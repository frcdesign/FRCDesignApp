import { modals } from "@mantine/modals";
import { openAppModal } from "../../components/open-app-modal";

import type { InsertableOut } from "@backend/features/library/contract";
import {
    type ConfigurationKey,
    type PartialSelection
} from "@backend/features/configurations/contract";
import { encodeConfiguration } from "@backend/features/configurations/utils";
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
    /** Partial for a search hit or a link, which name only some parameters. */
    initialSelection?: PartialSelection;
    /** So the preview needn't wait for the parameters. */
    configurationKey?: ConfigurationKey;
    /** The favorite this was opened from, so a relaunch can reopen it as one. */
    favoriteId?: string;
    source: InsertSource;
}

/** Nothing is open, which is what closing the menu leaves behind. */
const NO_OPEN_MENU = {
    openInsertableId: undefined,
    openConfiguration: undefined,
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
    // What the menu shows when it closes, for the restore toast to reopen.
    let lastSelection = initialSelection;
    // Recorded so the url mirrors it and a relaunch reopens it.
    updateUiState({
        openInsertableId: insertable.id,
        openConfiguration: initialSelection
            ? encodeConfiguration(initialSelection) || undefined
            : undefined,
        openFavoriteId: favoriteId
    });
    // So the content can address its modal, and the header follow the selection.
    const id = crypto.randomUUID();
    openAppModal({
        modalId: id,
        title: <MenuTitle name={insertable.name} />,
        size: 500,
        onClose: () => {
            updateUiState(NO_OPEN_MENU);
            if (!didInsert) {
                showRestoreToast(insertable, source, lastSelection);
            }
        },
        children: (
            <InsertMenuContent
                insertable={insertable}
                modalId={id}
                initialSelection={initialSelection}
                initialConfigurationKey={configurationKey}
                onSelectionChange={(selection) => {
                    lastSelection = selection;
                }}
                source={source}
                onInsert={() => {
                    didInsert = true;
                    modals.close(id);
                }}
            />
        )
    });
}

/** Offers the menu back, configured the way it was closed. */
function showRestoreToast(
    insertable: InsertableOut,
    source: InsertSource,
    selection?: PartialSelection
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

    // Keyed on the insertable, so repeats refresh one toast.
    showInfoToast(
        renderNotification(`Cancelled ${insertable.name}.`, restoreButton),
        { id: "restore-" + insertable.id, autoClose: 3000 }
    );
}
