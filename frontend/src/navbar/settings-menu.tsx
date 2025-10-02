import {
    Alert,
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
import { AppMenu, useHandleCloseDialog } from "../api/menu-params";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { showErrorToast, showSuccessToast } from "../common/toaster";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../api/api";
import { queryClient } from "../query-client";
import { AccessLevel, hasMemberAccess, Settings, Theme } from "../api/models";
import { ItemRenderer, Select } from "@blueprintjs/select";
import { capitalize } from "../common/utils";
import { invalidateSearchDb } from "../app/search";
import { toUserApiPath } from "../api/path";
import { useSettings } from "../queries";
import { router } from "../router";
import { OpenUrlButton } from "../common/open-url-button";
import { RequireAccessLevel } from "../api/access-level";
import { FEEDBACK_FORM_URL } from "../common/url";

export function SettingsMenu(): ReactNode {
    const search = useSearch({ from: "/app" });
    if (search.activeMenu !== AppMenu.SETTINGS_MENU) {
        return null;
    }
    return <SettingsMenuDialog />;
}

function SettingsMenuDialog(): ReactNode {
    const closeDialog = useHandleCloseDialog();

    const search = useSearch({ from: "/app" });

    let adminSettings = null;
    // Unlike all other checks, this one uses maxAccessLevel so you can still switch from user to admin
    if (hasMemberAccess(search.maxAccessLevel)) {
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
            className="settings-dialog"
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
    const settings = useSettings();

    const settingsMutation = useMutation({
        mutationKey: ["settings"],
        mutationFn: async (newSettings: Settings) =>
            apiPost("/settings" + toUserApiPath(search), {
                body: newSettings
            }),
        onMutate: (newSettings) => {
            queryClient.setQueryData(["settings"], newSettings);
            router.invalidate();
        },
        onError: () => {
            showErrorToast("Unexpectedly failed to update settings.");
            queryClient.refetchQueries({ queryKey: ["settings"] });
            router.invalidate();
        }
    });

    return (
        <>
            <FormGroup label="Submit feedback" className="full-width" inline>
                <OpenUrlButton text="Open form" url={FEEDBACK_FORM_URL} />
            </FormGroup>
            <ThemeSelect
                theme={settings.theme}
                onThemeSelect={(theme) => settingsMutation.mutate({ theme })}
            />
        </>
    );
}

interface ThemeSelectProps {
    theme: Theme;
    onThemeSelect: Dispatch<Theme>;
}

function ThemeSelect(props: ThemeSelectProps) {
    const { theme, onThemeSelect } = props;

    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const themes = useMemo(() => {
        return [Theme.SYSTEM, Theme.DARK, Theme.LIGHT];
    }, []);

    const [activeTheme, setActiveTheme] = useState<Theme | null>(theme);

    const renderTheme: ItemRenderer<Theme> = (
        currentTheme,
        { handleClick, handleFocus, modifiers, ref }
    ) => {
        const selected = theme === currentTheme;
        return (
            <MenuItem
                key={currentTheme}
                ref={ref}
                onClick={handleClick}
                onFocus={handleFocus}
                active={modifiers.active}
                text={capitalize(currentTheme)}
                roleStructure="listoption"
                selected={selected}
                intent={selected ? Intent.PRIMARY : Intent.NONE}
            />
        );
    };

    const select = (
        <Select<Theme>
            items={themes}
            activeItem={activeTheme}
            onActiveItemChange={setActiveTheme}
            filterable={false}
            popoverProps={{ minimal: true }}
            itemRenderer={renderTheme}
            onItemSelect={onThemeSelect}
        >
            <Button
                alignText="start"
                endIcon="caret-down"
                text={capitalize(theme)}
            />
        </Select>
    );

    return (
        <FormGroup label="Theme" className="full-width" inline>
            {select}
        </FormGroup>
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
    const navigate = useNavigate();
    const pushVersionMutation = useMutation({
        mutationKey: ["push-cache-version"],
        mutationFn: async () => apiPost("/cache-version"),
        onError: () => {
            showErrorToast("Unexpectedly failed to push new version.");
        },
        onSuccess: (data: { newVersion: number }) => {
            showSuccessToast("Successfully updated the FRCDesignApp version.");
            navigate({ to: ".", search: { cacheVersion: data.newVersion } });
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
    const search = useSearch({ from: "/app" });
    const navigate = useNavigate();

    const maxAccessLevel = search.maxAccessLevel;
    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const accessLevels = useMemo(() => {
        return maxAccessLevel === AccessLevel.ADMIN
            ? [AccessLevel.ADMIN, AccessLevel.MEMBER, AccessLevel.USER]
            : [AccessLevel.MEMBER, AccessLevel.USER];
    }, [maxAccessLevel]);

    const [activeLevel, setActiveLevel] = useState<AccessLevel | null>(
        search.currentAccessLevel
    );

    const button = (
        <Button
            alignText="start"
            endIcon="caret-down"
            text={capitalize(search.currentAccessLevel)}
        />
    );

    const renderAccessLevel: ItemRenderer<AccessLevel> = (
        accessLevel,
        { handleClick, handleFocus, modifiers, ref }
    ) => {
        const selected = search.currentAccessLevel === accessLevel;
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
                navigate({
                    to: ".",
                    search: { currentAccessLevel: accessLevel }
                });
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

    const mutation = useMutation({
        mutationKey: ["reload-documents"],
        mutationFn: async () => {
            return apiPost("/reload-documents", {
                // Set a timeout of 5 minutes
                query: { reloadAll }
            });
        },
        onError: () => {
            showErrorToast("Failed to reload documents!");
        },
        onSuccess: async (result) => {
            const savedElements = result["savedElements"];
            if (savedElements === 0) {
                showSuccessToast("All documents were already up to date.");
            } else {
                showSuccessToast(
                    "Successfully reloaded " + savedElements + " elements."
                );
            }
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["documents"] }),
                queryClient.refetchQueries({ queryKey: ["elements"] })
            ]);
            invalidateSearchDb();
        }
    });

    const [isAlertOpen, setIsAlertOpen] = useState(false);

    const alert = (
        <Alert
            confirmButtonText="Reload"
            icon="refresh"
            intent={reloadAll ? Intent.DANGER : Intent.PRIMARY}
            isOpen={isAlertOpen}
            canEscapeKeyCancel
            canOutsideClickCancel
            cancelButtonText="Cancel"
            onClose={(confirmed) => {
                if (confirmed) {
                    mutation.mutate();
                }
                setIsAlertOpen(false);
            }}
        >
            Are you sure you want to
            {reloadAll
                ? " reload all documents?"
                : " reload outdated documents?"}
        </Alert>
    );

    const button = (
        <Button
            icon="refresh"
            text="Reload"
            onClick={() => setIsAlertOpen(true)}
            loading={mutation.isPending}
            intent={reloadAll ? Intent.DANGER : Intent.PRIMARY}
        />
    );

    const formGroup = hideFormGroup ? (
        button
    ) : (
        <FormGroup
            label={
                reloadAll ? "Reload all documents" : "Reload outdated documents"
            }
            inline
        >
            {button}
        </FormGroup>
    );

    return (
        <>
            {formGroup}
            {alert}
        </>
    );
}
