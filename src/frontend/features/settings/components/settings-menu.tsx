import { DEFAULT_SETTINGS, Theme } from "@backend/features/settings/settings";
import { Button, Divider, Group, Select, Text, Title } from "@mantine/core";
import { SignOutIcon } from "@phosphor-icons/react";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { PropsWithChildren, ReactNode } from "react";
import {
    AccessLevel,
    hasEditorAccess,
    isWithinAccessLevel
} from "@backend/features/auth/access-level";
import { LibraryId } from "@backend/features/library/library-id";
import { useSaveSettings } from "../settings";
import { OpenUrlButton } from "../../../components/open-url-button";
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

interface SettingRowProps extends PropsWithChildren {
    label: string;
}

function SettingRow(props: SettingRowProps): ReactNode {
    const { label, children } = props;
    return (
        <Group justify="space-between" wrap="nowrap" my="sm">
            <Text size="sm" fw={FontWeight.SEMI_BOLD}>
                {label}
            </Text>
            {children}
        </Group>
    );
}

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
    return (
        <Select
            label={label}
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
    );
}

export function SettingsMenuContent(): ReactNode {
    const { maxAccessLevel } = useAccessData();

    return (
        <>
            <UserSettings />
            {/* Unlike all other checks, this one uses maxAccessLevel so you can
                still switch back up from user to admin. */}
            {hasEditorAccess(maxAccessLevel) && (
                <>
                    <Title order={6} mt="md">
                        Admin Settings
                    </Title>
                    <Divider mb="sm" />
                    <AdminSettings />
                </>
            )}
        </>
    );
}

function UserSettings(): ReactNode {
    const libraryId = useLibraryId();
    const isConnected = useIsConnectedToOnshape();

    return (
        <>
            <ThemeSelect />
            {/* Only worth offering from inside Onshape's panel, which is what
                the standalone app is roomier than. */}
            {isConnected && (
                <SettingRow label="Open outside Onshape">
                    <OpenUrlButton
                        text="Open app"
                        url={standaloneUrl(libraryId)}
                    />
                </SettingRow>
            )}
            <SettingRow label="Submit feedback">
                <OpenUrlButton text="Open form" url={FEEDBACK_FORM_URL} />
            </SettingRow>
            {/* Onshape owns the session the panel runs in, so signing out is
                only the standalone app's to offer. */}
            {!isConnected && (
                <RequireSignIn>
                    <SettingRow label="Onshape account">
                        <Button
                            leftSection={<SignOutIcon size={IconSize.SMALL} />}
                            variant="light"
                            color={StatusColor.ERROR}
                            onClick={startSignOut}
                        >
                            Sign out
                        </Button>
                    </SettingRow>
                </RequireSignIn>
            )}
        </>
    );
}

/**
 * The app's own url for the library, free of Onshape's launch params, which are
 * what would keep it embedded. Settings follow on their own, being this browser's.
 */
function standaloneUrl(libraryId: LibraryId): string {
    return new URL(`/app/library/${libraryId}`, window.location.origin).href;
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
