import {
    Button,
    Dialog,
    DialogBody,
    DialogFooter,
    Divider,
    FormGroup,
    H6,
    Intent,
    MenuItem
} from "@blueprintjs/core";
import { Dispatch, ReactNode, useMemo, useState } from "react";
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
import { Library, LibraryObj } from "../api-utils/client-models";
import { type ContextData, Theme } from "../../shared/types";
import { hasEditorAccess } from "../../shared/types";
import { AccessLevel } from "../../shared/types";
import { getLibraryName as getLibraryName } from "../api-utils/library";
import { ItemRenderer, Select } from "@blueprintjs/select";
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

function SettingsMenuDialog(): ReactNode {
    const closeDialog = useHandleCloseDialog();

    const loaderData = useLoaderData({ from: "/app" });

    let adminSettings: ReactNode = null;
    // Unlike all other checks, this one uses maxAccessLevel so you can still switch from user to admin
    if (hasEditorAccess(loaderData.maxAccessLevel)) {
        adminSettings = (
            <>
                <H6>Admin Settings</H6>
                <Divider />
                <AdminSettings />
            </>
        );
    }

    const closeButton = (
        <Button
            text="Close"
            icon="cross"
            intent={Intent.PRIMARY}
            onClick={closeDialog}
        />
    );

    return (
        <Dialog
            className="settings-menu"
            isOpen
            icon="cog"
            title="Settings"
            onClose={closeDialog}
        >
            <DialogBody>
                <UserSettings />
                {adminSettings}
            </DialogBody>
            <DialogFooter minimal actions={closeButton} />
        </Dialog>
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
        navigate({
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
            <FormGroup label="Submit feedback" className="full-width" inline>
                <OpenUrlButton text="Open form" url={FEEDBACK_FORM_URL} />
            </FormGroup>
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
                navigate({ to: "/app/documents" });
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
            const libraryData = await queryClient.fetchQuery<LibraryObj>({
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
            router.invalidate();
        }
    });

    return (
        <FormGroup label="Push new app version" inline>
            <Button
                icon="cloud-upload"
                text="Push version"
                onClick={() => {
                    pushVersionMutation.mutate();
                }}
                intent={Intent.PRIMARY}
            />
        </FormGroup>
    );
}

function AccessLevelSelect(): ReactNode {
    const loaderData = useLoaderData({ from: "/app" });
    const router = useRouter();

    const { maxAccessLevel, currentAccessLevel } = loaderData;
    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const accessLevels = useMemo(() => {
        return maxAccessLevel === AccessLevel.ADMIN
            ? [AccessLevel.ADMIN, AccessLevel.EDITOR, AccessLevel.USER]
            : [AccessLevel.EDITOR, AccessLevel.USER];
    }, [maxAccessLevel]);

    const [activeLevel, setActiveLevel] = useState<AccessLevel | null>(
        currentAccessLevel
    );

    const button = (
        <Button
            alignText="start"
            endIcon="caret-down"
            text={capitalize(currentAccessLevel)}
        />
    );

    const renderAccessLevel: ItemRenderer<AccessLevel> = (
        accessLevel,
        { handleClick, handleFocus, modifiers, ref }
    ) => {
        const selected = currentAccessLevel === accessLevel;
        return (
            <MenuItem
                key={accessLevel}
                ref={ref}
                onClick={handleClick}
                onFocus={handleFocus}
                active={modifiers.active}
                text={capitalize(accessLevel)}
                roleStructure="listoption"
                selected={selected}
                intent={selected ? Intent.PRIMARY : Intent.NONE}
            />
        );
    };

    const select = (
        <Select<AccessLevel>
            items={accessLevels}
            activeItem={activeLevel}
            onActiveItemChange={setActiveLevel}
            filterable={false}
            popoverProps={{ minimal: true }}
            itemRenderer={renderAccessLevel}
            onItemSelect={(accessLevel) => {
                queryClient.setQueryData(
                    contextDataQueryKey(),
                    getQueryUpdater((data: ContextData) => {
                        data.accessData.currentAccessLevel = accessLevel;
                        return data;
                    })
                );
                router.invalidate();
            }}
        >
            {button}
        </Select>
    );

    return (
        <FormGroup label="Access level" className="full-width" inline>
            {select}
        </FormGroup>
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
            const confirmMessage =
                "Are you sure you want to reload" +
                (reloadAll ? " all documents?" : " outdated documents?");

            if (!window.confirm(confirmMessage)) {
                throw new HandledError("Cancelled operation.");
            }

            return apiPost("/reload-documents" + toLibraryPath(library), {
                query: { reloadAll }
            });
        },
        onError: getAppErrorHandler("Failed to reload documents!"),
        onSuccess: async (result) => {
            const savedElements = result["savedElements"];
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
            router.invalidate();
        }
    });

    const button = (
        <Button
            icon="refresh"
            text="Reload"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            intent={reloadAll ? Intent.DANGER : Intent.PRIMARY}
        />
    );

    if (hideFormGroup) {
        return button;
    }

    const label = reloadAll
        ? "Reload all documents"
        : "Reload outdated documents";
    return (
        <FormGroup label={label} inline>
            {button}
        </FormGroup>
    );
}

// interface ReloadAlertProps {
//     reloadAll?: boolean;
// }

// export function ReloadAlert(props: ReloadAlertProps) {
//     return (
//         <Alert
//             confirmButtonText="Reload"
//             icon="refresh"
//             intent={Intent.PRIMARY}
//             isOpen={props.isOpen}
//             onClose={props.onClose}
//             canEscapeKeyCancel
//             canOutsideClickCancel
//             cancelButtonText="Cancel"
//         >
//             Are you sure you want to reload
//             {props.reloadAll ? " all documents?" : " outdated documents?"}
//         </Alert>
//     );
// }
