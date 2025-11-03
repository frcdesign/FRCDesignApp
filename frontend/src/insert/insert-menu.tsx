import {
    useNavigate,
    UseNavigateResult,
    useSearch
} from "@tanstack/react-router";
import { ReactNode, useState } from "react";
import { ElementObj, ElementType } from "../api/models";
import {
    Button,
    Card,
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
} from "../search-params/menu-params";
import { PreviewImage } from "../favorites/thumbnail";
import { FavoriteButton } from "../favorites/favorite-button";
import { toaster } from "../common/toaster";
import { ConfigurationWrapper } from "./configurations";
import { useInsertMutation } from "./insert-hooks";
import { Configuration } from "./configuration-models";
import { useLibraryQuery, useLibraryUserDataQuery } from "../queries";

export function InsertMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== MenuType.INSERT_MENU) {
        return null;
    }
    return (
        <InsertMenuDialog
            activeElementId={search.activeElementId}
            defaultConfiguration={search.defaultConfiguration}
        />
    );
}
function InsertMenuDialog(props: MenuDialogProps<InsertMenuParams>): ReactNode {
    const elementId = props.activeElementId;

    const elements = useLibraryQuery().data?.elements;
    const favorites = useLibraryUserDataQuery().data?.favorites;

    const navigate = useNavigate();
    const closeDialog = useHandleCloseDialog();

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(props.defaultConfiguration);

    const element = elements ? elements[elementId] : undefined;
    if (!element || !favorites) {
        return null;
    }

    const isFavorite = favorites[elementId] !== undefined;

    let parameters = null;
    if (element.configurationId) {
        parameters = (
            <ConfigurationWrapper
                configurationId={element.configurationId}
                configuration={configuration}
                setConfiguration={setConfiguration}
            />
        );
    }

    const previewImageCard = (
        <Card className="center preview-image-card">
            <PreviewImage elementPath={element} configuration={configuration} />
        </Card>
    );

    const actions = (
        <InsertButton
            element={element}
            configuration={configuration}
            isFavorite={isFavorite}
        />
    );

    return (
        <Dialog
            isOpen
            title={element.name}
            onClose={() => {
                showRestoreToast(element, navigate, configuration);
                closeDialog();
            }}
            className="insert-menu"
        >
            {previewImageCard}
            <DialogBody>{parameters}</DialogBody>
            <DialogFooter actions={actions}>
                <FavoriteButton isFavorite={isFavorite} element={element} />
            </DialogFooter>
        </Dialog>
    );
}

interface InsertButtonProps {
    element: ElementObj;
    configuration?: Configuration;
    isFavorite: boolean;
}

function InsertButton(props: InsertButtonProps): ReactNode {
    const { element, configuration, isFavorite } = props;

    const search = useSearch({ from: "/app" });
    const insertMutation = useInsertMutation(
        element,
        configuration,
        isFavorite
    );
    const closeDialog = useHandleCloseDialog();

    const isLoadingConfiguration =
        useIsFetching({
            queryKey: ["configuration", element.configurationId]
        }) > 0;

    return (
        <Button
            text={
                search.elementType === ElementType.ASSEMBLY
                    ? "Insert"
                    : "Derive"
            }
            icon="plus"
            intent={Intent.SUCCESS}
            loading={isLoadingConfiguration || insertMutation.isPending}
            onClick={() => {
                insertMutation.mutate();
                closeDialog();
            }}
        />
    );
}

function showRestoreToast(
    element: ElementObj,
    navigate: UseNavigateResult<string>,
    configuration?: Configuration
) {
    toaster.show(
        {
            message: `Cancelled ${element.name}.`,
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
                            activeElementId: element.id,
                            defaultConfiguration: configuration
                        }
                    });
                },
                icon: "share"
            }
        },
        `cancel-insert ${element.id}`
    );
}
