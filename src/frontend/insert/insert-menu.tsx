import { useSearch } from "@tanstack/react-router";
import { ReactNode, useCallback, useState } from "react";
import {
    getFavoriteForInsertable,
    InsertableOut
} from "../../shared/api-models";
import { ElementType } from "../../shared/types";
import { Button, Checkbox, Group } from "@mantine/core";
import { IconInfoCircle, IconPlus } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
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
import { ParameterValues } from "../../shared/configuration-models";
import { useFavoritesQuery } from "../queries";
import { useUiState } from "../api-utils/ui-state";
import { notifications } from "@mantine/notifications";

interface OpenInsertMenuProps {
    insertable: InsertableOut;
    defaultConfiguration?: ParameterValues;
}

export function openInsertMenu(props: OpenInsertMenuProps) {
    const { insertable, defaultConfiguration } = props;
    let didInsert = false;
    const id = modals.open({
        title: insertable.name,
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
                defaultConfiguration={defaultConfiguration}
                onInsert={() => {
                    didInsert = true;
                    modals.close(id);
                }}
            />
        )
    });
}

interface InsertMenuContentProps {
    insertable: InsertableOut;
    defaultConfiguration?: ParameterValues;
    onInsert: () => void;
}

function InsertMenuContent(props: InsertMenuContentProps): ReactNode {
    const { insertable, onInsert } = props;
    const favorites = useFavoritesQuery().data?.favorites;

    const [configuration, setConfiguration] = useState<
        ParameterValues | undefined
    >(props.defaultConfiguration);

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
            />
        );
    }

    return (
        <>
            <PreviewImageCard
                path={insertable.path}
                microversionId={insertable.microversionId}
                configuration={configuration}
            />
            {parameters}
            <Group justify="space-between" wrap="nowrap" mt="md">
                <Group gap={4}>
                    <FavoriteButton
                        favorite={favorite}
                        insertable={insertable}
                    />
                    <MenuButton>
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
