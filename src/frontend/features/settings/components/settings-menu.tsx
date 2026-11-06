import { Button, Divider, Select, Stack } from "@mantine/core";
import {
    ArrowLeftIcon,
    ChatCircleTextIcon,
    SignOutIcon
} from "@phosphor-icons/react";
import { useIsDashboard } from "../../dashboard/dashboard-nav";
import {
    SETTING_CONTROL_WIDTH,
    StatusColor
} from "../../../lib/style-constants";
import { ReactNode, useId } from "react";
import {
    AccessLevel,
    hasEditorAccess,
    isWithinAccessLevel
} from "@backend/features/auth/access-level";
import { type AppTab, getTabPath } from "../../../lib/app-tab";
import { InputRow } from "../../../components/input-row";
import { OpenUrlButton } from "../../../components/open-url-button";
import { AppSection, AppSections } from "../../../components/app-section";
import { useAccessData } from "../../auth/access-level";
import {
    RequireAccessLevel,
    RequireSignIn
} from "../../auth/components/require-access";
import { startSignOut } from "../../auth/sign-out";
import {
    SectionId,
    setOpenedSections,
    updateUiState,
    useOpenedSections
} from "../../../lib/ui-state";
import { useIsConnectedToOnshape } from "../../../lib/onshape-params";
import { SETUP_URL } from "../../../lib/url";
import { useAppModal } from "../../../components/open-app-modal";
import { openFeedbackForm } from "../../feedback/open-feedback";
import { m } from "../../../paraglide/messages";
import { useLibraryId } from "../../../lib/library";
import { ReloadButton } from "../../library/components/reload-button";
import {
    HeldVersionsSetting,
    HoldNewVersionsSetting
} from "../../library/components/version-approval";
import { RefreshAdminTeamButton } from "../../admin-team/components/refresh-admin-team-button";
import { AdminTeamSetting } from "../../admin-team/components/admin-team-setting";

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
        <InputRow label={label} htmlFor={id}>
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
                onChange={(selected) => {
                    if (selected !== null) {
                        onSelect(selected);
                    }
                }}
            />
        </InputRow>
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
                    <Divider my="md" />
                    <AdminSettingsSection />
                </>
            )}
        </>
    );
}

function UserSettings(): ReactNode {
    const libraryId = useLibraryId();
    const isConnected = useIsConnectedToOnshape();
    const isDashboard = useIsDashboard();
    const modal = useAppModal();

    return (
        <Stack gap="sm">
            <InputRow label={m.settingsFeedback()}>
                <Button
                    leftSection={<ChatCircleTextIcon />}
                    onClick={() => {
                        modal.close();
                        openFeedbackForm();
                    }}
                >
                    {m.settingsLeaveFeedback()}
                </Button>
            </InputRow>
            {/* Only worth offering from inside Onshape's panel, which is what
                the standalone app is roomier than. */}
            {isConnected && (
                <InputRow label={m.settingsOpenOutsideOnshape()}>
                    <OpenUrlButton
                        text={m.settingsOpenApp()}
                        url={standaloneUrl(libraryId)}
                    />
                </InputRow>
            )}
            {/* The dashboard is where the app is the thing worth offering. */}
            {isDashboard ? (
                <InputRow label={m.settingsMainApp()}>
                    <OpenAppButton tabId={libraryId} />
                </InputRow>
            ) : (
                <InputRow label={m.settingsUsageDashboard()}>
                    <OpenUrlButton
                        text={m.settingsOpenDashboard()}
                        url={DASHBOARD_URL}
                    />
                </InputRow>
            )}
            {/* Only worth offering to somebody who is not already running the
                app, which inside Onshape's panel they are. */}
            {!isConnected && (
                <InputRow label={m.settingsGetApp()}>
                    <OpenUrlButton
                        text={m.settingsInstructions()}
                        url={SETUP_URL}
                    />
                </InputRow>
            )}
            {/* Onshape owns the session the panel runs in, so signing out is
                only the standalone app's to offer. */}
            {!isConnected && (
                <RequireSignIn>
                    <InputRow label={m.settingsOnshapeAccount()}>
                        <Button
                            leftSection={<SignOutIcon />}
                            color={StatusColor.ERROR}
                            onClick={startSignOut}
                        >
                            {m.settingsSignOut()}
                        </Button>
                    </InputRow>
                </RequireSignIn>
            )}
        </Stack>
    );
}

/** Without Onshape's launch params, which keep the app embedded. */
function standaloneUrl(tabId: AppTab): string {
    return new URL(getTabPath(tabId), window.location.origin).href;
}

interface OpenAppButtonProps {
    tabId: AppTab;
}

/** In place, not in a new tab. */
function OpenAppButton(props: OpenAppButtonProps): ReactNode {
    return (
        <Button
            leftSection={<ArrowLeftIcon />}
            onClick={() => {
                window.location.href = standaloneUrl(props.tabId);
            }}
        >
            {m.settingsOpenApp()}
        </Button>
    );
}

/** The owner's page for finding out which Onshape events fire; see the README. */
const WEBHOOK_PROBE_URL = "/webhook";

const ADMIN_SECTION_IDS = [SectionId.ADMIN_SETTINGS];

function AdminSettingsSection(): ReactNode {
    const opened = useOpenedSections(ADMIN_SECTION_IDS);
    return (
        <AppSections
            compact
            opened={opened}
            onChange={(next) => setOpenedSections(ADMIN_SECTION_IDS, next)}
        >
            <AppSection
                value={SectionId.ADMIN_SETTINGS}
                name={m.settingsAdminSettings()}
            >
                <AdminSettings />
            </AppSection>
        </AppSections>
    );
}

function AdminSettings(): ReactNode {
    return (
        <Stack gap="sm">
            {/* Always show the access level select so admins can change access level if needed */}
            <AccessLevelSelect />
            <RequireAccessLevel>
                <InputRow label={m.settingsOutdatedDocuments()}>
                    <ReloadButton />
                </InputRow>
            </RequireAccessLevel>
            <RequireAccessLevel accessLevel={AccessLevel.OWNER}>
                <InputRow label={m.settingsAllDocuments()}>
                    <ReloadButton all />
                </InputRow>
                <InputRow label={m.settingsWebhooks()}>
                    <OpenUrlButton
                        text={m.settingsOpenWebhookProbe()}
                        url={WEBHOOK_PROBE_URL}
                    />
                </InputRow>
            </RequireAccessLevel>
            <RequireAccessLevel accessLevel={AccessLevel.ADMIN}>
                <HoldNewVersionsSetting />
            </RequireAccessLevel>
            <RequireAccessLevel>
                <HeldVersionsSetting />
                <AdminTeamSetting />
            </RequireAccessLevel>
            <RequireAccessLevel accessLevel={AccessLevel.ADMIN}>
                <InputRow label={m.settingsAdminTeamMembers()}>
                    <RefreshAdminTeamButton />
                </InputRow>
            </RequireAccessLevel>
        </Stack>
    );
}

function AccessLevelSelect(): ReactNode {
    const { maxAccessLevel, currentAccessLevel } = useAccessData();

    return (
        <SettingSelect
            label={m.settingsAccessLevel()}
            value={currentAccessLevel}
            options={[
                AccessLevel.OWNER,
                AccessLevel.ADMIN,
                AccessLevel.EDITOR,
                AccessLevel.USER
            ].filter((level) => isWithinAccessLevel(level, maxAccessLevel))}
            onSelect={(accessLevel) => updateUiState({ accessLevel })}
        />
    );
}
