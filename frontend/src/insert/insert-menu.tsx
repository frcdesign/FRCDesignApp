import { useNavigate, useSearch } from "@tanstack/react-router";
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
import { PreviewImage } from "../app/thumbnail";
import { FavoriteButton } from "../cards/favorite-button";
import {
    showErrorToast,
    showLoadingToast,
    showSuccessToast,
    toaster
} from "../common/toaster";
import { ConfigurationWrapper } from "./configurations";

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

function InsertMenuDialog(props: MenuDialogProps<InsertMenuParams>): ReactNode {
    const elementId = props.activeElementId;

    const elements = useElementsQuery().data;
    const navigate = useNavigate();
    const favorites = useUserData().favorites;

    const closeDialog = useHandleCloseDialog();

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
    >(props.defaultConfiguration);

    if (!elements || !favorites) {
        return null;
    }

    const element = elements[elementId];
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

    const previewThumbnail = (
        <PreviewImage elementPath={element} configuration={configuration} />
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
                toaster.show(
                    {
                        message: `Cancelled ${element.name}.`,
                        intent: "primary",
                        icon: "info-sign",
                        action: {
                            text: "Restore",
                            onClick: () => {
                                navigate({
                                    to: ".",
                                    search: {
                                        activeMenu: AppMenu.INSERT_MENU,
                                        activeElementId: elementId,
                                        defaultConfiguration: configuration
                                    }
                                });
                            },
                            icon: "share"
                        }
                    },
                    `cancel-insert ${element.elementId}`
                );
                closeDialog();
            }}
            style={{ maxHeight: "90vh", maxWidth: "400px" }}
        >
            <Card className="center preview-image-card">
                {previewThumbnail}
            </Card>
            <DialogBody>{parameters}</DialogBody>
            <DialogFooter actions={actions}>
                <FavoriteButton isFavorite={isFavorite} element={element} />
            </DialogFooter>
        </Dialog>
    );
}
interface SubmitButtonProps {
    element: ElementObj;
    configuration?: Configuration;
    isFavorite: boolean;
}

function InsertButton(props: SubmitButtonProps): ReactNode {
    const { element, configuration, isFavorite } = props;

    const search = useSearch({ from: "/app" });
    const closeDialog = useHandleCloseDialog();
    const queryClient = useQueryClient();

    const toastId = "insert" + element.id;

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
