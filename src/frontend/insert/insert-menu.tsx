import { useSearch } from "@tanstack/react-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { getFavoriteForInsertable } from "../../shared/favorites-dto";
import { InsertableOut } from "../../shared/library-dto";
import { ElementType } from "../../shared/element-type";
import { Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { IconInfoCircle, IconPlus } from "@tabler/icons-react";
import { FontWeight, IconSize } from "../common/style-constants";
import { modals } from "@mantine/modals";
import { useIsFetching } from "@tanstack/react-query";
import { PreviewImageCard } from "./thumbnail";
import { FavoriteButton } from "../favorites/favorite-button";
import {
    NotificationAction,
    renderNotification
} from "../common/notifications";
import { MenuButton } from "../app-common/app-menu";
import { InsertableMenuItems } from "../cards/insertable-card";
import { ConfigurationWrapper } from "./configurations";
import { useInsertMutation } from "./insert-hooks";
import {
    ParameterValues,
    SearchRecord
} from "../../shared/configuration-models";
import { encodeCanonicalConfiguration } from "../../shared/canonical-configuration";
import { useFavoritesQuery } from "../favorites-queries";
import { useUiState } from "../api-utils/ui-state";
import { notifications } from "@mantine/notifications";
import { RequireSignIn, useIsSignedIn } from "../api-utils/access-level";
import { useIsConnectedToOnshape } from "../api-utils/onshape-params";
import { startSignIn } from "../api-utils/sign-in";

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
function InsertMenuTitle({
    name,
    record
}: {
    name: string;
    record?: SearchRecord;
}): ReactNode {
    const details = record
        ? [record.partNumber, record.name].filter(
              (value): value is string => !!value && value !== name
          )
        : [];
    return (
        <Stack gap={0}>
            <Text fw={FontWeight.SEMI_BOLD}>{name}</Text>
            {details.length > 0 && (
                <Text size="xs" c="dimmed">
                    {details.join(" · ")}
                </Text>
            )}
        </Stack>
    );
}

interface InsertMenuContentProps {
    insertable: InsertableOut;
    /** The modal this renders in, so the header can track the selection. */
    modalId: string;
    defaultConfiguration?: ParameterValues;
    onInsert: () => void;
}

function InsertMenuContent(props: InsertMenuContentProps): ReactNode {
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
    const [record, setRecord] = useState<SearchRecord | undefined>(undefined);

    // The title lives in the modal's chrome, so it's updated rather than
    // rendered: the header follows the configuration as the user changes it.
    useEffect(() => {
        modals.updateModal({
            modalId,
            title: <InsertMenuTitle name={insertable.name} record={record} />
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
    if (insertable.configurationId) {
        parameters = (
            <ConfigurationWrapper
                configurationId={insertable.configurationId}
                microversionId={insertable.microversionId}
                configuration={configuration}
                setConfiguration={setConfiguration}
                onCanonicalConfiguration={setCanonicalConfiguration}
                onRecord={setRecord}
            />
        );
    }

    return (
        <>
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
            <Group justify="space-between" wrap="nowrap" mt="md">
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
                    isFavorite={favorite !== undefined}
                    onInsert={onInsert}
                />
            </Group>
        </>
    );
}

interface InsertButtonsProps {
    insertable: InsertableOut;
    configuration?: ParameterValues;
    isFavorite: boolean;
    onInsert: () => void;
}

/**
 * The derive/insert button plus the insert and fasten checkbox.
 */
function InsertButtons(props: InsertButtonsProps): ReactNode {
    const { insertable, configuration, isFavorite, onInsert } = props;

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
            queryKey: ["configuration", insertable.configurationId]
        }) > 0;

    const canFasten =
        insertable.supportsFasten &&
        search.elementType === ElementType.ASSEMBLY;

    const handleClick = useCallback(() => {
        insertMutation.mutate(canFasten && uiState.fasten);
        onInsert();
    }, [insertMutation, onInsert, canFasten, uiState.fasten]);

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
                leftSection={<IconPlus size={IconSize.SMALL} />}
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
        icon: <IconInfoCircle size={IconSize.MEDIUM} />,
        message: renderNotification(
            "Sign in to Onshape to see the configuration preview.",
            { text: "Sign in", onClick: startSignIn }
        )
    });
}

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
        icon: <IconInfoCircle size={IconSize.MEDIUM} />,
        autoClose: 3000
    });
}
