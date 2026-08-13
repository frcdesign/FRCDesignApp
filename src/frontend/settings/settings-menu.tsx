import { Divider, Group, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { FontWeight } from "../common/style-constants";
import { Dispatch, ReactNode, useMemo } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { Theme } from "../../shared/types";
import { hasEditorAccess } from "../../shared/types";
import { AccessLevel } from "../../shared/types";
import { useSaveSettings } from "./settings";
import { capitalize } from "../common/utils";
import { OpenUrlButton } from "../common/open-url-button";
import { RequireAccessLevel } from "../api-utils/access-level";
import { FEEDBACK_FORM_URL } from "../common/url";
import { useUpdateContextData } from "../api-utils/refresh";
import { AppSelect } from "../app-common/app-select";
import { makeSelectOption, useSelectOptions } from "./select-utils";
import { ReloadGroupsButton } from "./reload-groups-button";

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
    const loaderData = useLoaderData({ from: "/app" });
    const updateContextData = useUpdateContextData();

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
                updateContextData((data) => {
                    data.accessData.currentAccessLevel = value as AccessLevel;
                });
            }}
        />
    );
}
