import { ReactNode, useCallback, useEffect, useState } from "react";
import { type Favorite } from "@backend/features/favorites/contract";
import { InsertableOut } from "@backend/features/library/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { Button, Checkbox, Group, Stack } from "@mantine/core";
import { PlusIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import {
    AppModalBody,
    AppModalFooter,
    AppModalTop
} from "../../../components/app-modal";
import { useMenuTitle } from "../../../components/app-title";
import {
    QUICK_INSERT_WINDOW_MS,
    showQuickInsertTip,
    useSignInPreviewTip,
    useThumbnailWaitTip
} from "../insert-tips";
import { PreviewImageCard } from "../../thumbnails/components/thumbnail";
import { FavoriteButton } from "../../favorites/components/favorite-button";
import { MenuButton } from "../../../components/app-menu";
import { GetAppCallout } from "../../../components/get-app";
import { InsertableMenuItems } from "../../library/components/insertable-card";
import { ConfigurationWrapper, type SelectionReport } from "./configurations";
import {
    useConfigurationQuery,
    useInsertMutation,
    useIsFetchingConfiguration
} from "../queries";
import {
    type ConfigurationKey,
    DEFAULT_CONFIGURATION_KEY,
    type PartialSelection,
    Selection
} from "@backend/features/configurations/contract";
import { encodeConfiguration } from "@backend/features/configurations/utils";
import { useFavorite } from "../../favorites/queries";
import { useGetUiState, updateUiState } from "../../../lib/ui-state";
import { RequireSignIn } from "../../auth/access-level";
import { useTargetElementType } from "../insert-hooks";
import { InsertSource } from "@backend/features/analytics/usage";
import { InsertLocationStatus } from "../../insert-location/components/insert-location-status";

interface InsertMenuContentProps {
    insertable: InsertableOut;
    /** The modal this renders in, so the header can track the selection. */
    modalId: string;
    initialSelection?: PartialSelection;
    /** That selection's key, so the preview has it before the parameters load
     * and the panel reports its own. */
    initialConfigurationKey?: ConfigurationKey;
    /** Every selection the menu settles on, the last being what it closed on. */
    onSelectionChange?: (selection: Selection) => void;
    onInsert: () => void;
    source: InsertSource;
}

export function InsertMenuContent(props: InsertMenuContentProps): ReactNode {
    const { insertable, modalId, onSelectionChange, onInsert, source } = props;
    const favorite = useFavorite(insertable.id);
    useThumbnailWaitTip();

    const [selection, setSelection] = useState<
        PartialSelection | Selection | undefined
    >(props.initialSelection);
    // Undefined until the panel settles the selection against its parameters.
    const [report, setReport] = useState<SelectionReport>();
    const configurationKey =
        report?.configurationKey ??
        props.initialConfigurationKey ??
        DEFAULT_CONFIGURATION_KEY;
    // What the preview stops following for a signed-out caller.
    const [isEdited, setIsEdited] = useState(false);
    // Whether an insert would be one a right-click could have done: cleared
    // by an edit below, and by the menu having been up long enough to read.
    const [canShowQuickInsertTip, setCanShowQuickInsertTip] = useState(true);
    // A part with no parameters has one record — the element's own part data —
    // which no ConfigurationWrapper is mounted to report, but the title wants.
    const soleRecord = useConfigurationQuery(
        insertable.id,
        insertable.microversionId,
        !insertable.isConfigurable
    ).data?.records[0];

    useMenuTitle(modalId, {
        name: insertable.name,
        record: report?.record ?? soleRecord
    });
    useSignInPreviewTip(isEdited);

    const onEdit = useCallback(() => {
        setIsEdited(true);
        setCanShowQuickInsertTip(false);
    }, []);

    // What the url carries, so a relaunch reopens the configuration on screen
    // rather than the one the menu was opened with.
    useEffect(() => {
        if (report) {
            updateUiState({
                openConfiguration:
                    encodeConfiguration(report.overrides) || undefined
            });
            onSelectionChange?.(report.selection);
        }
    }, [report, onSelectionChange]);

    useEffect(() => {
        const timer = setTimeout(
            () => setCanShowQuickInsertTip(false),
            QUICK_INSERT_WINDOW_MS
        );
        return () => clearTimeout(timer);
    }, []);

    let parameters: ReactNode = null;
    if (insertable.isConfigurable) {
        parameters = (
            <ConfigurationWrapper
                insertableId={insertable.id}
                microversionId={insertable.microversionId}
                selection={selection}
                setSelection={setSelection}
                onReport={setReport}
                onEdit={onEdit}
            />
        );
    }

    return (
        <>
            <AppModalTop>
                <Stack gap="sm">
                    <GetAppCallout />
                    <PreviewImageCard
                        path={insertable.path}
                        insertableId={insertable.id}
                        microversionId={insertable.microversionId}
                        largeThumbnailUrl={insertable.largeThumbnailUrl}
                        configurationKey={configurationKey}
                    />
                </Stack>
            </AppModalTop>
            <AppModalBody>{parameters}</AppModalBody>
            <InsertMenuFooter
                insertable={insertable}
                favorite={favorite}
                selection={selection}
                configurationKey={configurationKey}
                canShowQuickInsertTip={canShowQuickInsertTip}
                source={source}
                onInsert={onInsert}
            />
        </>
    );
}

interface InsertMenuFooterProps {
    insertable: InsertableOut;
    favorite: Favorite | undefined;
    selection?: PartialSelection;
    configurationKey: ConfigurationKey;
    /** Whether an insert now is worth pointing out a right-click for. */
    canShowQuickInsertTip: boolean;
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
        canShowQuickInsertTip,
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
                canShowQuickInsertTip={canShowQuickInsertTip}
                isFavorite={favorite !== undefined}
                source={source}
                onInsert={onInsert}
            />
        </AppModalFooter>
    );
}

interface InsertButtonsProps {
    /** Whether an insert now is worth pointing out a right-click for. */
    canShowQuickInsertTip: boolean;
    insertable: InsertableOut;
    selection?: PartialSelection;
    isFavorite: boolean;
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
        canShowQuickInsertTip,
        isFavorite,
        source,
        onInsert
    } = props;

    // Inserting targets the current Onshape document; there's nothing to insert
    // into when the app is open standalone.
    const targetElementType = useTargetElementType();
    const insertMutation = useInsertMutation(insertable, selection, {
        isFavorite,
        source
    });
    const uiState = useGetUiState();

    const isLoadingConfiguration = useIsFetchingConfiguration(
        insertable.id,
        insertable.microversionId
    );

    const canFasten =
        insertable.supportsFasten && targetElementType === ElementType.ASSEMBLY;

    const handleClick = useCallback(() => {
        insertMutation.mutate(canFasten && uiState.fasten);
        if (canShowQuickInsertTip) {
            showQuickInsertTip();
        }
        onInsert();
    }, [
        insertMutation,
        onInsert,
        canFasten,
        uiState.fasten,
        canShowQuickInsertTip
    ]);

    if (!targetElementType) {
        return null;
    }

    return (
        <Group gap="sm" align="center">
            <InsertLocationStatus />
            {canFasten && (
                <Checkbox
                    label="Fasten"
                    checked={uiState.fasten}
                    onChange={() => updateUiState({ fasten: !uiState.fasten })}
                />
            )}
            <Button
                // Filled rather than light: this is the menu's one action, and
                // light paints the color's own shade on a tint of itself, which
                // leaves green on pale green. `autoContrast` picks the label
                // against a filled background, so it lands readable either way.
                leftSection={<PlusIcon size={IconSize.SMALL} />}
                loading={isLoadingConfiguration || insertMutation.isPending}
                onClick={handleClick}
            >
                {targetElementType === ElementType.ASSEMBLY
                    ? "Insert"
                    : "Derive"}
            </Button>
        </Group>
    );
}
