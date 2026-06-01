import {
    useNavigate,
    UseNavigateResult,
    useSearch
} from "@tanstack/react-router";
import { ReactNode, useCallback, useState } from "react";
import {
    getFavoriteForInsertable,
    InsertableOut
} from "../../shared/api-models";
import { ElementType } from "../../shared/types";
import {
    Button,
    Checkbox,
    Dialog,
    DialogBody,
    DialogFooter,
    Intent
} from "@blueprintjs/core";
import { useIsFetching } from "@tanstack/react-query";
import {
    MenuType,
    InsertMenuParams,
    MenuDialogProps,
    useHandleCloseDialog
} from "../overlays/menu-params";
import { PreviewImageCard } from "./thumbnail";
import { FavoriteButton } from "../favorites/favorite-button";
import { showToast } from "../common/toaster";
import { ConfigurationWrapper } from "../configurations/configurations";
import { useInsertMutation } from "./insert-hooks";
import { Configuration } from "../../shared/configuration-models";
import { useFavoritesQuery, useLibraryQuery } from "../queries";
import { useUiState } from "../api-utils/ui-state";

export function InsertMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== MenuType.INSERT_MENU) {
        return null;
    }
    return (
        <InsertMenuDialog
            activeInsertableId={search.activeInsertableId}
            defaultConfiguration={search.defaultConfiguration}
        />
    );
}
function InsertMenuDialog(props: MenuDialogProps<InsertMenuParams>): ReactNode {
    const insertableId = props.activeInsertableId;
    const favorites = useFavoritesQuery().data?.favorites;

    const insertables = useLibraryQuery().data?.insertables;

    const navigate = useNavigate();
    const closeDialog = useHandleCloseDialog();

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(props.defaultConfiguration);

    const insertable = insertables ? insertables[insertableId] : undefined;

    if (!insertable || !favorites) {
        return null;
    }

    const favorite = getFavoriteForInsertable(favorites, insertableId);

    let parameters: ReactNode = null;
    if (insertable.configurationId) {
        parameters = (
            <ConfigurationWrapper
                configurationId={insertable.configurationId}
                documentId={insertable.documentId}
                configuration={configuration}
                setConfiguration={setConfiguration}
            />
        );
    }

    const actions = (
        <InsertButtons
            insertable={insertable}
            configuration={configuration}
            isFavorite={favorite !== undefined}
        />
    );

    return (
        <Dialog
            isOpen
            title={insertable.name}
            onClose={() => {
                showRestoreToast(insertable, navigate, configuration);
                closeDialog();
            }}
            className="insert-menu"
        >
            <PreviewImageCard
                path={insertable.path}
                configuration={configuration}
            />
            <DialogBody>{parameters}</DialogBody>
            <DialogFooter actions={actions}>
                <FavoriteButton favorite={favorite} insertable={insertable} />
            </DialogFooter>
        </Dialog>
    );
}

interface InsertButtonsProps {
    insertable: InsertableOut;
    configuration?: Configuration;
    isFavorite: boolean;
}

/**
 * The Insert and Insert and fasten buttons in the insert menu.
 */
function InsertButtons(props: InsertButtonsProps): ReactNode {
    const { insertable, configuration, isFavorite } = props;

    const search = useSearch({ from: "/app" });
    const insertMutation = useInsertMutation(insertable, configuration, {
        isFavorite
    });
    const closeDialog = useHandleCloseDialog();
    const [uiState, setUiState] = useUiState();

    const isLoadingConfiguration =
        useIsFetching({
            queryKey: ["configuration", insertable.configurationId]
        }) > 0;

    const canFasten =
        insertable.supportsFasten &&
        search.elementType === ElementType.ASSEMBLY;

    const handleClick = useCallback(() => {
        insertMutation.mutate(canFasten && uiState.fasten);
        closeDialog();
    }, [insertMutation, closeDialog, canFasten, uiState.fasten]);

    return (
        <div className="insert-menu-actions">
            {canFasten && (
                <Checkbox
                    label="Fasten"
                    checked={uiState.fasten}
                    onChange={() => setUiState({ fasten: !uiState.fasten })}
                    inline
                />
            )}
            <Button
                text={
                    search.elementType === ElementType.ASSEMBLY
                        ? "Insert"
                        : "Derive"
                }
                icon="plus"
                intent={Intent.SUCCESS}
                loading={isLoadingConfiguration || insertMutation.isPending}
                onClick={handleClick}
            />
        </div>
    );
}

function showRestoreToast(
    insertable: InsertableOut,
    navigate: UseNavigateResult<string>,
    configuration?: Configuration
) {
    showToast(
        {
            message: `Cancelled ${insertable.name}.`,
            intent: "primary",
            icon: "info-sign",
            timeout: 3000,
            action: {
                text: "Restore",
                onClick: () => {
                    navigate({
                        to: ".",
                        search: {
                            activeMenu: MenuType.INSERT_MENU,
                            activeInsertableId: insertable.id,
                            defaultConfiguration: configuration
                        }
                    });
                },
                icon: "share"
            }
        },
        `cancel-insert ${insertable.id}`
    );
}
