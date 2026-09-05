import { useSearch } from "@tanstack/react-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import {
    type Favorite,
    getFavoriteForInsertable
} from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { Button, Checkbox, Group } from "@mantine/core";
import { InfoIcon, PlusIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useMenuTitle } from "../../../components/app-title";
import { showQuickInsertTip } from "../quick-insert-tip";
import { PreviewImageCard } from "../../thumbnails/components/thumbnail";
import { FavoriteButton } from "../../favorites/components/favorite-button";
import { renderNotification } from "../../../lib/notifications";
import { MenuButton } from "../../../components/app-menu";
import { InsertableMenuItems } from "../../library/components/insertable-card";
import { ConfigurationWrapper } from "./configurations";
import { useInsertMutation } from "../insert-hooks";
import { useConfigurationQuery, useIsFetchingConfiguration } from "../queries";
import {
    Selection,
    SearchRecord
} from "@backend/features/configurations/models";
import { ELEMENT_DEFAULT_KEY } from "@backend/features/configurations/selection";
import { useFavoritesQuery } from "../../favorites/queries";
import { useGetUiState, useSetUiState } from "../../../lib/ui-state";
import { notifications } from "@mantine/notifications";
import { RequireSignIn, useIsSignedIn } from "../../auth/access-level";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { startSignIn } from "../../auth/sign-in";
import { InsertSource } from "@backend/features/analytics/events";

interface InsertMenuContentProps {
    insertable: InsertableOut;
    /** The modal this renders in, so the header can track the selection. */
    modalId: string;
    initialSelection?: Selection;
    /** When the menu opened, for the quick insert tip. */
    openedAt: number;
    onInsert: () => void;
    source: InsertSource;
}

/**
 * The selection the menu holds and its key, plus whether it still stands where
 * it opened.
 */
function useInsertSelection(initialSelection?: Selection) {
    const [selection, setSelection] = useState(initialSelection);
    // Reported by ConfigurationWrapper, which has the parameters the key is
    // measured against. Empty means the element's own defaults.
    const [configurationKey, setConfigurationKey] =
        useState(ELEMENT_DEFAULT_KEY);
    // The first report is what the menu opened with, and so what a right-click
    // on the card would have inserted. Absent until the parameters load.
    const [openedWith, setOpenedWith] = useState<string>();

    const onConfigurationKey = useCallback((key: string) => {
        setConfigurationKey(key);
        setOpenedWith((opened) => opened ?? key);
    }, []);

    return {
        selection,
        setSelection,
        configurationKey,
        onConfigurationKey,
        isUnchanged: configurationKey === (openedWith ?? ELEMENT_DEFAULT_KEY)
    };
}

export function InsertMenuContent(props: InsertMenuContentProps): ReactNode {
    const { insertable, modalId, openedAt, onInsert, source } = props;
    const favorites = useFavoritesQuery().data?.favorites;
    const isSignedIn = useIsSignedIn();

    const {
        selection,
        setSelection,
        configurationKey,
        onConfigurationKey,
        isUnchanged
    } = useInsertSelection(props.initialSelection);
    const [record, setRecord] = useState<SearchRecord | undefined>(undefined);
    // A part with no parameters has one record — the element's own part data —
    // which no ConfigurationWrapper is mounted to report, but the title wants.
    const soleRecord = useConfigurationQuery(
        insertable.id,
        insertable.microversionId,
        !insertable.isConfigurable
    ).data?.records[0];

    useMenuTitle(modalId, {
        name: insertable.name,
        record: record ?? soleRecord
    });

    useEffect(() => {
        // Only once known: pending reads as signed out, which would prompt a
        // signed-in caller to sign in.
        if (isSignedIn === false) {
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
                selection={selection}
                setSelection={setSelection}
                onConfigurationKey={onConfigurationKey}
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
                    configurationKey={configurationKey}
                />
                {parameters}
            </AppModalBody>
            <InsertMenuFooter
                insertable={insertable}
                favorite={favorite}
                selection={selection}
                configurationKey={configurationKey}
                isUnchanged={isUnchanged}
                openedAt={openedAt}
                source={source}
                onInsert={onInsert}
            />
        </>
    );
}

interface InsertMenuFooterProps {
    insertable: InsertableOut;
    favorite: Favorite | undefined;
    selection?: Selection;
    configurationKey: string;
    /** Whether the selection still stands where the menu opened. */
    isUnchanged: boolean;
    openedAt: number;
    /** Where the insert began, which the menu and the buttons both record. */
    source: InsertSource;
    onInsert: () => void;
}

/** Favoriting and the row's own menu, then the buttons that do the inserting. */
function InsertMenuFooter(props: InsertMenuFooterProps): ReactNode {
    const {
        insertable,
        favorite,
        selection,
        configurationKey,
        isUnchanged,
        openedAt,
        source,
        onInsert
    } = props;
    return (
        <AppModalFooter>
            <Group gap={4}>
                <RequireSignIn>
                    <FavoriteButton
                        favorite={favorite}
                        insertable={insertable}
                        selection={selection}
                        configurationKey={configurationKey}
                        large
                    />
                </RequireSignIn>
                <MenuButton large>
                    <InsertableMenuItems
                        favorite={favorite}
                        insertable={insertable}
                        inInsertMenu
                        selection={selection}
                        configurationKey={configurationKey}
                        source={source}
                    />
                </MenuButton>
            </Group>
            <InsertButtons
                insertable={insertable}
                selection={selection}
                isUnchanged={isUnchanged}
                isFavorite={favorite !== undefined}
                openedAt={openedAt}
                source={source}
                onInsert={onInsert}
            />
        </AppModalFooter>
    );
}

interface InsertButtonsProps {
    /**
     * Whether the selection is still the one the menu opened with, which a
     * right-click on the card would have inserted without opening anything.
     */
    isUnchanged: boolean;
    insertable: InsertableOut;
    selection?: Selection;
    isFavorite: boolean;
    /** When the menu opened, for the quick insert tip. */
    openedAt: number;
    onInsert: () => void;
    source: InsertSource;
}

/**
 * The derive/insert button plus the insert and fasten checkbox.
 */
function InsertButtons(props: InsertButtonsProps): ReactNode {
    const {
        insertable,
        selection,
        isUnchanged,
        isFavorite,
        openedAt,
        source,
        onInsert
    } = props;

    const search = useSearch({ from: "/app" });
    // Inserting targets the current Onshape document; there's nothing to insert
    // into when the app is open standalone.
    const isConnected = useIsConnectedToOnshape();
    const insertMutation = useInsertMutation(insertable, selection, {
        isFavorite,
        source
    });
    const uiState = useGetUiState();
    const setUiState = useSetUiState();

    const isLoadingConfiguration = useIsFetchingConfiguration(
        insertable.id,
        insertable.microversionId
    );

    const canFasten =
        insertable.supportsFasten &&
        search.elementType === ElementType.ASSEMBLY;

    const handleClick = useCallback(() => {
        insertMutation.mutate(canFasten && uiState.fasten);
        if (isUnchanged) {
            showQuickInsertTip(openedAt);
        }
        onInsert();
    }, [
        insertMutation,
        onInsert,
        canFasten,
        uiState.fasten,
        isUnchanged,
        openedAt
    ]);

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
                leftSection={<PlusIcon size={IconSize.SMALL} />}
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
        icon: <InfoIcon size={IconSize.MEDIUM} />,
        message: renderNotification(
            "Sign in to Onshape to see the selection preview.",
            { text: "Sign in", onClick: startSignIn }
        )
    });
}
