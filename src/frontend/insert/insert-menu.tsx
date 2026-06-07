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
import { NotificationAction, renderNotification } from "../common/toaster";
import { ConfigurationWrapper } from "../app/configurations";
import { useInsertMutation } from "./insert-hooks";
import { Configuration } from "../../shared/configuration-models";
import { useFavoritesQuery } from "../queries";
import { useUiState } from "../api-utils/ui-state";
import { notifications } from "@mantine/notifications";

interface OpenInsertMenuProps {
    insertable: InsertableOut;
    defaultConfiguration?: Configuration;
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
    defaultConfiguration?: Configuration;
    onInsert: () => void;
}

function InsertMenuContent(props: InsertMenuContentProps): ReactNode {
    const { insertable, onInsert } = props;
    const favorites = useFavoritesQuery().data?.favorites;

    const [configuration, setConfiguration] = useState<
        Configuration | undefined
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
                configuration={configuration}
                setConfiguration={setConfiguration}
            />
        );
    }

    return (
        <>
            <PreviewImageCard
                path={insertable.path}
                configuration={configuration}
            />
            {parameters}
            <Group justify="space-between" mt="md" wrap="nowrap">
                <FavoriteButton favorite={favorite} insertable={insertable} />
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
    configuration?: Configuration;
    isFavorite: boolean;
    onInsert: () => void;
}

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
        <Group gap="sm">
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
    configuration?: Configuration
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
