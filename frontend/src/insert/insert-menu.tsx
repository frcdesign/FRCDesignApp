import {
    useNavigate,
    UseNavigateResult,
    useSearch
} from "@tanstack/react-router";
import { ReactNode, useState } from "react";
import { ElementObj, ElementType, Configuration } from "../api/models";
import {
    Button,
    Card,
    Dialog,
    DialogBody,
    DialogFooter,
    Intent
} from "@blueprintjs/core";
import {
    useIsFetching,
    useMutation,
    useQueryClient
} from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { toElementApiPath } from "../api/path";
import { useElementsQuery, useUserData } from "../queries";
import {
    AppMenu,
    InsertMenuParams,
    MenuDialogProps,
    useHandleCloseDialog
} from "../api/menu-params";
import { PreviewImage } from "../favorites/thumbnail";
import { FavoriteButton } from "../favorites/favorite-button";
import {
    showErrorToast,
    showLoadingToast,
    showSuccessToast,
    toaster
} from "../common/toaster";
import { ConfigurationWrapper } from "./configurations";
import { updateUiState } from "../api/ui-state";

export function InsertMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== AppMenu.INSERT_MENU) {
        return null;
    }
    return (
        <InsertMenuDialog
            activeElementId={search.activeElementId}
            defaultConfiguration={search.defaultConfiguration}
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
                            activeMenu: AppMenu.INSERT_MENU,
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

function InsertMenuDialog(props: MenuDialogProps<InsertMenuParams>): ReactNode {
    const elementId = props.activeElementId;

    const elements = useElementsQuery().data;
    const favorites = useUserData().favorites;

    const navigate = useNavigate();
    const closeDialog = useHandleCloseDialog();

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(props.defaultConfiguration);

    const element = elements ? elements[elementId] : undefined;
    if (!element) {
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
    const closeDialog = useHandleCloseDialog();
    const queryClient = useQueryClient();

    const toastId = "insert-" + element.id;

    const isLoadingConfiguration =
        useIsFetching({
            queryKey: ["configuration", element.configurationId]
        }) > 0;

    const insertMutation = useMutation({
        mutationKey: ["insert", element.id],
        mutationFn: async () => {
            let endpoint;
            const body: Record<string, any> = {
                documentId: element.documentId,
                instanceType: element.instanceType,
                instanceId: element.instanceId,
                elementId: element.id,
                configuration,
                name: element.name,
                isFavorite,
                userId: search.userId
            };
            if (search.elementType == ElementType.ASSEMBLY) {
                endpoint = "/add-to-assembly";
                body.elementType = element.elementType;
            } else {
                // Part studio derive also needs name and microversion id
                endpoint = "/add-to-part-studio";
                body.microversionId = element.microversionId;
            }
            // Cancel any outstanding thumbnail queries
            queryClient.cancelQueries({
                predicate: (query) =>
                    query.queryKey[0] === "thumbnail-id" ||
                    query.queryKey[0] === "thumbnail"
            });
            showLoadingToast(`Inserting ${element.name}...`, toastId);
            closeDialog();
            updateUiState({ searchQuery: undefined });
            return apiPost(endpoint + toElementApiPath(search), {
                body
            });
        },
        onError: () => {
            showErrorToast(`Failed to insert ${element.name}.`, toastId);
        },
        onSuccess: () => {
            showSuccessToast(`Successfully inserted ${element.name}.`, toastId);
        }
    });

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
            onClick={() => insertMutation.mutate()}
        />
    );
}
