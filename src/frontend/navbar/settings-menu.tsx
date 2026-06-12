import { Button, Divider, Group, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconCloudUpload, IconRefresh, IconX } from "@tabler/icons-react";
import { FontWeight, IconSize } from "../common/style-constants";
import { Dispatch, ReactNode, useMemo } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
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
import { toLibraryPath, useLibraryId } from "../api-utils/library";
import {
    contextDataQueryKey,
    libraryQueryMatchKey,
    searchDbQueryMatchKey
} from "../queries";
import { AppSelect } from "../common/app-select";
import { makeSelectOption, useSelectOptions } from "../common/select-utils";

export function openSettingsMenu() {
    modals.open({
        title: "Settings",
        centered: true,
        children: <SettingsMenuContent />
    });
}

/**
 * A labeled row holding a single setting control.
 */
function SettingRow(props: { label: string; children: ReactNode }): ReactNode {
    return (
        <Group justify="space-between" wrap="nowrap" my="sm">
            <Text size="sm" fw={FontWeight.SEMI_BOLD}>
                {props.label}
            </Text>
            {props.children}
        </Group>
    );
}

function SettingsMenuContent(): ReactNode {
    const loaderData = useLoaderData({ from: "/app" });

    let adminSettings: ReactNode = null;
    // Unlike all other checks, this one uses maxAccessLevel so you can still switch from user to admin
    if (hasEditorAccess(loaderData.accessData.maxAccessLevel)) {
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
        <>
            <UserSettings />
            {adminSettings}
            <Group justify="flex-end" mt="md">
                <Button
                    variant="default"
                    leftSection={<IconX size={IconSize.SMALL} />}
                    onClick={() => modals.closeAll()}
                >
                    Close
                </Button>
            </Group>
        </>
    );
}

function UserSettings(): ReactNode {
    const loaderData = useLoaderData({ from: "/app" });
    const saveSettings = useSaveSettings();

    return (
        <>
            <ThemeSelect
                theme={loaderData.settings.theme}
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
                <ReloadGroupsButton />
                <ReloadGroupsButton reloadAll />
                <PushVersionButton />
            </RequireAccessLevel>
        </>
    );
}

/**
 * Pushes a new version of the app which invalidates all existing CDN caches.
 */
function PushVersionButton(): ReactNode {
    const libraryId = useLibraryId();
    const router = useRouter();

    const pushVersionMutation = useMutation({
        mutationKey: ["library-version", libraryId],
        // The backend rebuilds the search index itself, so this just bumps the
        // cache version (invalidating CDN caches).
        mutationFn: async () => {
            return apiPost("/library-version" + toLibraryPath(libraryId));
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

    const { maxAccessLevel, currentAccessLevel } = loaderData.accessData;
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

interface ReloadGroupsButtonProps {
    reloadAll?: boolean;
    hideFormGroup?: boolean;
}

export function ReloadGroupsButton(props: ReloadGroupsButtonProps): ReactNode {
    const reloadAll = props.reloadAll ?? false;
    const hideFormGroup = props.hideFormGroup ?? false;

    const libraryId = useLibraryId();
    const router = useRouter();

    const mutation = useMutation({
        mutationKey: ["reload-groups"],
        mutationFn: async () => {
            return apiPost("/reload-groups" + toLibraryPath(libraryId), {
                query: { reloadAll }
            });
        },
        onError: getAppErrorHandler("Failed to reload groups!"),
        onSuccess: (result) => {
            const savedElements = result.savedElements;
            if (savedElements === 0) {
                showSuccessToast("All groups are already up to date.");
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
            title: reloadAll ? "Reload all groups" : "Reload outdated groups",
            children:
                "Are you sure you want to reload" +
                (reloadAll ? " all groups?" : " outdated groups?"),
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
