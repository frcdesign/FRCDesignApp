import { useNavigate, useRouterState } from "@tanstack/react-router";
import { DEFAULT_SETTINGS } from "@backend/features/settings/settings";
import { Divider, Group, Text, Title } from "@mantine/core";
import { FontWeight } from "../../../lib/style-constants";
import { Dispatch, ReactNode, useMemo } from "react";
import { Theme } from "@backend/features/settings/settings";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { isWithinAccessLevel } from "@backend/features/auth/access-level";
import { AccessLevel } from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { useSaveSettings } from "../settings";
import { OpenUrlButton } from "../../../components/open-url-button";
import { RequireAccessLevel, useAccessData } from "../../auth/access-level";
import { useUiState } from "../../../lib/ui-state";
import { FEEDBACK_FORM_URL } from "../../../lib/url";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { useLibraryId } from "../../library/library-path";
import { AppSelect } from "../../../components/app-select";
import {
    makeSelectOption,
    useSelectOptions
} from "../../../components/select-utils";
import { ReloadGroupsButton } from "../../library/components/reload-groups-button";

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

/** Capitalizes the first letter of a string and lower cases everything else. */
function capitalize(val: string) {
    return val[0].toUpperCase() + val.slice(1).toLowerCase();
}

export function SettingsMenuContent(): ReactNode {
    const accessData = useAccessData();

    let adminSettings: ReactNode = null;
    // Unlike all other checks, this one uses maxAccessLevel so you can still switch from user to admin
    if (hasEditorAccess(accessData.maxAccessLevel)) {
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
        </>
    );
}

function UserSettings(): ReactNode {
    // The modal renders at the root, outside the route matches, so navigate by
    // exact path: a bare navigate would resolve to the route `from` names.
    const location = useRouterState({ select: (state) => state.location });
    const navigate = useNavigate();
    const saveSettings = useSaveSettings();
    const libraryId = useLibraryId();
    const isConnected = useIsConnectedToOnshape();
    const theme = location.search.theme ?? DEFAULT_SETTINGS.theme;

    return (
        <>
            <ThemeSelect
                theme={theme}
                onThemeSelect={(theme) => {
                    // The url renders it; the write-behind decides what the
                    // entry redirect seeds next time.
                    saveSettings({ theme });
                    void navigate({
                        to: location.pathname,
                        search: (prev) => ({ ...prev, theme })
                    });
                }}
            />
            {/* Only worth offering from inside Onshape's panel, which is what
                the standalone app is roomier than. */}
            {isConnected && (
                <SettingRow label="Open outside Onshape">
                    <OpenUrlButton
                        text="Open app"
                        url={standaloneUrl(libraryId, theme)}
                    />
                </SettingRow>
            )}
            <SettingRow label="Submit feedback">
                <OpenUrlButton text="Open form" url={FEEDBACK_FORM_URL} />
            </SettingRow>
        </>
    );
}

/**
 * The app's own url for the current library, free of the params Onshape
 * launches it with — carrying those over is what would keep it embedded.
 */
function standaloneUrl(libraryId: LibraryId, theme: Theme): string {
    const url = new URL(`/app/library/${libraryId}`, window.location.origin);
    url.searchParams.set("theme", theme);
    return url.toString();
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
                <SettingRow label="Reload outdated documents">
                    <ReloadGroupsButton />
                </SettingRow>
                <SettingRow label="Reload all documents">
                    <ReloadGroupsButton reloadAll />
                </SettingRow>
            </RequireAccessLevel>
        </>
    );
}

function AccessLevelSelect(): ReactNode {
    const accessData = useAccessData();
    const setUiState = useUiState()[1];

    const { maxAccessLevel, currentAccessLevel } = accessData;
    // Use a memo to stabilize access levels so Select's activeItem tracks properly between renders
    const accessLevels = useSelectOptions(
        useMemo(
            () =>
                [
                    AccessLevel.ADMIN,
                    AccessLevel.EDITOR,
                    AccessLevel.USER
                ].filter((level) => isWithinAccessLevel(level, maxAccessLevel)),
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
                setUiState({ accessLevel: value as AccessLevel });
            }}
        />
    );
}
