import { DEFAULT_SETTINGS, Theme } from "@backend/features/settings/settings";
import { Box, Button, Select, Stack } from "@mantine/core";
import { ArrowLeftIcon, SignOutIcon } from "@phosphor-icons/react";
import { useMatch } from "@tanstack/react-router";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { ReactNode, useId } from "react";
import {
    AccessLevel,
    hasEditorAccess,
    isWithinAccessLevel
} from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { useSaveSettings } from "../settings";
import { InputRow } from "../../../components/input-row";
import { OpenUrlButton } from "../../../components/open-url-button";
import { Section } from "../../../components/section";
import {
    RequireAccessLevel,
    RequireSignIn,
    useAccessData
} from "../../auth/access-level";
import { startSignOut } from "../../auth/sign-out";
import { useGetUiState, useSetUiState } from "../../../lib/ui-state";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { useLibraryId } from "../../library/library-path";
import { ReloadGroupsButton } from "../../library/components/reload-groups-button";

/** The FRCDesign feedback form, which the setting below opens. */
const FEEDBACK_FORM_URL = "https://forms.gle/WVXUwnrrpLGKdiBx9";

/** The usage dashboard, served standalone and needing no sign-in. */
const DASHBOARD_URL = "/dashboard";

/** Capitalizes the first letter of a string and lower cases everything else. */
function capitalize(value: string) {
    return value[0].toUpperCase() + value.slice(1).toLowerCase();
}

interface SettingSelectProps<T extends string> {
    label: string;
    value: T;
    /** Shown capitalized, in the order given. */
    options: T[];
    onSelect: (value: T) => void;
}

/** A setting chosen from a short list of named values. */
function SettingSelect<T extends string>(props: SettingSelectProps<T>) {
    const { label, value, options, onSelect } = props;
    const id = useId();

    return (
        <InputRow label={label} htmlFor={id} spread>
            <Select
                id={id}
                w={SETTING_CONTROL_WIDTH}
                data={options.map((option) => ({
                    value: option,
                    label: capitalize(option)
                }))}
                value={value}
                allowDeselect={false}
                checkIconPosition="right"
                comboboxProps={{ withinPortal: true }}
                onChange={(selected) => {
                    if (selected !== null) {
                        onSelect(selected);
                    }
                }}
            />
        </InputRow>
    );
}

/** Wide enough for "Open dashboard", so every control ends on one line. */
const SETTING_CONTROL_WIDTH = 170;

export function SettingsMenuContent(): ReactNode {
    const { maxAccessLevel } = useAccessData();

    return (
        <>
            <UserSettings />
            {/* Unlike all other checks, this one uses maxAccessLevel so you can
                still switch back up from user to admin. */}
            {hasEditorAccess(maxAccessLevel) && (
                <Box mt="md">
                    {/* The modal title's size, so the admin half of the menu
                        announces itself rather than reading as another row. */}
                    <Section title="Admin settings" order={5}>
                        <AdminSettings />
                    </Section>
                </Box>
            )}
        </>
    );
}

function UserSettings(): ReactNode {
    const libraryId = useLibraryId();
    const isConnected = useIsConnectedToOnshape();
    const isDashboard = useIsDashboard();

    return (
        <Stack gap="sm">
            <ThemeSelect />
            {/* Only worth offering from inside Onshape's panel, which is what
                the standalone app is roomier than. */}
            {isConnected && (
                <InputRow spread label="Open outside Onshape">
                    <OpenUrlButton
                        text="Open app"
                        url={standaloneUrl(libraryId)}
                    />
                </InputRow>
            )}
            {/* The dashboard is where the app is the thing worth offering. */}
            {isDashboard ? (
                <InputRow spread label="Main app">
                    <OpenAppButton libraryId={libraryId} />
                </InputRow>
            ) : (
                <InputRow spread label="Usage dashboard">
                    <OpenUrlButton text="Open dashboard" url={DASHBOARD_URL} />
                </InputRow>
            )}
            <InputRow spread label="Submit feedback">
                <OpenUrlButton text="Open form" url={FEEDBACK_FORM_URL} />
            </InputRow>
            {/* Onshape owns the session the panel runs in, so signing out is
                only the standalone app's to offer. */}
            {!isConnected && (
                <RequireSignIn>
                    <InputRow spread label="Onshape account">
                        <Button
                            leftSection={<SignOutIcon size={IconSize.SMALL} />}
                            variant="light"
                            color={StatusColor.ERROR}
                            onClick={startSignOut}
                        >
                            Sign out
                        </Button>
                    </InputRow>
                </RequireSignIn>
            )}
        </Stack>
    );
}

/**
 * The app's own url for the library, free of Onshape's launch params, which are
 * what would keep it embedded. Settings follow on their own, being this browser's.
 */
function standaloneUrl(libraryId: LibraryId): string {
    return new URL(`/app/library/${libraryId}`, window.location.origin).href;
}

/** Whether the dashboard is showing, rather than the app itself. */
function useIsDashboard(): boolean {
    return useMatch({ from: "/dashboard", shouldThrow: false }) !== undefined;
}

interface OpenAppButtonProps {
    libraryId: LibraryId;
}

/** Leaves the dashboard for the app, in place rather than in a second tab. */
function OpenAppButton(props: OpenAppButtonProps): ReactNode {
    return (
        <Button
            leftSection={<ArrowLeftIcon size={IconSize.SMALL} />}
            variant="light"
            onClick={() => {
                window.location.href = standaloneUrl(props.libraryId);
            }}
        >
            Open app
        </Button>
    );
}

function ThemeSelect(): ReactNode {
    const theme = useGetUiState().theme;
    const saveSettings = useSaveSettings();

    return (
        <SettingSelect
            label="Theme"
            value={theme ?? DEFAULT_SETTINGS.theme}
            options={[Theme.SYSTEM, Theme.DARK, Theme.LIGHT]}
            onSelect={(theme) => saveSettings({ theme })}
        />
    );
}

function AdminSettings(): ReactNode {
    return (
        <Stack gap="sm">
            {/* Always show the access level select so admins can change access level if needed */}
            <AccessLevelSelect />
            <RequireAccessLevel>
                <InputRow spread label="Reload outdated documents">
                    <ReloadGroupsButton />
                </InputRow>
                <InputRow spread label="Reload all documents">
                    <ReloadGroupsButton reloadAll />
                </InputRow>
            </RequireAccessLevel>
        </Stack>
    );
}

function AccessLevelSelect(): ReactNode {
    const { maxAccessLevel, currentAccessLevel } = useAccessData();
    const setUiState = useSetUiState();

    return (
        <SettingSelect
            label="Access level"
            value={currentAccessLevel}
            options={[
                AccessLevel.ADMIN,
                AccessLevel.EDITOR,
                AccessLevel.USER
            ].filter((level) => isWithinAccessLevel(level, maxAccessLevel))}
            onSelect={(accessLevel) => setUiState({ accessLevel })}
        />
    );
}
