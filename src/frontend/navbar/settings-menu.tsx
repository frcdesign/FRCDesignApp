import {
    Button,
    Divider,
    Group,
    Modal,
    Text,
    Title
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
    IconCloudUpload,
    IconRefresh,
    IconX
} from "@tabler/icons-react";
import { Dispatch, ReactNode, useMemo } from "react";
import { MenuType, useHandleCloseDialog } from "../overlays/menu-params";
import {
    useLoaderData,
    useNavigate,
    useRouter,
    useSearch
} from "@tanstack/react-router";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api-utils/api";
import { queryClient } from "../query-client";
import { LibraryOut } from "../../shared/api-models";
import { Library } from "../../shared/types";
import { type ContextData, Theme } from "../../shared/types";
import { hasEditorAccess } from "../../shared/types";
import { AccessLevel } from "../../shared/types";
import { getLibraryName as getLibraryName } from "../api-utils/library";
import { capitalize, getQueryUpdater } from "../common/utils";
import { buildSearchDb } from "../search/search";
import { OpenUrlButton } from "../common/open-url-button";
import { RequireAccessLevel } from "../api-utils/access-level";
import { FEEDBACK_FORM_URL } from "../common/url";
import { getAppErrorHandler, HandledError } from "../api-utils/errors";
import { toLibraryPath, useLibrary } from "../api-utils/library";
import {
    contextDataQueryKey,
    libraryQueryKey,
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
function SettingRow(props: {
    label: string;
    children: ReactNode;
}): ReactNode {
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
        <Modal
            className="settings-menu"
            opened
            onClose={closeDialog}
            title="Settings"
            centered
        >
            <UserSettings />
            {adminSettings}
            <Group justify="flex-end" mt="md">
                <Button
                    color="blue"
                    leftSection={<IconX size={16} />}
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
    const navigate = useNavigate();

    const saveSettings = (newSettings: {
        theme?: Theme;
        library?: Library;
    }) => {
        // Navigate immediately — this IS the optimistic update since settings live in search params
        void navigate({
            to: ".",
            search: { settings: { ...search.settings, ...newSettings } }
        });
        apiPost("/user-data", { body: newSettings }).catch(() => {
            showErrorToast("Unexpectedly failed to update settings.");
        });
    };

    return (
        <>
            <LibrarySelect
                library={search.settings.library}
                onLibrarySelect={(newLibrary) =>
                    saveSettings({ library: newLibrary })
                }
            />
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

interface LibrarySelectProps {
    library: Library;
    onLibrarySelect: Dispatch<Library>;
}

function LibrarySelect(props: LibrarySelectProps): ReactNode {
    const { library, onLibrarySelect } = props;

    const navigate = useNavigate();

    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const libraries = useSelectOptions(
        [Library.FRC_DESIGN_LIB, Library.MKCAD],
        getLibraryName
    );

    return (
        <AppSelect
            option={makeSelectOption(library, getLibraryName)}
            options={libraries}
            label="Library"
            onSelect={(value: string) => {
                void navigate({ to: "/app/documents" });
                onLibrarySelect(value as Library);
            }}
        />
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
    const loaderData = useLoaderData({ from: "/app" });
    const router = useRouter();

    const pushVersionMutation = useMutation({
        mutationKey: ["library-version", library],
        mutationFn: async () => {
            const libraryData = await queryClient.fetchQuery<LibraryOut>({
                queryKey: libraryQueryKey(library, loaderData)
            });
            if (!libraryData) {
                throw new HandledError("Failed to fetch library data.");
            }
            const searchDb = JSON.stringify(buildSearchDb(libraryData));
            return apiPost("/library-version" + toLibraryPath(library), {
                body: { searchDb }
            });
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
                color="blue"
                leftSection={<IconCloudUpload size={16} />}
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
            confirmProps: { color: reloadAll ? "red" : "blue" },
            onConfirm: () => mutation.mutate()
        });
    };

    const button = (
        <Button
            color={reloadAll ? "red" : "blue"}
            leftSection={<IconRefresh size={16} />}
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
