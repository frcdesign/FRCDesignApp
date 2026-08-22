import { useSearch } from "@tanstack/react-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { getFavoriteForInsertable } from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { Button, Checkbox, Group } from "@mantine/core";
import { Info, Plus } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { MenuTitle } from "../../../components/app-title";
import { modals } from "@mantine/modals";
import { showQuickInsertTip } from "../quick-insert-tip";
import { useIsFetching } from "@tanstack/react-query";
import { insertableConfigurationQueryMatchKey } from "../../../lib/query-keys";
import { PreviewImageCard } from "../../thumbnails/components/thumbnail";
import { FavoriteButton } from "../../favorites/components/favorite-button";
import { renderNotification } from "../../../lib/notifications";
import { MenuButton } from "../../../components/app-menu";
import { InsertableMenuItems } from "../../library/components/insertable-card";
import { ConfigurationWrapper } from "./configurations";
import { useInsertMutation } from "../insert-hooks";
import {
    ParameterValues,
    SearchRecord
} from "@backend/features/configurations/models";
import { encodeCanonicalConfiguration } from "@backend/features/configurations/canonical";
import { useFavoritesQuery } from "../../favorites/queries";
import { useUiState } from "../../../lib/ui-state";
import { notifications } from "@mantine/notifications";
import { RequireSignIn, useIsSignedIn } from "../../auth/access-level";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { startSignIn } from "../../auth/sign-in";

interface InsertMenuContentProps {
    insertable: InsertableOut;
    /** The modal this renders in, so the header can track the selection. */
    modalId: string;
    defaultConfiguration?: ParameterValues;
    onInsert: () => void;
}

export function InsertMenuContent(props: InsertMenuContentProps): ReactNode {
    const { insertable, modalId, onInsert } = props;
    const favorites = useFavoritesQuery().data?.favorites;
    const isSignedIn = useIsSignedIn();

    const [configuration, setConfiguration] = useState<
        ParameterValues | undefined
    >(props.defaultConfiguration);
    // Reported by ConfigurationWrapper, which has the parameters and units the
    // canonical form needs. Empty means the element's default configuration.
    const [canonicalConfiguration, setCanonicalConfiguration] =
        useState<ParameterValues>({});
    // The first report is what the menu opened with, and so what a right-click
    // on the card would have inserted. Absent until the parameters load.
    const [openedWithConfiguration, setOpenedWithConfiguration] =
        useState<ParameterValues>();

    const handleCanonicalConfiguration = useCallback(
        (canonical: ParameterValues) => {
            setCanonicalConfiguration(canonical);
            setOpenedWithConfiguration((opened) => opened ?? canonical);
        },
        []
    );
    const [record, setRecord] = useState<SearchRecord | undefined>(undefined);

    // The title lives in the modal's chrome, so it's updated rather than
    // rendered: the header follows the configuration as the user changes it.
    useEffect(() => {
        modals.updateModal({
            modalId,
            title: <MenuTitle name={insertable.name} record={record} />
        });
    }, [modalId, insertable.name, record]);

    useEffect(() => {
        if (!isSignedIn) {
            showSignInPreviewToast();
        }
    }, [isSignedIn]);

    if (!favorites) {
        return null;
    }

    const favorite = getFavoriteForInsertable(favorites, insertable.id);

    let parameters: ReactNode = null;
    if (insertable.isConfigurable) {
        parameters = (
            <ConfigurationWrapper
                insertableId={insertable.id}
                microversionId={insertable.microversionId}
                configuration={configuration}
                setConfiguration={setConfiguration}
                onCanonicalConfiguration={handleCanonicalConfiguration}
                onRecord={setRecord}
            />
        );
    }

    return (
        <>
            <AppModalBody>
                <PreviewImageCard
                    path={insertable.path}
                    insertableId={insertable.id}
                    microversionId={insertable.microversionId}
                    largeThumbnailUrl={insertable.largeThumbnailUrl}
                    canonicalConfiguration={encodeCanonicalConfiguration(
                        canonicalConfiguration
                    )}
                />
                {parameters}
            </AppModalBody>
            <AppModalFooter>
                <Group gap={4}>
                    <RequireSignIn>
                        <FavoriteButton
                            favorite={favorite}
                            insertable={insertable}
                            large
                        />
                    </RequireSignIn>
                    <MenuButton large>
                        <InsertableMenuItems
                            favorite={favorite}
                            insertable={insertable}
                            inInsertMenu
                            configuration={configuration}
                        />
                    </MenuButton>
                </Group>
                <InsertButtons
                    insertable={insertable}
                    configuration={configuration}
                    isUnchanged={
                        encodeCanonicalConfiguration(canonicalConfiguration) ===
                        encodeCanonicalConfiguration(
                            openedWithConfiguration ?? {}
                        )
                    }
                    isFavorite={favorite !== undefined}
                    onInsert={onInsert}
                />
            </AppModalFooter>
        </>
    );
}

interface InsertButtonsProps {
    /**
     * Whether the configuration is still the one the menu opened with, which a
     * right-click on the card would have inserted without opening anything.
     */
    isUnchanged: boolean;
    insertable: InsertableOut;
    configuration?: ParameterValues;
    isFavorite: boolean;
    onInsert: () => void;
}

/**
 * The derive/insert button plus the insert and fasten checkbox.
 */
function InsertButtons(props: InsertButtonsProps): ReactNode {
    const { insertable, configuration, isUnchanged, isFavorite, onInsert } =
        props;

    const search = useSearch({ from: "/app" });
    // Inserting targets the current Onshape document; there's nothing to insert
    // into when the app is open standalone.
    const isConnected = useIsConnectedToOnshape();
    const insertMutation = useInsertMutation(insertable, configuration, {
        isFavorite
    });
    const [uiState, setUiState] = useUiState();

    const isLoadingConfiguration =
        useIsFetching({
            queryKey: insertableConfigurationQueryMatchKey(insertable.id)
        }) > 0;

    const canFasten =
        insertable.supportsFasten &&
        search.elementType === ElementType.ASSEMBLY;

    const handleClick = useCallback(() => {
        insertMutation.mutate(canFasten && uiState.fasten);
        if (isUnchanged) {
            showQuickInsertTip();
        }
        onInsert();
    }, [insertMutation, onInsert, canFasten, uiState.fasten, isUnchanged]);

    if (!isConnected) {
        return null;
    }

    return (
        <Group gap="sm" align="center">
            {canFasten && (
                <Checkbox
                    label="Fasten"
                    checked={uiState.fasten}
                    onChange={() => setUiState({ fasten: !uiState.fasten })}
                />
            )}
            <Button
                leftSection={<Plus size={IconSize.SMALL} />}
                loading={isLoadingConfiguration || insertMutation.isPending}
                onClick={handleClick}
            >
                {search.elementType === ElementType.ASSEMBLY
                    ? "Insert"
                    : "Derive"}
            </Button>
        </Group>
    );
}

/** Prompts a not-signed-in viewer that the live preview needs Onshape. */
function showSignInPreviewToast() {
    notifications.hide("sign-in-preview");
    notifications.show({
        id: "sign-in-preview",
        color: "blue",
        icon: <Info size={IconSize.MEDIUM} />,
        message: renderNotification(
            "Sign in to Onshape to see the configuration preview.",
            { text: "Sign in", onClick: startSignIn }
        )
    });
}
