import { Button, Divider, Group, Modal, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconCloudUpload, IconRefresh, IconX } from "@tabler/icons-react";
import { IconSize } from "../common/style-constants";
import { Dispatch, ReactNode, useMemo } from "react";
import { MenuType, useHandleCloseDialog } from "../overlays/menu-params";
import { useLoaderData, useRouter, useSearch } from "@tanstack/react-router";
import { showSuccessToast } from "../common/toaster";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { type ContextData, Theme } from "../../shared/types";
import { hasEditorAccess } from "../../shared/types";
import { AccessLevel } from "../../shared/types";
import { useSaveSettings } from "../api-utils/settings";
import { capitalize, getQueryUpdater } from "../common/utils";
import { OpenUrlButton } from "../common/open-url-button";
import { RequireAccessLevel } from "../api-utils/access-level";
import { FEEDBACK_FORM_URL } from "../common/url";
import { getAppErrorHandler } from "../api-utils/errors";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import {
    contextDataQueryKey,
    libraryQueryMatchKey,
    searchDbQueryMatchKey
} from "../queries";
import { AppSelect } from "../common/app-select";
import { makeSelectOption, useSelectOptions } from "../common/select-utils";

export function SettingsMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== MenuType.SETTINGS_MENU) {
        return null;
    }
    return <SettingsMenuDialog />;
}

/**
 * A labeled row holding a single setting control.
 */
function SettingRow(props: { label: string; children: ReactNode }): ReactNode {
    return (
        <Group justify="space-between" wrap="nowrap" my="sm">
            <Text size="sm" fw={500}>
                {props.label}
            </Text>
            {props.children}
        </Group>
    );
}

function SettingsMenuDialog(): ReactNode {
    const closeDialog = useHandleCloseDialog();

    const loaderData = useLoaderData({ from: "/app" });

    let adminSettings: ReactNode = null;
    // Unlike all other checks, this one uses maxAccessLevel so you can still switch from user to admin
    if (hasEditorAccess(loaderData.maxAccessLevel)) {
        adminSettings = (
            <>
                <Title order={6} mt="md">
                    Admin Settings
                </Title>
                <Divider mb="sm" />
                <AdminSettings />
            </>
        );
    }

    return (
        <Modal opened onClose={closeDialog} title="Settings" centered>
            <UserSettings />
            {adminSettings}
            <Group justify="flex-end" mt="md">
                <Button
                    variant="default"
                    leftSection={<IconX size={IconSize.SMALL} />}
                    onClick={closeDialog}
                >
                    Close
                </Button>
            </Group>
        </Modal>
    );
}

function UserSettings(): ReactNode {
    const search = useSearch({ from: "/app" });
    const saveSettings = useSaveSettings();

    return (
        <>
            <ThemeSelect
                theme={search.settings.theme}
                onThemeSelect={(newTheme) => saveSettings({ theme: newTheme })}
            />
            <SettingRow label="Submit feedback">
                <OpenUrlButton text="Open form" url={FEEDBACK_FORM_URL} />
            </SettingRow>
        </>
    );
}

interface ThemeSelectProps {
    theme: Theme;
    onThemeSelect: Dispatch<Theme>;
}

function ThemeSelect(props: ThemeSelectProps): ReactNode {
    const { theme, onThemeSelect } = props;

    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const themes = useSelectOptions(
        [Theme.SYSTEM, Theme.DARK, Theme.LIGHT],
        capitalize
    );

    return (
        <AppSelect
            option={makeSelectOption(theme, capitalize)}
            options={themes}
            label="Theme"
            onSelect={(value) => onThemeSelect(value as Theme)}
        />
    );
}

function AdminSettings(): ReactNode {
    return (
        <>
            {/* Always show the access level select so admins can change access level if needed */}
            <AccessLevelSelect />
            <RequireAccessLevel>
                <ReloadDocumentsButton />
                <ReloadDocumentsButton reloadAll />
                <PushVersionButton />
            </RequireAccessLevel>
        </>
    );
}

/**
 * Pushes a new version of the app which invalidates all existing CDN caches.
 */
function PushVersionButton(): ReactNode {
    const library = useLibrary();
    const router = useRouter();

    const pushVersionMutation = useMutation({
        mutationKey: ["library-version", library],
        // The backend rebuilds the search index itself, so this just bumps the
        // cache version (invalidating CDN caches).
        mutationFn: async () => {
            return apiPost("/library-version" + toLibraryPath(library));
        },
        onError: getAppErrorHandler("Unexpectedly failed to push new version."),
        onSuccess: () => {
            showSuccessToast("Successfully updated the FRCDesignApp version.");
        },
        onSettled: async () => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: searchDbQueryMatchKey()
                }),
                queryClient.refetchQueries({ queryKey: contextDataQueryKey() })
            ]);
            void router.invalidate();
        }
    });

    return (
        <SettingRow label="Push new app version">
            <Button
                variant="default"
                leftSection={<IconCloudUpload size={IconSize.SMALL} />}
                onClick={() => {
                    pushVersionMutation.mutate();
                }}
            >
                Push version
            </Button>
        </SettingRow>
    );
}

function AccessLevelSelect(): ReactNode {
    const loaderData = useLoaderData({ from: "/app" });
    const router = useRouter();

    const { maxAccessLevel, currentAccessLevel } = loaderData;
    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const accessLevels = useSelectOptions(
        useMemo(
            () =>
                maxAccessLevel === AccessLevel.ADMIN
                    ? [AccessLevel.ADMIN, AccessLevel.EDITOR, AccessLevel.USER]
                    : [AccessLevel.EDITOR, AccessLevel.USER],
            [maxAccessLevel]
        ),
        capitalize
    );

    return (
        <AppSelect
            label="Access level"
            option={makeSelectOption(currentAccessLevel, capitalize)}
            options={accessLevels}
            onSelect={(value) => {
                queryClient.setQueryData(
                    contextDataQueryKey(),
                    getQueryUpdater((data: ContextData) => {
                        data.accessData.currentAccessLevel =
                            value as AccessLevel;
                        return data;
                    })
                );
                void router.invalidate();
            }}
        />
    );
}

interface ReloadDocumentsButtonProps {
    reloadAll?: boolean;
    hideFormGroup?: boolean;
}

export function ReloadDocumentsButton(
    props: ReloadDocumentsButtonProps
): ReactNode {
    const reloadAll = props.reloadAll ?? false;
    const hideFormGroup = props.hideFormGroup ?? false;

    const library = useLibrary();
    const router = useRouter();

    const mutation = useMutation({
        mutationKey: ["reload-documents"],
        mutationFn: async () => {
            return apiPost("/reload-documents" + toLibraryPath(library), {
                query: { reloadAll }
            });
        },
        onError: getAppErrorHandler("Failed to reload documents!"),
        onSuccess: (result) => {
            const savedElements = result.savedElements;
            if (savedElements === 0) {
                showSuccessToast("All documents are already up to date.");
            } else {
                showSuccessToast(
                    "Successfully reloaded " + savedElements + " elements."
                );
            }
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: libraryQueryMatchKey()
            });
            void router.invalidate();
        }
    });

    const handleClick = () => {
        modals.openConfirmModal({
            title: reloadAll
                ? "Reload all documents"
                : "Reload outdated documents",
            children:
                "Are you sure you want to reload" +
                (reloadAll ? " all documents?" : " outdated documents?"),
            labels: { confirm: "Reload", cancel: "Cancel" },
            confirmProps: {
                variant: "light",
                color: reloadAll ? "red" : "blue"
            },
            onConfirm: () => mutation.mutate()
        });
    };

    const button = (
        <Button
            variant="light"
            color={reloadAll ? "red" : "blue"}
            leftSection={<IconRefresh size={IconSize.SMALL} />}
            onClick={handleClick}
            loading={mutation.isPending}
        >
            Reload
        </Button>
    );

    if (hideFormGroup) {
        return button;
    }

    const label = reloadAll
        ? "Reload all documents"
        : "Reload outdated documents";
    return <SettingRow label={label}>{button}</SettingRow>;
}
